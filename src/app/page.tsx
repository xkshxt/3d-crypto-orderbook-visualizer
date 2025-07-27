import ThreeScene from "./ThreeScene";

export default function Home() {
  return (
    <main style={{
      padding: "0",
      minHeight: "100vh",
      background: "var(--background)"
    }}>
      <header style={{
        padding: "32px 42px 10px 42px",
        marginBottom: 0,
        display: "flex",
        alignItems: "center",
        gap: "18px"
      }}>
        <h1 style={{
          fontSize: "2.6rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: 0,
          color: "var(--foreground)"
        }}>
          GoQuant Crypto Orderbook Depth 3D Visualizer
        </h1>
        <span style={{
          background: "#232937",
          color: "#7bdfff",
          fontFamily: "monospace",
          fontWeight: 500,
          borderRadius: 7,
          fontSize: 13,
          padding: "5px 16px",
          marginLeft: 6,
        }}>BTC/USDT • Binance</span>
      </header>
      <section style={{
        maxWidth: "99vw"
      }}>
        <ThreeScene/>
      </section>
      <footer style={{
        textAlign: "right",
        color: "#aaa",
        fontSize: "1rem",
        margin: "36px 42px 0 0",
        opacity: 0.82
      }}>
        Powered by GoQuant. <span style={{fontSize: "0.92em"}}>Live orderbook data, Binance API.</span>
      </footer>
    </main>
  );
}