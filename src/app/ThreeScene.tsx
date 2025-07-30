"use client";

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

type OrderLevel = {
  price: number;
  quantity: number;
  side: "bid" | "ask";
};

const DEPTH = 20;
const SNAPSHOT_HISTORY = 30;

function toScreenPosition(obj: THREE.Object3D, camera: THREE.Camera, dom: HTMLElement) {
  const vector = obj.position.clone();
  vector.project(camera);
  const w = dom.clientWidth;
  const h = dom.clientHeight;
  return {
    x: (vector.x + 1) * 0.5 * w,
    y: (-vector.y + 1) * 0.5 * h,
  };
}

const pressureColor = (baseColor: string, intensity: number): string => {
  const baseH = baseColor === "green" ? 140 : 0;
  const i = Math.min(Math.max(intensity, 0), 1);
  return `hsl(${baseH}, 89%, ${42 + Math.round(i * 35)}%)`;
};

const minMax = (arr: number[]) => {
  let min = Number.POSITIVE_INFINITY, max = Number.NEGATIVE_INFINITY;
  arr.forEach(v => {
    if (v < min) min = v;
    if (v > max) max = v;
  });
  return [min, max];
};

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{
    index: number;
    level: OrderLevel | null;
    screen: { x: number; y: number };
  } | null>(null);
  const [xTicks, setXTicks] = useState<{ x: number; price: number }[]>([]);
  const [yTicks, setYTicks] = useState<number[]>([]);
  const [pressureInfo, setPressureInfo] = useState<{
    count: number;
    priceRange: [number, number] | null;
    avgQty: number;
    mode: string;
  }>({ count: 0, priceRange: null, avgQty: 0, mode: "" });

  // Overlay state
  const [connectionStatus, setConnectionStatus] = useState<"loading" | "ok" | "error">("loading");

  // Controls panel state
  const [showHistory, setShowHistory] = useState(true);
  const [showPressure, setShowPressure] = useState(true);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1]);
  const [qtyThreshold, setQtyThreshold] = useState(0);

  const lastPressureRaw = useRef<typeof pressureInfo | null>(null);
  const snapshotHistory = useRef<OrderLevel[][]>([]);
  const barsRef = useRef<THREE.Mesh[]>([]);
  const lastLevelsRef = useRef<OrderLevel[]>([]);
  const priceRangeRef = useRef<[number, number]>([0, 1]);
  const wsRef = useRef<WebSocket | null>(null); // <-- this fixes the error


  // Show pressure panel at 1Hz
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastPressureRaw.current) setPressureInfo(lastPressureRaw.current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update sliders when price min/max is updated
    const levels = lastLevelsRef.current;
    if (levels.length) {
      const allPrices = levels.map(l => l.price);
      const [min, max] = minMax(allPrices);
      if (min !== Infinity && max !== -Infinity && (priceRange[0] === 0 && priceRange[1] === 1)) {
        setPriceRange([min, max]);
        priceRangeRef.current = [min, max];
      }
    }
    // eslint-disable-next-line
  }, [lastLevelsRef.current]); // Only on initial update

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // === THREE SCENE SETUP ===
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      65, mount.clientWidth / mount.clientHeight, 0.1, 1000
    );
    camera.position.set(0, 6, 17);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor("#18171e");
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.90);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.03);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(28, 14, 0x222233, 0x333347);
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);

    const axisMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true });
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 8, 0)]),
      axisMaterial
    ));
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-12, 0, 0), new THREE.Vector3(12, 0, 0)]),
      axisMaterial
    ));

    // === BARS for latest snapshot
    const barWidth = 0.7, barDepth = 0.6;
    barsRef.current = [];
    for (let i = 0; i < DEPTH * 2; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa, roughness: 0.35, metalness: 0.22, transparent: true, opacity: 0.88,
      });
      const geom = new THREE.BoxGeometry(barWidth, 1, barDepth);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.x = i - DEPTH + 0.5; mesh.position.y = 0.5; mesh.position.z = 0;
      mesh.name = `orderbar-${i}`; scene.add(mesh); barsRef.current.push(mesh);
    }

    // === HISTORY BARS for orderbook trail ===
    const historyBarSets: THREE.Mesh[][] = [];
    for (let snap = 0; snap < SNAPSHOT_HISTORY - 1; ++snap) {
      const snapBars: THREE.Mesh[] = [];
      for (let i = 0; i < DEPTH * 2; ++i) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x888888,
          transparent: true,
          opacity: 0.13,
        });
        const geom = new THREE.BoxGeometry(barWidth, 1, barDepth);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.x = i - DEPTH + 0.5;
        mesh.position.y = 0.5;
        mesh.position.z = -(snap + 1) * 0.6;
        mesh.name = `history-${snap}-${i}`; scene.add(mesh); snapBars.push(mesh);
      }
      historyBarSets.push(snapBars);
    }

    // === ORBIT CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.13;
    controls.enablePan = true; controls.enableZoom = true;
    controls.autoRotate = false; 
// @ts-expect-error: OrbitControls target is not in type definitions
controls.target.set(0, 3, -Z_SPACING * (HISTORY_SLICES-1)/2);

    // === RAYCASTER for hover
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    function checkBarHover(mouseX: number, mouseY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((mouseX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((mouseY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(
        barsRef.current.filter((m) => m.visible)
      );
      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const index = barsRef.current.indexOf(mesh);
        if (index >= 0 && lastLevelsRef.current[index]) {
          const barTop = mesh.clone();
          barTop.position.y = mesh.position.y + mesh.scale.y / 2;
          barTop.updateMatrixWorld(true);
          const screen = toScreenPosition(barTop, camera, renderer.domElement);
          setHoveredBar({
            index,
            level: lastLevelsRef.current[index],
            screen,
          });
        } else setHoveredBar(null);
      } else {
        setHoveredBar(null);
      }
    }
    renderer.domElement.addEventListener("mousemove", (e) => {
      checkBarHover(e.clientX, e.clientY);
    });
    renderer.domElement.addEventListener("mouseleave", () => setHoveredBar(null));

        // === ANIMATION LOOP
    let req: number;
    const animate = () => {
      // History bars (ghosted orderbook trail, if enabled)
      const snapshots = snapshotHistory.current;
      if (showHistory) {
        for (let s = 0; s < historyBarSets.length; ++s) {
          const snap = snapshots[snapshots.length - 2 - s];
          const bars = historyBarSets[s];
          if (!snap || !bars) { bars.forEach(b => b.visible = false); continue; }
          const ghostOpacity = 0.36 - (0.29 * s) / Math.max(1, historyBarSets.length - 1);
          for (let i = 0; i < bars.length; ++i) {
            const l = snap[i];
            if (!l || !bars[i]) { bars[i].visible = false; continue; }
            // (You could filter on price/qty here for live controls)
            bars[i].visible = true;
            bars[i].scale.y = Math.max(l.quantity * 7 / Math.max(...snap.map(x => x.quantity || 2.5), 2.5), 0.05);
            bars[i].position.y = bars[i].scale.y / 2;
            (bars[i].material as THREE.MeshStandardMaterial).opacity = ghostOpacity;
            if (l.side === "bid")
              (bars[i].material as THREE.MeshStandardMaterial).color.set("#0ec564");
            else
              (bars[i].material as THREE.MeshStandardMaterial).color.set("#c01224");
          }
        }
      } else {
        // Hide all ghost bars if turned off
        historyBarSets.forEach(set => set.forEach(bar => bar.visible = false));
      }

      controls.update();
      renderer.render(scene, camera);
      if (hoveredBar && hoveredBar.index >= 0) {
        const mesh = barsRef.current[hoveredBar.index];
        if (mesh) {
          const barTop = mesh.clone();
          barTop.position.y = mesh.position.y + mesh.scale.y / 2;
          barTop.updateMatrixWorld(true);
          const screen = toScreenPosition(barTop, camera, renderer.domElement);
          if (
            screen.x !== hoveredBar.screen.x ||
            screen.y !== hoveredBar.screen.y
          ) {
            setHoveredBar({ ...hoveredBar, screen });
          }
        }
      }
      req = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(req);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode)
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      barsRef.current = [];
      historyBarSets.forEach(set => set.forEach(bar => {
        if (bar.parent) bar.parent.remove(bar);
      }));
    };
    // eslint-disable-next-line
  }, [showHistory]);

  // --- LIVE DATA + OVERLAY LOGIC ---
  function connectWS() {
    setConnectionStatus("loading");
    let ws: WebSocket | null = null;
    let alive = true;

    function updateBars(levels: OrderLevel[]) {
      // PRESSURE (zone)
      const allQ = levels.map(l => l.quantity);
      const qtySum = allQ.reduce((a, b) => a + b, 0);
      const qtyMean = qtySum / allQ.length;
      const qtyStd = Math.sqrt(allQ.reduce((a, b) => a + Math.pow(b - qtyMean, 2), 0) / allQ.length);
      const qtySorted = [...allQ].sort((a, b) => b - a);
      const t15 = qtySorted[Math.floor(allQ.length * 0.15)];
      const PRESSURE_THR = Math.max(qtyMean + 1.2 * qtyStd, t15);

      const pressureInds: number[] = [];
      let pressMinP = Infinity, pressMaxP = -Infinity, pressSum = 0;

      for (let i = 0; i < DEPTH * 2; i++) {
        const mesh = barsRef.current[i];
        if (!mesh) continue;
        const entry = levels[i];
        if (!entry) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.scale.y = Math.max(entry.quantity * 7 / Math.max(...allQ, 2.5), 0.05);
        mesh.position.y = mesh.scale.y / 2;

        const isPressure = entry.quantity >= PRESSURE_THR;
        if (isPressure) {
          pressureInds.push(i);
          pressMinP = Math.min(pressMinP, entry.price);
          pressMaxP = Math.max(pressMaxP, entry.price);
          pressSum += entry.quantity;
        }
        if (entry.side === "bid") {
          (mesh.material as THREE.MeshStandardMaterial).color.set(
            isPressure ? pressureColor("green", 1) : pressureColor("green", 0)
          );
          (mesh.material as THREE.MeshStandardMaterial).opacity = isPressure ? 1 : 0.8;
          (mesh.material as THREE.MeshStandardMaterial).metalness = 0.235;
        } else {
          (mesh.material as THREE.MeshStandardMaterial).color.set(
            isPressure ? pressureColor("red", 1) : pressureColor("red", 0)
          );
          (mesh.material as THREE.MeshStandardMaterial).opacity = isPressure ? 1 : 0.85;
          (mesh.material as THREE.MeshStandardMaterial).metalness = 0.15;
        }
      }
      lastLevelsRef.current = levels;

      // Price/quantity axis ticks
      const bidPrices = levels.slice(0, DEPTH).map(l => l.price).reverse();
      const askPrices = levels.slice(DEPTH).map(l => l.price);
      const xTickObjs: { x: number; price: number }[] = [];
      bidPrices.forEach((p, i) =>
        xTickObjs.push({ x: -DEPTH + 0.5 + i, price: p })
      );
      askPrices.forEach((p, i) =>
        xTickObjs.push({ x: 0.5 + i, price: p })
      );
      setXTicks(xTickObjs);

      const maxQ = Math.max(...allQ, 2.5);
      const qtyTicks = [];
      const yTickCount = 5;
      for (let i = 0; i <= yTickCount; i++) {
        qtyTicks.push(Math.round(((maxQ * i) / yTickCount) * 1000) / 1000);
      }
      setYTicks(qtyTicks);

      lastPressureRaw.current = {
        count: pressureInds.length,
        priceRange: pressMinP < pressMaxP ? [pressMinP, pressMaxP] : null,
        avgQty: pressureInds.length > 0
          ? Math.round((pressSum / pressureInds.length) * 10000) / 10000
          : 0,
        mode: "stddev+top15%",
      };
      // Z history: push new snapshot to buffer
      const buf = snapshotHistory.current || [];
      buf.push(JSON.parse(JSON.stringify(levels)));
      if (buf.length > SNAPSHOT_HISTORY) buf.shift();
      snapshotHistory.current = buf;
    }

    function handleMsg(event: MessageEvent) {
      if (!alive) return;
      setConnectionStatus("ok");
      const data = JSON.parse(event.data);
      if (!data.bids || !data.asks) return;
      const bids: OrderLevel[] = data.bids
        .slice(0, DEPTH)
        .map(([price, quantity]: [string, string]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
          side: "bid",
        }));
      const asks: OrderLevel[] = data.asks
        .slice(0, DEPTH)
        .map(([price, quantity]: [string, string]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
          side: "ask",
        }));

      updateBars([...bids.reverse(), ...asks]);
    }

    ws = new WebSocket(
      "wss://stream.binance.com:9443/ws/btcusdt@depth20@100ms"
    );
    wsRef.current = ws;
    ws.onopen = () => { setConnectionStatus("ok"); };
    ws.onmessage = handleMsg;
    ws.onerror = () => {
      setConnectionStatus("error"); ;
    };
    ws.onclose = () => {
      setConnectionStatus("error"); ;
    };

    // Show a pre-fake chart while loading
    updateBars(
      Array(DEPTH * 2)
        .fill(0)
        .map((_, i) => ({
          price: 0,
          quantity: 0.1 + Math.abs(i - DEPTH),
          side: i < DEPTH ? "bid" : "ask",
        }))
    );

    return () => {
      alive = false;
      if (ws) ws.close();
      wsRef.current = null;
    };
  }

  useEffect(() => {
    connectWS(); // connects on mount, and re-connects if .error
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  function retryWS() {
    if (wsRef.current) wsRef.current.close();
    setTimeout(connectWS, 250);
  }

  // ----- RENDER -----
  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "500px",
        background: "#18171e",
        borderRadius: "8px",
        margin: "0 auto",
        position: "relative",
        overflow: "visible",
        userSelect: "none",
      }}
    >
      {/* X axis: Price levels, Y axis, Tooltip, Pressure ... same as before... */}

      {/* X AXIS */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 12,
          width: "100%",
          pointerEvents: "none",
        }}
      >
        {(() => {
          const labelCount = 7;
          const available = xTicks.filter(t => !!t.price);
          const shown = [];
          for (let i = 0; i < labelCount; ++i) {
            const idx = Math.round(i * (available.length - 1) / (labelCount - 1));
            shown.push(available[idx]);
          }
          const priceSeen = new Set();
          return shown.filter(tick => {
            if (!tick?.price || priceSeen.has(tick.price)) return false;
            priceSeen.add(tick.price);
            return true;
          }).map((tick, i) => {
            const perc = ((tick.x + DEPTH) / (DEPTH * 2)) * 100;
            return (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: `calc(${perc}% - 38px)`,
                  minWidth: 55,
                  textAlign: "center",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  color: "#eee",
                  background: "rgba(24,23,30, 0.66)",
                  padding: "2px 7px",
                  borderRadius: 5,
                  pointerEvents: "none",
                  opacity: 1,
                  fontWeight: i === Math.floor(labelCount / 2) ? 700 : 500,
                  border:
                    i === Math.floor(labelCount / 2)
                      ? "1.5px solid #6fbaff"
                      : undefined,
                }}
              >
                ${tick.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            );
          });
        })()}
        <span
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 12,
            color: "#bbb",
            top: 21,
            fontFamily: "monospace",
          }}
        >
          Price (BTC/USDT)
        </span>
      </div>

      {/* Y AXIS */}
      <div
        style={{
          position: "absolute",
          left: 3,
          top: 10,
          height: "85%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          pointerEvents: "none",
        }}
      >
        {yTicks.map((qty, i) => (
          <span
            key={i}
            style={{
              color: "#ccc",
              fontFamily: "monospace",
              fontSize: "12px",
              background: "rgba(24,23,30,0.8)",
              padding: "1px 5px",
              borderRadius: 4,
              opacity: i === 0 ? 0.4 : 0.8,
            }}
          >
            {qty}
          </span>
        ))}
        <span
          style={{
            fontSize: 10,
            color: "#aaa",
            alignSelf: "flex-start",
            marginLeft: 2,
            marginTop: 6,
          }}
        >
          Quantity
        </span>
      </div>

      {/* TOOLTIP: Bar Hover */}
      {hoveredBar && hoveredBar.level && (
        <div
          style={{
            position: "absolute",
            left: hoveredBar.screen.x - 60,
            top: hoveredBar.screen.y - 38,
            width: 120,
            background: "#221b2a",
            color: "#f3eded",
            padding: "7px 13px 5px 13px",
            borderRadius: 10,
            fontFamily: "monospace",
            fontSize: 13,
            border: `1px solid ${
              hoveredBar.level.side === "bid" ? "#59ffb2" : "#ff4567"
            }`,
            pointerEvents: "none",
            boxShadow: "0 2px 8px #000a",
          }}
        >
          <div>
            <b>{hoveredBar.level.side.toUpperCase()}</b>
          </div>
          <div>
            Price:{" "}
            <span style={{ color: "#cde" }}>
              {hoveredBar.level.price?.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <div>
            Qty:{" "}
            <span style={{ color: "#aff" }}>
              {hoveredBar.level.quantity}
            </span>
          </div>
        </div>
      )}

      {/* PRESSURE ZONE PANEL (toggle) */}
      {showPressure && (
        <div
          style={{
            position: "absolute",
            right: 24,
            top: 18,
            padding: "12px 17px 10px 17px",
            background: "rgba(30,15,41,0.83)",
            border: "1.5px solid #f093ff88",
            borderRadius: 10,
            color: "#ffd2ff",
            minWidth: 120,
            fontFamily: "monospace",
            fontSize: 13,
            zIndex: 3,
            pointerEvents: "auto",
            boxShadow: "0 2px 6px #0007",
            userSelect: "text",
            transition: "background 0.3s",
          }}
        >
          <div style={{ color: "#fff4", fontWeight: 700, letterSpacing: "-0.02em" }}>
            PRESSURE ZONE
          </div>
          <div>
            Bars: <b style={{ color: "#faf" }}>{pressureInfo.count}</b>
          </div>
          <div>
            Avg Qty: <b style={{ color: "#bbf" }}>{pressureInfo.avgQty}</b>
          </div>
          {pressureInfo.priceRange ? (
            <div>
              Price range:{" "}
              <b style={{ color: "#bdf" }}>
                {pressureInfo.priceRange[0].toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                -{" "}
                {pressureInfo.priceRange[1].toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </b>
            </div>
          ) : (
            <div>
              Price range: <b>-</b>
            </div>
          )}
        </div>
      )}

      {/* === FLOATING CONTROLS PANEL === */}
      <div
        style={{
          position: "absolute",
          right: 32,
          bottom: 30,
          minWidth: 210,
          zIndex: 30,
          background: "rgba(20,18,37,0.94)",
          boxShadow: "0 2px 5px #000b",
          borderRadius: 13,
          padding: "18px 26px 13px 26px",
          color: "#fff",
          fontFamily: "monospace",
          fontSize: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          border: "1.5px solid #5cf6f6",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2, letterSpacing: "-0.01em" }}>
          View Controls
        </div>
        {/* Price Range (dummy; wire as needed) */}
        <label style={{ fontSize: 13, color: "#bdf" }}>Price Range</label>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={priceRange[0]}
            max={priceRange[1]}
            value={priceRange[0]}
            style={{ width: 78, borderRadius: 6, border: "1px solid #26b6bb", background: "#111", color: "#f4fbff", fontSize: 13, padding: "2px 8px" }}
            readOnly
          />
          <span style={{ color: "#66eee9", fontWeight: 600 }}>—</span>
          <input
            type="number"
            min={priceRange[0]}
            max={priceRange[1]}
            value={priceRange[1]}
            style={{ width: 78, borderRadius: 6, border: "1px solid #26b6bb", background: "#111", color: "#f4fbff", fontSize: 13, padding: "2px 8px" }}
            readOnly
          />
        </div>
        {/* Qty filter — static for now */}
        <label style={{ fontSize: 13, color: "#bdf", marginTop: 4 }}>Quantity Min Filter</label>
        <input
          type="range"
          min={0}
          max={10}
          value={qtyThreshold}
          onChange={(e) => setQtyThreshold(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ fontSize: 12, color: "#f5fd", textAlign: "right" }}>
          Min: {qtyThreshold}
        </div>
        {/* Show/Hide overlays */}
        <div style={{
          display: "flex", flexDirection: "row", gap: 18, alignItems: "center", marginTop: 2
        }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />
            &nbsp;Show History
          </label>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showPressure} onChange={e => setShowPressure(e.target.checked)} />
            &nbsp;Show Pressure
          </label>
        </div>
      </div>

      {/* === LOADING / ERROR OVERLAY === */}
      {(connectionStatus !== "ok") && (
        <div style={{
          position: "absolute",
          left: 0, top: 0, width: "100%", height: "100%",
          background: "rgba(13,16,26,0.86)",
          color: "#fff", fontFamily: "monospace", fontSize: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", zIndex: 111
        }}>
          {connectionStatus === "loading" ? (
            <>
              <div style={{marginBottom: 12, letterSpacing:"-0.03em", fontWeight:500, color:"#95eff7"}}>
                Connecting to Binance Orderbook...
              </div>
              <div style={{
                fontSize:16, marginTop:18, color:"#dff",
                letterSpacing:"0.03em", opacity:0.7
              }}>If this takes too long, check your network.</div>
            </>
          ) : (
            <>
              <div style={{marginBottom: 13, letterSpacing:"-0.02em", color:"#ffadc2"}}>
                Disconnected from Binance!
              </div>
              <button
                style={{
                  fontSize: 18, fontWeight: 700,
                  padding: "10px 34px",
                  borderRadius: 7, background: "#009be8",
                  color: "#fff", border: "none",
                  marginTop: 4, marginBottom: 9, cursor: "pointer"
                }}
                onClick={retryWS}
              >
                Reconnect
              </button>
              <div style={{ fontSize: 14, opacity: 0.7 }}>Check your Internet.</div>
            </>
          )}
        </div>
      )}

    </div>
  );
};

export default ThreeScene;