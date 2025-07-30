# 1. **README.md**
This README covers install, usage, tech notes, APIs, controls, features, assumptions, and “what’s missing” for submission.

```markdown
# GoQuant Crypto Orderbook Depth 3D Visualizer

A Next.js + React + Three.js app visualizing live crypto orderbook depth as a 3D, interactive, real-time chart (price, quantity, time). Shows market pressure zones and orderbook history.

---

## 🚀 Features

- **3D interactive visualization** of crypto orderbook from Binance (`BTCUSDT`)
- **Axes:**
  - X = Price levels
  - Y = Quantity at each price
  - Z = Time axis—shows historical “slices” trailing into the screen
- **Live real-time data** via Binance WebSocket Depth API
- **Bid/Ask sides:** Green/red bars, labeled axes, tooltips
- **Pressure zone detection** using adaptive thresholding (highlighted bars, stats panel)
- **View controls:** Toggle orderbook history, pressure zones; quantity filter & price range (UI-present, extension-ready)
- **Loading/disconnected overlay**
- **Responsive design, mouse/trackpad rotation + zoom**

---

## 📦 Installation

```bash
git clone https://github.com/xkshxt/3d-crypto-orderbook-visualizer.git
cd 3d-crypto-orderbook-visualizer
npm install    # or yarn
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🟦 Usage

- Drag: rotate camera
- Scroll: zoom in/out
- Bars: hover for price/qty tooltips
- Controls (bottom-right):  
    - View last N orderbook “history” (toggle on/off for Z-axis ghost trail)
    - Show/hide pressure zone statistics
    - (Static, demo) price range and minimum quantity filter controls

---

## 🛠️ Technical Overview

- **Next.js (App Router), TypeScript, React**
- **Three.js** for performant 3D rendering
- **Binance WebSocket Market Depth**: [API link](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)
- **All core logic in `/src/app/ThreeScene.tsx`**; no sensitive keys required

### Orderbook/Pressure Algorithm

- Takes top `N` (default 20) bids & asks from Binance depth stream
- Detects “pressure” zones: quantity > mean + 1.2×stddev _or_ in top 15%
- Shows pressure stats (number, range, avg qty) in floating panel

---

## 💡 Design Assumptions & Trade-offs

- **Multi-venue filtering and ML pressure prediction:** Not implemented (static UI for single venue—Binance), but componentized for future extension
- **Controls panel:** UI filters are present; wiring to dataset is straightforward and extension-ready
- **No authentication required:** Binance API is public
- **Performance:** All 3D rendering optimized for interactive use (thinned, ghosted Z snapshots, minimum GC)

---

## 🧑‍💻 Developer Notes

- **Main 3D logic:** `/src/app/ThreeScene.tsx`
- **OrbitControls typing**: See `/src/app/three-extended.d.ts`
- **Add features:** see “TODO” comments in code for live filtering or more exchanges

---
