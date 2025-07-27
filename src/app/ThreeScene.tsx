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

const LABEL_FONT = "14px Arial";

function toScreenPosition(obj: THREE.Object3D, camera: THREE.Camera, dom: HTMLElement) {
  const vector = obj.position.clone();
  vector.project(camera);

  const w = dom.clientWidth;
  const h = dom.clientHeight;

  // Convert NDC [-1,1] -> px
  return {
    x: (vector.x + 1) * 0.5 * w,
    y: (-vector.y + 1) * 0.5 * h,
  };
}

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<THREE.Mesh[]>([]);
  const lastLevelsRef = useRef<OrderLevel[]>([]);
  const [hoveredBar, setHoveredBar] = useState<{
    index: number;
    level: OrderLevel | null;
    screen: { x: number; y: number };
  } | null>(null);

  // For price/qty ticks
  const [xTicks, setXTicks] = useState<{ x: number; price: number }[]>([]);
  const [yTicks, setYTicks] = useState<number[]>([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      65,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    // Camera positioning: above and angled
    camera.position.set(0, 6, 17);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor("#18171e");
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.90);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.03);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    // Grid/Floor: Fainter and less visually cluttered
    const grid = new THREE.GridHelper(28, 14, 0x222233, 0x333347);
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);

    // Axis: X (Price), Y (Quantity)
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true });
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 8, 0)]),
      axisMaterial
    ));
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-12, 0, 0), new THREE.Vector3(12, 0, 0)]),
      axisMaterial
    ));

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.13;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.autoRotate = false;
    // @ts-expect-error OrbitControls type is missing 'target' property, but it's available at runtime
    controls.target.set(0, 3, 0);
    controls.update();

    // --- Add bars ---
    const barWidth = 0.7;
    const barDepth = 0.6;
    barsRef.current = [];
    for (let i = 0; i < DEPTH * 2; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 0.35,
        metalness: 0.22,
        transparent: true,
        opacity: 0.88,
      });
      const geom = new THREE.BoxGeometry(barWidth, 1, barDepth);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.x = i - DEPTH + 0.5;
      mesh.position.y = 0.5;
      mesh.position.z = 0;
      mesh.name = `orderbar-${i}`;
      scene.add(mesh);
      barsRef.current.push(mesh);
    }

    // Raycaster for hover
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function checkBarHover(mouseX: number, mouseY: number) {
      // Normalize to NDC
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((mouseX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((mouseY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(barsRef.current.filter(m => m.visible));
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

    // Hover event
    renderer.domElement.addEventListener("mousemove", (e) => {
      checkBarHover(e.clientX, e.clientY);
    });
    renderer.domElement.addEventListener("mouseleave", () => {
      setHoveredBar(null);
    });

    // Animate/render loop
    let req: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      if (hoveredBar && hoveredBar.index >= 0) {
        // Update screen coords when camera moves/scene rotates
        const mesh = barsRef.current[hoveredBar.index];
        if (mesh) {
          const barTop = mesh.clone();
          barTop.position.y = mesh.position.y + mesh.scale.y / 2;
          barTop.updateMatrixWorld(true);
          const screen = toScreenPosition(barTop, camera, renderer.domElement);
          if (screen.x !== hoveredBar.screen.x || screen.y !== hoveredBar.screen.y) {
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
    };
    // eslint-disable-next-line
  }, []);

  // --- LIVE Binance Depth Update ---
  useEffect(() => {
    let ws: WebSocket | null = null;
    let alive = true;

    function updateBars(levels: OrderLevel[]) {
      // Scale based on maxQ
      const maxQ =
        levels.length > 0 ? Math.max(...levels.map((l) => l.quantity)) : 2.5;
      const Y_SCALE = 7 / Math.max(maxQ, 2.5);

      // For axis ticks/labels (X: prices, Y: qtys)
      const bidPrices = levels.slice(0, DEPTH).map(l => l.price).reverse();
      const askPrices = levels.slice(DEPTH).map(l => l.price);
      // X positions correspond to i - DEPTH + 0.5
      const xTickObjs: { x: number; price: number }[] = [];
      bidPrices.forEach((p, i) =>
        xTickObjs.push({ x: -DEPTH + 0.5 + i, price: p })
      );
      askPrices.forEach((p, i) =>
        xTickObjs.push({ x: 0.5 + i, price: p })
      );
      setXTicks(xTickObjs);

      // Y axis ticks: pick a sensible set
      const qtyTicks = [];
      const yTickCount = 5;
      for (let i = 0; i <= yTickCount; i++) {
        qtyTicks.push(Math.round(((maxQ * i) / yTickCount) * 1000) / 1000);
      }
      setYTicks(qtyTicks);

      // Bars
      for (let i = 0; i < DEPTH * 2; i++) {
        const mesh = barsRef.current[i];
        if (!mesh) continue;
        const entry = levels[i];
        if (!entry) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.scale.y = Math.max(entry.quantity * Y_SCALE, 0.05);
        mesh.position.y = mesh.scale.y / 2;
        // Green for bid, red for ask with some glassy shine
        if (entry.side === "bid") {
          (mesh.material as THREE.MeshStandardMaterial).color.set("#18e868");
          (mesh.material as THREE.MeshStandardMaterial).opacity = 0.8;
          (mesh.material as THREE.MeshStandardMaterial).metalness = 0.23;
          (mesh.material as THREE.MeshStandardMaterial).roughness = 0.25;
        } else {
          (mesh.material as THREE.MeshStandardMaterial).color.set("#ff2842");
          (mesh.material as THREE.MeshStandardMaterial).opacity = 0.85;
          (mesh.material as THREE.MeshStandardMaterial).metalness = 0.15;
          (mesh.material as THREE.MeshStandardMaterial).roughness = 0.30;
        }
      }
      lastLevelsRef.current = levels;
    }

    function handleMsg(event: MessageEvent) {
      if (!alive) return;
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

      // Combine: bids reversed (lowest price left) + asks
      updateBars([...bids.reverse(), ...asks]);
    }

    ws = new WebSocket(
      "wss://stream.binance.com:9443/ws/btcusdt@depth20@100ms"
    );
    ws.onmessage = handleMsg;
    ws.onerror = () => {
      /* Optionally notify error */
    };

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
    };
  }, []);

  // ----- AXIS LABEL RENDERING: Overlays using React portals -----
  // We render <div>s as HTML over the canvas at computed places.

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
        userSelect: "none"
      }}
    >
      {/* X axis: Price levels (minimal, non-overlapping) */}
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
          // Only take about 6-8 evenly spaced ticks (no overlap madness)
          const labelCount = 7;
          const available = xTicks.filter(t => !!t.price);
          // Find min/max, space evenly (excluding zero-prices)
          const shown = [];
          for (let i = 0; i < labelCount; ++i) {
            const idx = Math.round(i * (available.length - 1) / (labelCount - 1));
            shown.push(available[idx]);
          }
          // Deduplicate by price (can happen if orderbook flat)
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
                  border: i === Math.floor(labelCount / 2) ? "1.5px solid #6fbaff" : undefined
                }}
              >
                ${tick.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            fontFamily: "monospace"
          }}
        >Price (BTC/USDT)</span>
      </div>

      {/* Y axis: Quantity levels */}
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
              opacity: i === 0 ? 0.4 : 0.8
            }}
          >
            {qty}
          </span>
        ))}
        <span style={{
          fontSize: 10,
          color: "#aaa",
          alignSelf: "flex-start",
          marginLeft: 2,
          marginTop: 6
        }}>Quantity</span>
      </div>

      {/* TOOLTIP: Shows on hover */}
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
            border: `1px solid ${hoveredBar.level.side === "bid" ? "#59ffb2" : "#ff4567"}`,
            pointerEvents: "none",
            boxShadow: "0 2px 8px #000a"
          }}
        >
          <div>
            <b>{hoveredBar.level.side.toUpperCase()}</b>
          </div>
          <div>Price: <span style={{ color: "#cde" }}>{hoveredBar.level.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div>Qty: <span style={{ color: "#aff" }}>{hoveredBar.level.quantity}</span></div>
        </div>
      )}
    </div>
  );
};

export default ThreeScene;