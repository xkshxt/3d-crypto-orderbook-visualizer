"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

type OrderLevel = {
  price: number;
  quantity: number;
  side: "bid" | "ask";
};

const DEPTH = 20; // show top 10 bids, 10 asks for now

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<THREE.Mesh[]>([]); // We keep bars around for reuse!
  const lastLevelsRef = useRef<OrderLevel[]>([]);

  // --- SCENE/CAMERA/CONTROLS INIT ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene setup
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      65,
      mount.clientWidth / mount.clientHeight,
      0.05,
      1000
    );
    camera.position.set(0, 6, 16);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor("#18171e");
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.88);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.08);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    // Main grid
    const grid = new THREE.GridHelper(26, 13, 0x222233, 0x444457);
    grid.position.y = 0;
    grid.position.x = 0;
    grid.position.z = 0;
    scene.add(grid);

    // Axis (just X and Y for now)
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.4, transparent: true });
    const yAxisPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 8, 0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(yAxisPoints), axisMaterial));
    const xAxisPoints = [new THREE.Vector3(-12, 0, 0), new THREE.Vector3(12, 0, 0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(xAxisPoints), axisMaterial));

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

    // Bar geometry: reused!
    const barWidth = 0.7;
    const barDepth = 0.5;
    barsRef.current = [];
    for (let i = 0; i < DEPTH * 2; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const geom = new THREE.BoxGeometry(barWidth, 1, barDepth);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.x = i - DEPTH + 0.5;
      mesh.position.y = 0.5;
      mesh.position.z = 0;
      scene.add(mesh);
      barsRef.current.push(mesh);
    }

    // Animate/render
    let req: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
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
  }, []);

  // --- LIVE Binance depth10 orderbook & bars update ---
  useEffect(() => {
    let ws: WebSocket | null = null;
    let alive = true;

    function updateBars(levels: OrderLevel[]) {
      // Determine max quantity for dynamic scaling
      const maxQ =
        levels.length > 0 ? Math.max(...levels.map((l) => l.quantity)) : 2.5;
      const Y_SCALE = 7 / Math.max(maxQ, 2.5); // dynamic scaling

      for (let i = 0; i < DEPTH * 2; i++) {
        const mesh = barsRef.current[i];
        if (!mesh) continue;
        const entry = levels[i];
        if (!entry) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.scale.y = Math.max(entry.quantity * Y_SCALE, 0.05); // avoid vanishing; bar height
        mesh.position.y = mesh.scale.y / 2; // stand on ground
        if (entry.side === "bid") {
          (mesh.material as THREE.MeshStandardMaterial).color.set("#3aff43");
        } else {
          (mesh.material as THREE.MeshStandardMaterial).color.set("#ff2842");
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

      // Combine bids + asks for now (could split for left/right, or color differently)
      updateBars([...bids.reverse(), ...asks]);
    }

    ws = new WebSocket(
      "wss://stream.binance.com:9443/ws/btcusdt@depth20@100ms"
    );
    ws.onmessage = handleMsg;
    ws.onerror = () => {
      // Could show error UI
      //console.error("Orderbook websocket error", e);
    };

    // fallback: initial zero
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

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "500px",
        background: "#18171e",
        borderRadius: "8px",
        margin: "0 auto",
      }}
    />
  );
};

export default ThreeScene;