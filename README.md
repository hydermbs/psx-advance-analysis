# PSX Stock Technical Analysis Dashboard

An automated, premium technical analysis dashboard that integrates a FastAPI backend and a React (Vite + TypeScript) frontend to fetch, analyze, and visualize equity market data. The app is preconfigured for the Pakistan Stock Exchange (PSX), but is built on an exchange-agnostic data adapter architecture. 

It replicates the structured workflows taught in professional technical analysis courses, automating pattern detection, trend identification, and risk calculations to provide clean **BUY / SELL / HOLD** signals with associated confidence scores and precise execution levels.

---

## 🚀 How It Works (System Architecture & Pipeline)

The system works by fetching raw historical transaction/ohlcv data, normalizing it, running a multi-threaded mathematical pipeline, and feeding the consolidated analysis to an interactive user interface.

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend                         │
│  [Chart Engine] [Signal Dashboard] [Pattern Overlay]     │
│  [Risk Calculator] [Asset List] [Timeframe Switcher]     │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────┴────────────────────────────────┐
│                 FastAPI Backend                           │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Data    │ │  Analysis  │ │  Signal  │ │  Cached  │  │
│  │ Adapter  │ │  Pipeline  │ │  Engine  │ │  Storage │  │
│  │  (PSX)   │ │  (Pandas)  │ │ (Weights)│ │ (Memory) │  │
│  └────┬─────┘ └────────────┘ └──────────┘ └──────────┘  │
└───────┼─────────────────────────────────────────────────┘
        │
   PSX Data Portal (dps.psx.com.pk)
```

### 1. Data Adapter Layer
The data adapter (`app/data/psx.py`) handles EOD (End of Day) and Intraday queries.
* **EOD Data**: Fetched from `/timeseries/eod/{symbol}`. Since PSX EOD feeds do not include daily High/Low values in the time-series array directly, the adapter dynamically approximates them using the mathematical range of Open/Close values to maintain downstream indicator integrity.
* **Intraday Data**: Fetched from `/timeseries/int/{symbol}`. Raw intraday ticks are automatically resampled into standard **4-Hour candles** using a customized Pandas aggregation pipeline (`open` = first, `high` = max, `low` = min, `close` = last, `volume` = sum).

### 2. Analysis Pipeline
Once a standardized Pandas DataFrame `[date, open, high, low, close, volume]` is loaded, the pipeline (`app/analysis/pipeline.py`) runs the following components:
* **Indicators Module** (`indicators.py`): Calculates standard technical overlays including Exponential Moving Averages (EMA 20, 50, 200), Simple Moving Averages (SMA 20, 50, 200), Bollinger Bands (20 period, 2 standard deviations), Relative Strength Index (RSI 14), and Moving Average Convergence Divergence (MACD 12/26/9).
* **Market Structure Module** (`market_structure.py`):
  * **ZigZag Swing Points**: Identifies Higher Highs (HH), Higher Lows (HL), Lower Highs (LH), and Lower Lows (LL).
  * **Dow Theory Trend**: Validates market direction based on sequence breaks (Bullish trend starts on break of previous HH, Bearish trend starts on break of previous HL).
  * **Stan Weinstein's 4 Market Stages**: Identifies Stage 1 (Accumulation), Stage 2 (Advancing), Stage 3 (Distribution), and Stage 4 (Declining) using price position relative to the 200 EMA slope.
* **Candlestick Patterns Module** (`candlesticks.py`): Performs shape validation and context filters for key candlesticks (Hammer, Shooting Star, Bullish/Bearish Engulfing, Morning/Evening Star, etc.) across the trailing bars.

### 3. Confluence & Signal Engine
The backend consolidates all indicators, trendlines, and candlestick patterns using a weighted confluence system (`app/analysis/confluence.py`):

| Component | Weight |
| :--- | :---: |
| **Market Stage** | 15% |
| **Dow Theory Trend** | 15% |
| **EMA/SMA Trend Alignment** | 15% |
| **RSI & MACD Momentum** | 15% |
| **Bollinger Bands & S/R Breakouts** | 15% |
| **Candlestick Patterns** | 15% |
| **Volume Analysis** | 10% |

Each component scores the asset from `-1.0` (extremely bearish) to `+1.0` (extremely bullish). The final score determines the signal:
* **$\ge 0.50$**: Strong Buy
* **$\ge 0.20$**: Buy
* **$-0.20$ to $0.20$**: Hold
* **$\le -0.20$**: Sell
* **$\le -0.50$**: Strong Sell

The signal engine also computes execution levels:
* **Entry Price**: The latest close price.
* **Stop Loss**: Set at the lowest recent swing low (for Buys) or swing high (for Sells), padded using Average True Range (ATR).
* **Target Price**: Calculated using key Fibonacci levels and historical Support & Resistance clusters.

---

## 📁 Project Structure

```
stock_analysis/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI server entry point and endpoint definitions
│   │   ├── data/                    # Data connectors and adapters
│   │   │   ├── adapter.py           # Abstract BaseDataAdapter interface
│   │   │   ├── psx.py               # PSX Data Adapter (scrapes dps.psx.com.pk)
│   │   │   └── registry.py          # Adapter factory and exchange router
│   │   ├── analysis/                # Mathematical engine
│   │   │   ├── pipeline.py          # Orchestrates technical modules
│   │   │   ├── indicators.py        # SMA, EMA, RSI, MACD, Bollinger Bands calculations
│   │   │   ├── market_structure.py  # Swings, Dow Theory, Stan Weinstein stages
│   │   │   ├── candlesticks.py      # Automated pattern-matching rules
│   │   │   └── confluence.py        # Signal aggregation & risk level generator
│   │   └── models/                  # Pydantic schemas (if applicable)
│   ├── requirements.txt             # Python dependencies (fastapi, pandas, numpy, httpx)
│   └── .venv/                       # Python local virtual environment
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChartContainer.tsx   # Interactive canvas powered by lightweight-charts
│   │   │   ├── SignalDashboard.tsx  # Analyst verdict, levels, and key confluence factors
│   │   │   └── StockList.tsx        # Searchable watchlist of all symbols
│   │   ├── App.tsx                  # Main layout and client side states
│   │   ├── index.css                # Color scheme, fonts, custom glassmorphic utility rules
│   │   └── main.tsx                 # React DOM mount point
│   ├── package.json                 # Node modules & scripts (Vite, React 19, Tailwind v4)
│   ├── tsconfig.json                # TypeScript configurations
│   └── vite.config.ts               # Vite bundler options
└── README.md                        # Product documentation
```

---

## 🛠️ Installation & Setup

Follow these steps to run both the FastAPI backend and React frontend locally.

### Prerequisites
* **Python 3.10+** (verify with `python --version`)
* **Node.js 22+** (verify with `node --version`)
* **npm** (comes packaged with Node.js)

---

### 1. Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Activate the Virtual Environment**:
   * **macOS / Linux**:
     ```bash
     source .venv/bin/activate
     ```
   * **Windows** (Command Prompt):
     ```cmd
     .venv\Scripts\activate.bat
     ```
   * **Windows** (PowerShell):
     ```powershell
     .venv\Scripts\Activate.ps1
     ```

3. **Install Dependencies**:
   If you need to re-install or verify packages:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the FastAPI Development Server**:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   * The backend will start on [http://localhost:8000](http://localhost:8000)
   * You can test API health by opening [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health) or browse interactive OpenAPI documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 2. Frontend Setup

1. **Navigate to the frontend directory**:
   Open a new terminal session and run:
   ```bash
   cd frontend
   ```

2. **Install Node Packages**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file or check the existing `.env` file in the `frontend` root:
   ```env
   VITE_API_URL=http://localhost:8000/api/v1/stocks
   ```

4. **Run the Vite Dev Server**:
   ```bash
   npm run dev
   ```
   * The local dev server will boot up, typically on [http://localhost:5173](http://localhost:5173).
   * Open your browser and navigate to this URL to view the live dashboard.

---

## 📈 Technical Details & Features

* **Interactive Charting Engine**: Uses TradingView's open-source `lightweight-charts` library. It features responsive scaling, color-coded candlesticks, volume histogram overlays, toggleable EMA lines (20, 50, 200), and Bollinger Band shaded ribbons.
* **Intelligent Watchlist**: A searchable panel displaying active symbols, sectors, and price trends. Real-time filtering makes it easy to switch assets quickly.
* **Risk & Sizing Module**: Calculates maximum recommended position size dynamically. Input your total trading capital and risk tolerance percentage ($1\%$ - $5\%$), and the frontend automatically computes the total shares to purchase, total capital required, and capital allocation percentage based on the computed Entry and Stop Loss levels.
* **Glassmorphic Design System**: Uses Tailwind CSS v4 to render a fully dark-themed, glassmorphic layout using modern font weights, subtle card borders, and status symbols for immediate visual parsing.
