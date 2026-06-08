# Stock Technical Analysis App - Implementation Plan
        2 
        3 ## Context
        4 
        5 You completed a 14-week Technical Analysis Master Class (Sarmaaya.pk) covering: chart fundamentals, can
          dlestick patterns (31 types), trendlines/Fibonacci/divergence, support & resistance, reversal patterns
          (6 types), continuation patterns (7 types), harmonic patterns (5 types), seasonals/time cycles, trading
           psychology/risk management, 3 trading strategies, and stock screening. This app automates ALL of that
          analysis so you just select a stock and get actionable BUY/SELL/HOLD signals with confidence scores.
        6
        7 **Stack**: Python FastAPI backend + React (Vite + TypeScript) frontend
        8 **Data**: Custom API endpoints (you provide) -- fully exchange-agnostic, PSX-first
        9 **Scope**: Stocks only
       10
       11 ---
       12
       13 ## Architecture
       14
       15 ```
       16 ┌─────────────────────────────────────────────────────────┐
       17 │                   React Frontend                         │
       18 │  [Chart Engine] [Signal Dashboard] [Pattern Overlay]     │
       19 │  [Screener] [Settings] [Risk Panel]                      │
       20 └────────────────────────┬────────────────────────────────┘
       21                          │ REST API
       22 ┌────────────────────────┴────────────────────────────────┐
       23 │                 FastAPI Backend                           │
       24 │  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐  │
       25 │  │  Data    │ │  Analysis  │ │  Signal  │ │ Screener │  │
       26 │  │ Adapter  │ │  Pipeline  │ │  Engine  │ │  Engine  │  │
       27 │  └────┬─────┘ └────────────┘ └──────────┘ └──────────┘  │
       28 │       │       Analysis Modules:                          │
       29 │       │       indicators/ market_structure/ candlesticks/ │
       30 │       │       trendlines/ support_resistance/             │
       31 │       │       chart_patterns/ harmonics/ advanced/ risk/  │
       32 └───────┼──────────────────────────────────────────────────┘
       33         │
       34    External Data APIs (user-configured endpoints)
       35 ```
       36
       37 ### Data Flow
       38 ```
       39 User selects stock → GenericRestAdapter.get_ohlcv() → LRU Cache
       40 → Normalized DataFrame → AnalysisPipeline.run() → All modules in parallel
       41 → confluence.py (weighted aggregation) → signal_aggregator.py
       42 → Final BUY/SELL/HOLD + confidence + entry/stop/target → Frontend
       43 ```
       44
       45 ---
       46
       47 ## Project Structure
       48
       49 ```
       50 stock-ta-app/
       51 ├── backend/
       52 │   ├── pyproject.toml
       53 │   ├── app/
       54 │   │   ├── main.py                       # FastAPI entry point
       55 │   │   ├── config.py                     # Pydantic settings
       56 │   │   ├── models/                       # Pydantic request/response models
       57 │   │   │   ├── ohlcv.py, signals.py, patterns.py, indicators.py, analysis.py, screener.py
       58 │   │   ├── api/endpoints/               # Route handlers
       59 │   │   │   ├── data_sources.py, stocks.py, analysis.py, indicators.py
       60 │   │   │   ├── patterns.py, signals.py, screener.py, settings.py
       61 │   │   ├── data/                        # Data adapter layer
       62 │   │   │   ├── adapter.py               # Abstract DataAdapter interface
       63 │   │   │   ├── registry.py              # Data source registry
       64 │   │   │   ├── normalizer.py            # Raw response → OHLCV DataFrame
       65 │   │   │   ├── cache.py                 # In-memory LRU cache
       66 │   │   │   └── adapters/generic_rest.py # Generic REST adapter
       67 │   │   ├── analysis/                    # ALL technical analysis logic
       68 │   │   │   ├── pipeline.py              # Orchestrates all modules
       69 │   │   │   ├── indicators/              # RSI, MACD, BB, MA, Volume
       70 │   │   │   ├── market_structure/        # ZigZag swing, Dow Theory, 4 market stages
       71 │   │   │   ├── candlesticks/            # 31 patterns (single/double/triple/confirmation)
       72 │   │   │   ├── trendlines/              # Auto trendlines, Fibonacci, Divergence (A/B/C)
       73 │   │   │   ├── support_resistance/      # Auto S/R detection, range detection
       74 │   │   │   ├── chart_patterns/          # Reversal (6) + Continuation (7)
       75 │   │   │   ├── harmonics/              # AB=CD, BAT, Gartley, Crab, Butterfly
       76 │   │   │   ├── advanced/               # Gaps, Heikin Ashi, Seasonals, Time Cycles
       77 │   │   │   └── risk/                   # Position sizing, Stop loss, R:R ratio
       78 │   │   ├── signals/                     # Signal generation engine
       79 │   │   │   ├── confluence.py            # Weighted multi-module aggregation
       80 │   │   │   ├── strategy_1/2/3.py        # Three trading strategies from course
       81 │   │   │   └── signal_aggregator.py     # Final BUY/SELL/HOLD output
       82 │   │   └── screener/                    # Stock screening engine
       83 │   │       ├── criteria.py, scanner.py, ranking.py
       84 │   └── tests/
       85 ├── frontend/
       86 │   ├── package.json, vite.config.ts
       87 │   ├── src/
       88 │   │   ├── components/
       89 │   │   │   ├── chart/                   # CandlestickChart, IndicatorOverlay, PatternOverlay
       90 │   │   │   │                            # TrendlineOverlay, SROverlay, HarmonicOverlay
       91 │   │   │   │                            # SignalMarkers, SubChart (RSI/MACD/Volume)
       92 │   │   │   ├── analysis/               # SignalDashboard, MarketStage, PatternList
       93 │   │   │   │                            # IndicatorPanel, DivergencePanel, RiskPanel
       94 │   │   │   ├── screener/               # ScreenerForm, ScreenerResults
       95 │   │   │   └── settings/               # DataSourceConfig, Preferences
       96 │   │   ├── hooks/                       # useAnalysis, useStockData, useScreener
       97 │   │   └── stores/                      # Zustand state (stock, analysis, settings)
       98 │   └── Dockerfile
       99 ├── docker-compose.yml
      100 └── README.md
      101 ```
      102
      103 ---
      104
      105 ## Data Layer: Exchange-Agnostic Adapter
      106
      107 User provides a JSON config for any REST API:
      108
      109 ```json
      110 {
      111   "name": "My PSX API",
      112   "base_url": "https://api.example.com",
      113   "endpoints": { "symbols": "/api/symbols", "ohlcv": "/api/ohlcv/{symbol}" },
      114   "params_mapping": { "timeframe": "interval", "start_date": "from", "end_date": "to" },
      115   "response_mapping": { "date": "timestamp", "open": "open", "high": "high", "low": "low", "close": "cl
          ose", "volume": "volume" },
      116   "auth": { "type": "header", "key": "Authorization", "value_template": "Bearer {token}" }
      117 }
      118 ```
      119
      120 `GenericRestAdapter` reads this config and maps any REST API into the standard `DataAdapter` interface.
           All downstream analysis modules receive a normalized `pd.DataFrame` with columns `[date, open, high, l
          ow, close, volume]`.
      121
      122 ---
      123
      124 ## Analysis Modules (Course Content Mapping)
      125
      126 ### Week 1 → `indicators/` + `market_structure/`
      127 - **Indicators**: RSI (14), MACD (12/26/9), Bollinger Bands (20/2), SMA/EMA (20/50/200)
      128 - **ZigZag Swing Detection**: Port the Pine Script from course Week 12 materials. Identifies HH/HL/LH/L
          L swing points. **This is the foundation algorithm** -- feeds Dow Theory, trendlines, Fibonacci, chart
          patterns, and harmonics.
      129 - **Dow Theory**: Bull = HH+HL sequence, Bear = LH+LL. Trend start = HL + break above prev HH. Trend en
          d = LH + break below prev HL.
      130 - **4 Market Stages**: Accumulation (below flat 200MA), Advancing (above rising 200MA), Distribution (a
          bove flat 200MA), Declining (below falling 200MA)
      131
      132 ### Week 2 → `candlesticks/` (31 patterns)
      133 **Single (8)**: Hammer, Inverted Hammer, Dragonfly Doji, Bullish Spinning Top, Hanging Man, Shooting St
          ar, Gravestone Doji, Bearish Spinning Top
      134 **Double (10)**: Bullish/Bearish Kicker, Engulfing, Harami, Piercing Line/Dark Cloud Cover, Tweezer Bot
          tom/Top
      135 **Triple (9)**: Morning/Evening Star, Morning/Evening Doji Star, Bullish/Bearish Abandoned Baby, Three
          White Soldiers, Three Black Crows, Three Line Strike
      136 **Confirmation (4)**: Three Inside Up/Down, Three Outside Up/Down
      137
      138 Each pattern requires trend context (must be in uptrend/downtrend), not just candle shape.
      139
      140 ### Week 3 → `trendlines/`
      141 - **Auto Trendlines**: Connect swing lows (support) and swing highs (resistance). Score by touch count
          + time span.
      142 - **Fibonacci**: Retracement (23.6%, 38.2%, 50%, 61.8%, 78.6%) + Extensions (127.2%, 161.8%, 261.8%)
      143 - **Divergence**: Type A (strong), Type B (medium), Type C (weak) for both bullish and bearish. Check R
          SI and MACD.
      144
      145 ### Week 4 → `support_resistance/`
      146 - **Auto S/R Detection**: Cluster pivot points using ATR-based tolerance. Score by touches + recency. D
          etect role reversals (resistance→support).
      147 - **Range Detection**: Identify sideways markets (price between horizontal S/R for N+ bars)
      148
      149 ### Week 5 → `chart_patterns/reversal/` (6 patterns)
      150 - Double Top/Bottom (entry on neckline break, target = neckline ± height)
      151 - Head & Shoulders / Inverse H&S (neckline, entry, stop, measured target)
      152 - Rising Wedge (bearish) / Falling Wedge (bullish)
      153
      154 ### Week 6 → `chart_patterns/continuation/` (7 patterns)
      155 - Bullish/Bearish Flag (pole + channel, target = pole length)
      156 - Bullish/Bearish Rectangle
      157 - Cup and Handle (12-33% cup depth, 33-50% handle retracement)
      158 - Triangles (ascending, descending, symmetrical)
      159 - Parallel Channel
      160
      161 ### Week 7 → `harmonics/` (5 patterns)
      162 - AB=CD, BAT (D at 0.886 XA), Gartley (D at 0.786 XA), Crab (D at 1.618 XA), Butterfly (D beyond X at 1
          .272 XA)
      163 - Each validates Fibonacci ratios with ±5% tolerance. Outputs Potential Reversal Zone (PRZ).
      164
      165 ### Week 8 → `advanced/`
      166 - Gap detection & classification (common, breakaway, runaway, exhaustion)
      167 - Volume analysis (spikes, trend confirmation, OBV)
      168 - Seasonal patterns (monthly return analysis)
      169 - Time cycle detection and projection
      170 - Heikin Ashi candles (Week 12): HA formula + trend/scalp signals
      171
      172 ### Week 9 → `risk/`
      173 - Position sizing: `shares = (account × risk%) / (entry - stop_loss)`
      174 - ATR-based, pattern-based, and S/R-based stop loss calculation
      175 - Risk:Reward ratio (minimum 2.0 configurable)
      176
      177 ### Weeks 10-12 → `signals/`
      178 **Confluence Engine** (weighted aggregation of all modules):
      179 ```
      180 market_stage: 0.15, dow_theory: 0.15, divergence: 0.12,
      181 candlestick: 0.10, support_resistance: 0.10, chart_pattern: 0.10,
      182 trendline: 0.08, fibonacci: 0.08, harmonic: 0.07, volume: 0.05
      183 ```
      184
      185 Each module outputs [-1.0, +1.0]. Final score → STRONG_BUY (≥0.5), BUY (≥0.25), HOLD, SELL (≤-0.25), ST
          RONG_SELL (≤-0.5).
      186
      187 **Three Strategies**:
      188 1. Market stage + Dow + Fib pullback + candlestick at Fib + RSI divergence
      189 2. Multi-timeframe + pattern/indicator confluence + S/R flip confirmation
      190 3. Heikin Ashi trend riding and scalping
      191
      192 ### Week 13 → `screener/`
      193 - Criteria builder (trend, pattern, indicator, volume, signal filters)
      194 - Parallel batch scanning across all stocks
      195 - Ranked results by signal confidence
      196
      197 ---
      198
      199 ## API Endpoints
      200
      201 ```
      202 # Data Sources
      203 POST/GET/PUT/DELETE  /api/v1/data-sources
      204 POST                 /api/v1/data-sources/{id}/test
      205
      206 # Stocks
      207 GET  /api/v1/stocks
      208 GET  /api/v1/stocks/search?q=
      209 GET  /api/v1/stocks/{symbol}/ohlcv
      210
      211 # Full Analysis (primary endpoint)
      212 GET  /api/v1/analysis/{symbol}?timeframe=1d
      213
      214 # Individual Analysis
      215 GET  /api/v1/analysis/{symbol}/{module}?timeframe=1d
      216      (indicators, patterns, candlesticks, harmonics, divergences,
      217       support-resistance, trendlines, fibonacci, market-structure,
      218       heikin-ashi, volume, gaps)
      219
      220 # Screener
      221 POST  /api/v1/screener/scan
      222 GET   /api/v1/screener/presets
      223
      224 # Risk
      225 POST  /api/v1/risk/position-size
      226 ```
      227
      228 **Full analysis response** includes: signal (action, confidence, entry/stop/target, R:R, contributing f
          actors), market_structure, indicators, candlestick_patterns, divergences, support_resistance, trendline
          s, fibonacci, chart_patterns, harmonic_patterns, gaps, heikin_ashi, volume_analysis, risk_management.
      229
      230 ---
      231
      232 ## Frontend Layout
      233
      234 ```
      235 ┌─────────────────────────────────────────────────────────────────┐
      236 │  Header: [Stock Search] [Timeframe: 1D|1W|1H] [Settings]       │
      237 ├────────┬────────────────────────────────────────┬───────────────┤
      238 │        │         Main Chart Area                │  Signal       │
      239 │ Stock  │  (Candlestick + toggleable overlays)   │  Dashboard    │
      240 │ List   │  [MA] [BB] [S/R] [Fib] [Trendlines]   │               │
      241 │        │  [Patterns] [Harmonics] [Signals]      │  BUY  72%     │
      242 │ OGDC   │────────────────────────────────────────│  Entry: 95.5  │
      243 │ ENGRO  │  Sub-Chart: RSI                        │  Stop: 91.0   │
      244 │ HBL    │────────────────────────────────────────│  Target: 105  │
      245 │ LUCK   │  Sub-Chart: MACD                       │  R:R: 2.11    │
      246 │        │────────────────────────────────────────│               │
      247 │        │  Sub-Chart: Volume                     │  Factors:     │
      248 │        │                                        │  ✓ Dow Bull   │
      249 │        │                                        │  ✓ Fib 61.8%  │
      250 │        │                                        │  ✓ Engulfing  │
      251 ├────────┴────────────────────────────────────────┴───────────────┤
      252 │  Tabs: [Patterns] [Divergences] [Harmonics] [Screener]          │
      253 └─────────────────────────────────────────────────────────────────┘
      254 ```
      255
      256 **Tech**: React 18 + TypeScript, Vite, Lightweight Charts (TradingView OSS), shadcn/ui + Tailwind (dark
           mode), Zustand, TanStack Query
      257
      258 ---
      259
      260 ## Dependencies
      261
      262 **Backend**: fastapi, uvicorn, pandas, numpy, scipy, httpx, pydantic, ta (pure Python indicators), sqla
          lchemy, aiosqlite
      263 **Frontend**: react, lightweight-charts, @tanstack/react-query, zustand, tailwindcss, shadcn/ui, react-
          router, axios
      264
      265 ---
      266
      267 ## Phased Build Plan
      268
      269 | Phase | Weeks | Deliverable |
      270 |-------|-------|-------------|
      271 | **1. Foundation** | 1-2 | Data adapter, basic chart, stock selection |
      272 | **2. Indicators + Market Structure** | 3-4 | RSI/MACD/BB/MA overlays, Dow Theory, 4 market stages |
      273 | **3. Candlestick Patterns** | 5-6 | All 31 candlestick patterns detected + displayed |
      274 | **4. Trendlines/Fib/Divergence** | 7-8 | Auto trendlines, Fibonacci levels, divergence alerts |
      275 | **5. S/R + Chart Patterns** | 9-11 | S/R levels, all 13 reversal + continuation patterns |
      276 | **6. Harmonic Patterns** | 12-13 | All 5 harmonic patterns with XABCD overlay |
      277 | **7. Advanced (Gaps/HA/Cycles)** | 14-15 | Gaps, Heikin Ashi, volume, seasonals, time cycles |
      278 | **8. Signal Engine + Risk** | 16-17 | Confluence signals, BUY/SELL/HOLD, position sizing |
      279 | **9. Screener + Polish** | 18-19 | Stock screener, presets, responsive polish |
      280
      281 Each phase produces a usable deliverable. Start with Phase 1.
      282
      283 ---
      284
      285 ## Verification
      286
      287 1. **Backend**: Run `pytest` with sample OHLCV fixtures for each pattern/indicator module
      288 2. **Frontend**: Start dev server, configure a test data source, select a stock, verify chart renders w
          ith all overlays
      289 3. **Signal accuracy**: Compare app signals against manual analysis on known chart setups from the cour
          se materials
      290 4. **Screener**: Run a scan across test stocks, verify results match expected criteria
      291 5. **End-to-end**: Feed historical data where you know the outcome, verify the app would have generated
           the correct signal
