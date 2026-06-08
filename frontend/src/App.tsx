import { useState, useEffect } from 'react';
import { StockList } from './components/StockList';
import { ChartContainer } from './components/ChartContainer';
import { SignalDashboard } from './components/SignalDashboard';
import { Compass, AlertTriangle } from 'lucide-react';
import './App.css';

interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  is_etf: boolean;
  exchange: string;
}

interface AnalysisPayload {
  symbol_data: any[];
  market_structure: {
    dow_trend: string;
    market_stage: string;
    ema_200_slope: number;
  };
  swings: any[];
  patterns: any[];
  signals: {
    signal: string;
    confidence: number;
    entry: number;
    stop_loss: number;
    target: number;
    risk_reward: number;
    factors: string[];
  };
}

function App() {
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('SYS');
  const [timeframe, setTimeframe] = useState<'1d' | 'int'>('1d');
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Bottom Panel active tab
  const [bottomTab, setBottomTab] = useState<'patterns' | 'structure' | 'risk'>('patterns');

  // Risk Sizer states
  const [capital, setCapital] = useState(1000000); // 1,000,000 PKR
  const [riskPercent, setRiskPercent] = useState(1); // 1%

  // Fetch stocks list on mount
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/stocks');
        if (!res.ok) throw new Error('Failed to load assets');
        const data = await res.json();
        setStocks(data);
        if (data.length > 0) {
          // Find first stock that matches SYS or use the first element
          const sys = data.find((d: any) => d.symbol === 'SYS');
          setSelectedSymbol(sys ? 'SYS' : data[0].symbol);
        }
      } catch (err: any) {
        console.error(err);
        // Load default mock stock list on error
        setStocks([
          { symbol: "SYS", name: "Systems Limited", sector: "TECHNOLOGY & COMMUNICATION", is_etf: false, exchange: "PSX" },
          { symbol: "HUBC", name: "Hub Power Company Limited", sector: "POWER GENERATION & DISTRIBUTION", is_etf: false, exchange: "PSX" },
          { symbol: "TRG", name: "TRG Pakistan Limited", sector: "TECHNOLOGY & COMMUNICATION", is_etf: false, exchange: "PSX" },
          { symbol: "ENGRO", name: "Engro Corporation Limited", sector: "FERTILIZER", is_etf: false, exchange: "PSX" },
          { symbol: "LUCK", name: "Lucky Cement Limited", sector: "CEMENT", is_etf: false, exchange: "PSX" },
          { symbol: "OGDC", name: "Oil & Gas Development Company Limited", sector: "OIL & GAS EXPLORATION COMPANIES", is_etf: false, exchange: "PSX" }
        ]);
      }
    };
    fetchStocks();
  }, []);

  // Fetch analysis data when symbol or timeframe updates
  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`http://localhost:8000/api/v1/analysis/${selectedSymbol}?timeframe=${timeframe}`);
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || `Failed to fetch analysis for ${selectedSymbol}`);
        }
        const data = await res.json();
        setAnalysis(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading data');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [selectedSymbol, timeframe]);

  // Derived Sizer calculations
  const calculatePositionSize = () => {
    if (!analysis || !analysis.signals) return { riskAmount: 0, stopDistance: 0, shares: 0, capitalPercent: 0 };
    
    const entry = analysis.signals.entry;
    const stopLoss = analysis.signals.stop_loss;
    
    const riskAmount = capital * (riskPercent / 100);
    const stopDistance = Math.abs(entry - stopLoss);
    
    if (stopDistance === 0) return { riskAmount, stopDistance, shares: 0, capitalPercent: 0 };
    
    const shares = Math.floor(riskAmount / stopDistance);
    const capitalReq = shares * entry;
    const capitalPercent = (capitalReq / capital) * 100;
    
    return {
      riskAmount,
      stopDistance,
      shares,
      capitalReq,
      capitalPercent
    };
  };

  const { riskAmount, stopDistance, shares, capitalPercent } = calculatePositionSize();

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col pb-6">
      {/* Premium Header */}
      <header className="border-b border-[rgba(255,255,255,0.06)] bg-[#0f1524]/60 backdrop-blur px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/10">
            A
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Antigravity TA
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase">
              Sarmaaya Masterclass Automated
            </p>
          </div>
        </div>

        {/* Timeframe Toggles */}
        <div className="flex items-center gap-1 bg-[#0b0f19] border border-[rgba(255,255,255,0.08)] p-1 rounded-lg">
          <button
            onClick={() => setTimeframe('1d')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              timeframe === '1d'
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/25 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daily EOD
          </button>
          <button
            onClick={() => setTimeframe('int')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              timeframe === 'int'
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/25 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Intraday 5M
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 grid grid-cols-12 gap-4 px-6 pt-4 max-w-[1600px] w-full mx-auto">
        {/* Left Side: Stock selection */}
        <div className="col-span-12 md:col-span-3">
          <StockList
            stocks={stocks}
            selectedSymbol={selectedSymbol}
            onSelect={(symbol) => setSelectedSymbol(symbol)}
          />
        </div>

        {/* Center: Chart + Bottom Tabs */}
        <div className="col-span-12 md:col-span-6 flex flex-col gap-4">
          {loading ? (
            <div className="glass-panel p-8 flex flex-col items-center justify-center flex-1 min-h-[400px]">
              <Compass className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-slate-400 text-sm mt-3 font-semibold">Running analysis pipeline...</p>
            </div>
          ) : error ? (
            <div className="glass-panel p-8 flex flex-col items-center justify-center flex-1 min-h-[400px] text-center">
              <AlertTriangle className="w-12 h-12 text-rose-500 mb-2 animate-bounce" />
              <h3 className="text-base font-bold text-rose-400">Pipeline Failed</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-[300px] leading-relaxed">{error}</p>
              <button 
                onClick={() => setSelectedSymbol(selectedSymbol)}
                className="mt-4 px-4 py-2 bg-rose-600/20 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-lg hover:bg-rose-500/30 transition-all"
              >
                Retry Analysis
              </button>
            </div>
          ) : analysis ? (
            <>
              <ChartContainer
                data={analysis.symbol_data}
                patterns={analysis.patterns}
                timeframe={timeframe}
                symbol={selectedSymbol}
              />

              {/* Bottom Tabs Panel */}
              <div className="glass-panel p-4 flex-1 flex flex-col gap-3 min-h-[220px]">
                <div className="flex border-b border-[rgba(255,255,255,0.06)]">
                  <button
                    onClick={() => setBottomTab('patterns')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                      bottomTab === 'patterns'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Candle Patterns ({analysis.patterns.length})
                  </button>
                  <button
                    onClick={() => setBottomTab('structure')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                      bottomTab === 'structure'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Market Structure
                  </button>
                  <button
                    onClick={() => setBottomTab('risk')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                      bottomTab === 'risk'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Risk Sizer
                  </button>
                </div>

                {/* Tab content displays */}
                <div className="flex-1 overflow-y-auto max-h-[140px] text-xs pr-1 scrollbar-thin">
                  {bottomTab === 'patterns' && (
                    <div className="flex flex-col gap-2">
                      {analysis.patterns.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {analysis.patterns.slice(-10).map((pat, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-[#0b0f19]/45 border border-[rgba(255,255,255,0.04)] rounded">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-slate-200">{pat.pattern}</span>
                                <span className="text-[10px] text-slate-500">{pat.date.split('T')[0]}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                pat.type === 'bullish' 
                                  ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' 
                                  : pat.type === 'bearish'
                                  ? 'bg-rose-950/20 text-rose-400 border border-rose-900/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {pat.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-500 italic text-center py-4">
                          No candlestick patterns detected in the current visible range.
                        </div>
                      )}
                    </div>
                  )}

                  {bottomTab === 'structure' && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Structure metrics */}
                      <div className="flex flex-col gap-2.5 bg-[#0b0f19]/35 border border-[rgba(255,255,255,0.04)] p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Dow Trend:</span>
                          <span className={`font-bold uppercase ${
                            analysis.market_structure.dow_trend === 'BULLISH' 
                              ? 'text-emerald-400' 
                              : analysis.market_structure.dow_trend === 'BEARISH'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}>
                            {analysis.market_structure.dow_trend}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Weinstein Stage:</span>
                          <span className="font-semibold text-slate-300">
                            {analysis.market_structure.market_stage.replace('STAGE_', '').replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">200 EMA Slope:</span>
                          <span className={`font-semibold ${
                            analysis.market_structure.ema_200_slope > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {(analysis.market_structure.ema_200_slope * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* Swing points breakdown */}
                      <div className="flex flex-col gap-1.5">
                        <h4 className="font-bold text-slate-400 mb-1">Recent Swing points (ZigZag):</h4>
                        {analysis.swings.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {analysis.swings.slice(-6).map((swing, idx) => (
                              <span 
                                key={idx} 
                                className={`px-2 py-1 rounded text-[10px] font-bold ${
                                  swing.type === 'high' 
                                    ? 'bg-blue-950/20 text-blue-400 border border-blue-900/30' 
                                    : 'bg-indigo-950/20 text-indigo-400 border border-indigo-900/30'
                                }`}
                              >
                                {swing.label}: {swing.price.toFixed(1)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">No swings detected.</span>
                        )}
                      </div>
                    </div>
                  )}

                  {bottomTab === 'risk' && (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label htmlFor="risk-capital" className="text-slate-500 font-bold uppercase text-[9px]">Trading Capital (PKR)</label>
                          <input
                            id="risk-capital"
                            type="number"
                            value={capital}
                            onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
                            className="bg-[#0b0f19] border border-[rgba(255,255,255,0.08)] rounded p-1.5 font-bold text-slate-100 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label htmlFor="risk-percent" className="text-slate-500 font-bold uppercase text-[9px]">Account Risk %</label>
                          <input
                            id="risk-percent"
                            type="number"
                            value={riskPercent}
                            onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            className="bg-[#0b0f19] border border-[rgba(255,255,255,0.08)] rounded p-1.5 font-bold text-slate-100 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Sizer Outputs */}
                      <div className="grid grid-cols-4 gap-2 bg-blue-950/10 border border-blue-950/20 p-2.5 rounded-lg text-center">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase font-semibold">Total Risk</span>
                          <span className="text-xs font-bold text-rose-400">PKR {riskAmount.toFixed(0)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase font-semibold">Stop Distance</span>
                          <span className="text-xs font-bold text-slate-300">PKR {stopDistance.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase font-semibold">Sizing Shares</span>
                          <span className="text-xs font-bold text-blue-400">{shares.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase font-semibold">Capital Req.</span>
                          <span className="text-xs font-bold text-slate-300">
                            {capitalPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Right Side: Signal Summary Confluence */}
        <div className="col-span-12 md:col-span-3">
          {analysis && analysis.signals ? (
            <SignalDashboard signals={analysis.signals} symbol={selectedSymbol} />
          ) : (
            <div className="glass-panel p-4 h-full flex items-center justify-center text-slate-500 italic text-xs">
              Load an asset to view signal confluence details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
