# GoQuant Crypto Orderbook Depth 3D Visualizer

A Next.js + React + Three.js web application that visualizes the live cryptocurrency orderbook as an interactive, rotating 3D chart (price, quantity, time). Includes real-time data streaming, pressure zone detection, and interactive controls.

---

## 🚀 Features

- **3D interactive chart:** 
  - X-axis = Price
  - Y-axis = Quantity at each price
  - Z-axis = Time/history (last N orderbook snapshots, ghosted in 3D)
- **Real-time live data** from Binance WebSocket (BTCUSDT)
- **Bid/Ask colored bars**, quantity scale, price ticks
- **Pressure zone analysis**: automatic detection & highlighting of highly liquid price clusters; floating stats panel
- **Overlay for “Loading”/“Disconnected”** with auto-reconnect
- **Control panel:** toggle history/pressure overlays, adjust filters
- **Responsive, mobile-friendly, with OrbitControls (pan/zoom/orbit)**
- **Easy to extend for more features/exchanges**

---

## 🛠️ Tech Stack

- [Next.js](https://nextjs.org/) (App Router, TypeScript)
- [React](https://react.dev/)
- [Three.js](https://threejs.org/)
- [Binance WebSocket API](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)
- TypeScript, ESLint/Prettier

---

## 📦 Installation & Running

```bash
git clone https://github.com/xkshxt/3d-crypto-orderbook-visualizer.git
cd 3d-crypto-orderbook-visualizer
npm install
npm run dev
```
View at [http://localhost:3000](http://localhost:3000)

---

## 🖱️ Usage

- **Rotate/Zoom**: Drag with mouse/touch; scroll to zoom
- **Hover** bars for price and quantity tooltip
- **Controls (bottom right):**
  - Toggle orderbook history on Z axis
  - Toggle pressure zone panel
  - (UI) Price range and min-quantity—panel shown for future extension

---

## ⚡ How It Works

- **Streams Binance BTCUSDT orderbook with depth 20 bids & asks, updates in real time**
- **Visualizes top 20 bid & ask price levels as 3D bars; newest at front, older in transparent layers behind**
- **Highlights “pressure” zones (liquidity spikes) using adaptive mean+stddev thresholding**
- **Displays live stats for pressure: number, avg quantity, price range**
- **Shows overlays for loading/disconnect, with retry**

---

## 💡 Design Decisions & Limitations

- **Single-venue (Binance only)** for demo; can extend to more via same pattern
- **Control panel is present; currently UI-only for filters (per assignment scope)**
- **No backend, no sensitive API keys**
- **No persistent storage or user accounts**
- **For “Pressure zone”, statistics are debounced for readability (1s refresh)**

---

## 🧪 Sample Testing

Includes a sample unit test for pressure detection in `/src/app/orderbookUtils.test.ts`.  
To run tests:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom ts-jest
npm test
```
See the test file for details.

---

## 🗂️ Structure

```
/src/app/
  ├── ThreeScene.tsx      # Main 3D visualization logic (core)
  ├── page.tsx            # Home page
  ├── three-extended.d.ts # OrbitControls typings
  └── ...                 # Other assets & helpers
```

---

## 🐞 Troubleshooting

- **Disconnected overlay** = network error or Binance API unreachable. Click “Reconnect” or reload after a few seconds.
- If price ranges are 0, wait for orderbook to update or refresh page.

---

## 👤 Author / Contact

GoQuant 3D Orderbook Demo — by [AKSHAT JAIN].  
For assignment/submission only.

---

```

---

