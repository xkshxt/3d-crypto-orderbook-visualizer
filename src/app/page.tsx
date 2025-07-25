import ThreeScene from "./ThreeScene";

export default function Home() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Crypto Orderbook 3D Visualizer</h1>
      <p>This is a basic spinning cube. We will build on this!</p>
      <ThreeScene />
    </main>
  );
}