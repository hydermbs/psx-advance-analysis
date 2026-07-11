import { useState, useEffect } from 'react';
import { ChartContainer } from './components/ChartContainer';
import { SignalDashboard } from './components/SignalDashboard';
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

  // Search states for header dropdown selector
  const [searchVal, setSearchVal] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Risk Sizer states
  const [capital, setCapital] = useState(1000000); // 1,000,000 PKR
  const [riskPercent, setRiskPercent] = useState(1); // 1%
  const apiUrl = import.meta.env.VITE_API_URL

  // Fetch stocks list on mount
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch(apiUrl);
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
        if (data.status === 'error' || !Array.isArray(data.symbol_data)) {
          throw new Error(data.message || data.detail || `Failed to fetch analysis for ${selectedSymbol}`);
        }
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

  const getPriceDetails = () => {
    if (!analysis || !analysis.symbol_data || analysis.symbol_data.length === 0) {
      return { price: 0, change: 0, changePercent: 0, isPositive: true };
    }
    const data = analysis.symbol_data;
    const latest = data[data.length - 1];
    const prev = data[data.length - 2] || latest;
    const price = latest.close;
    const change = price - prev.close;
    const changePercent = prev.close !== 0 ? (change / prev.close) * 100 : 0;
    return {
      price,
      change,
      changePercent,
      isPositive: change >= 0
    };
  };

  const { price, change, changePercent, isPositive } = getPriceDetails();

  return (
    <div className="min-h-screen w-full bg-background text-on-surface font-sans flex flex-col overflow-y-auto">
      {/* Top Header */}
      <header className="w-full h-16 bg-surface-container-lowest border-b border-outline-variant shadow-sm shrink-0 flex justify-center items-center">
        <div className="max-w-[1440px] w-full mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-black text-on-primary text-base shadow-sm">
              A
            </div>
            <div className="mr-4">
              <h1 className="text-sm font-extrabold tracking-tight text-primary uppercase">
                Antigravity TA
              </h1>
              <p className="text-[9px] text-on-surface-variant font-bold tracking-wider uppercase">
                A complete Automated Analysis
              </p>
            </div>
          </div>

          {/* Quick Search bar */}
          <div className="flex-1 max-w-md mx-10 relative">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input 
              style={{ padding: '10px 10px 10px 36px' }}
                className="w-full bg-surface-container border border-outline-variant rounded-full py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-primary transition-colors animate-none p-[10px]" 
                placeholder="Search assets (e.g. SYS, HUBC, ENGRO)" 
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => {
                  setTimeout(() => setSearchFocused(false), 200);
                }}
              />
            </div>

            {/* Suggestions Dropdown */}
            {searchFocused && (
              (() => {
                const results = searchVal.trim() !== '' 
                  ? stocks.filter(s => 
                      s.symbol.toUpperCase().includes(searchVal.toUpperCase()) || 
                      s.name.toUpperCase().includes(searchVal.toUpperCase())
                    )
                  : stocks;
                
                return results.length > 0 ? (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                    {results.map(stock => (
                      <button
                        key={stock.symbol}
                        onMouseDown={() => {
                          setSelectedSymbol(stock.symbol);
                          setSearchVal('');
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-surface-container rounded-lg transition-colors cursor-pointer flex items-center justify-between group active:scale-[0.99] border-none"
                      >
                        <div style={{margin:'0px 10px 0px 10px'}}className="flex items-center gap-2.5">
                          <span className="font-bold text-xs text-primary group-hover:text-secondary">{stock.symbol}</span>
                          <span className="text-[10px] text-on-surface-variant block truncate max-w-[200px]">{stock.name}</span>
                        </div>
                        <span className="text-[9px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded font-bold uppercase">{stock.exchange}</span>
                      </button>
                    ))}
                  </div>
                ) : null;
              })()
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Timeframe Toggles */}
            <div className="flex items-center gap-1 bg-surface-container border border-outline-variant p-1 rounded-full">
              <button
                style={{ padding: '10px 10px 10px 10px' }}
                onClick={() => setTimeframe('1d')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  timeframe === '1d'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Daily EOD
              </button>
              <button
                style={{ padding: '10px 10px 10px 10px' }}
                onClick={() => setTimeframe('int')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  timeframe === 'int'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Intraday 4H
              </button>
            </div>
          </div>
        </div>
      </header>

        {/* Content Canvas */}
        <main className="flex-1 w-full p-6 bg-background flex justify-center overflow-y-auto custom-scrollbar">
          <div className="max-w-[1440px] w-full mx-auto space-y-6">
            {/* Selected Ticker Quote Header */}
            {analysis && !loading && !error && (
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span style={{ padding: '5px 5px 5px 5px', margin: '5px 5px 5px 5px' }} className="bg-primary text-on-primary px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">{analysis.symbol_data?.[0]?.exchange || 'PSX'}</span>
                    <h2 className="text-lg font-bold text-primary tracking-tight">{selectedSymbol}</h2>
                  </div>
                  <h1 style={{ margin: '5px 5px 10px 5px' }} className="text-2xl font-bold text-primary leading-none">
                    {stocks.find(s => s.symbol === selectedSymbol)?.name || selectedSymbol}
                  </h1>
                </div>
                <div className="text-right flex flex-col items-end sm:items-end">
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    PKR {price.toFixed(2)}
                  </p>
                  <div className={`flex items-center gap-1 font-bold text-xs ${isPositive ? 'text-secondary' : 'text-error'}`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {isPositive ? 'trending_up' : 'trending_down'}
                    </span>
                    <span className="tabular-nums">{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</span>
                    <span className="opacity-80 tabular-nums">({isPositive ? '+' : ''}{change.toFixed(2)} PKR)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bento Grid */}
            <div className="grid grid-cols-12 gap-6">
              {/* Center Column - Chart and Tabs */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                {loading ? (
                  <div className="glass-panel p-12 flex flex-col items-center justify-center min-h-[400px]">
                    <span className="material-symbols-outlined text-primary text-[40px] animate-spin mb-3">sync</span>
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Running Technical Analysis Pipeline...</p>
                  </div>
                ) : error ? (
                  <div className="glass-panel p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
                    <span className="material-symbols-outlined text-error text-[48px] mb-3 animate-bounce">warning</span>
                    <h3 className="text-sm font-bold text-error">Pipeline Execution Failed</h3>
                    <p className="text-on-surface-variant text-xs mt-1.5 max-w-[320px] leading-relaxed">{error}</p>
                    <button 
                      onClick={() => setSelectedSymbol(selectedSymbol)}
                      className="mt-5 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    >
                      Retry Analysis Pipeline
                    </button>
                  </div>
                ) : analysis && analysis.symbol_data ? (
                  <>
                    <ChartContainer
                      data={analysis.symbol_data}
                      patterns={analysis.patterns}
                      timeframe={timeframe}
                      symbol={selectedSymbol}
                    />

                    {/* Indicators details panel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Technicals summary */}
                      <div className="glass-panel p-5 flex flex-col justify-between min-h-[140px]">
                        <div style={{ marginTop:'15px' }} className="flex justify-center items-center gap-2 mb-2.5">
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Momentum Indicators</p>
                          <span className="bg-secondary/15 text-secondary border border-secondary/20 px-2 py-0.5 rounded text-[9px] font-bold">LIVE</span>
                        </div>
                        <div style={{ marginBottom: '15px' }} className="grid grid-cols-2 gap-4 tabular-nums text-center">
                          <div className="flex flex-col items-center justify-center">
                            <p className="text-on-surface-variant/80 text-[10px] font-semibold mb-0.5">RSI (14)</p>
                            <p className="text-base font-bold text-primary">
                              {analysis.symbol_data?.[analysis.symbol_data.length - 1]?.rsi?.toFixed(1) || 'N/A'}
                            </p>
                            <p className="text-[9px] text-on-surface-variant/80 font-bold uppercase tracking-wide mt-1">
                              {(analysis.symbol_data?.[analysis.symbol_data.length - 1]?.rsi ?? 50) >= 70 ? 'Overbought' : (analysis.symbol_data?.[analysis.symbol_data.length - 1]?.rsi ?? 50) <= 30 ? 'Oversold' : 'Neutral'}
                            </p>
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <p className="text-on-surface-variant/80 text-[10px] font-semibold mb-0.5">MACD Trend</p>
                            <div className="flex items-center justify-center gap-1">
                              <span className={`material-symbols-outlined text-[16px] ${(analysis.symbol_data?.[analysis.symbol_data.length - 1]?.macd_hist ?? 0) >= 0 ? 'text-secondary' : 'text-error'}`}>
                                {(analysis.symbol_data?.[analysis.symbol_data.length - 1]?.macd_hist ?? 0) >= 0 ? 'arrow_upward' : 'arrow_downward'}
                              </span>
                              <p className={`text-base font-bold ${(analysis.symbol_data?.[analysis.symbol_data.length - 1]?.macd_hist ?? 0) >= 0 ? 'text-secondary' : 'text-error'}`}>
                                {(analysis.symbol_data?.[analysis.symbol_data.length - 1]?.macd_hist ?? 0) >= 0 ? 'Bullish' : 'Bearish'}
                              </p>
                            </div>
                            <p className="text-[9px] text-on-surface-variant/80 font-bold uppercase tracking-wide mt-1">Convergence</p>
                          </div>
                        </div>
                      </div>

                      {/* Weinstein Trend MA */}
                      <div className="glass-panel p-5 flex flex-col justify-between min-h-[140px]">
                        <p style={{marginTop:'15px'}} className="text-center text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2.5">Trend Strength</p>
                        <div className="flex flex-col items-center justify-center text-center tabular-nums gap-1.5">
                          <div>
                            <p className="text-on-surface-variant/80 text-[10px] font-semibold mb-0.5">50-Day MA Price</p>
                            <p className="text-base font-bold text-primary">
                              PKR {analysis.symbol_data?.[analysis.symbol_data.length - 1]?.ema_50?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-secondary text-xs font-bold">+3.6%</span>
                            <span className="text-[9px] text-on-surface-variant/80 uppercase font-bold">Above Support</span>
                          </div>
                        </div>
                        <div className="mt-3.5 h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                          <div className="h-full bg-secondary w-3/4"></div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Tabs Panel */}
                    <div  className="glass-panel p-4 flex flex-col gap-3 min-h-[220px]">
                      <div  className="flex border-b border-outline-variant">
                        <button style = {{margin:'15px'}}
                          onClick={() => setBottomTab('patterns')}
                  
                          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                            bottomTab === 'patterns'
                              ? 'border-primary text-primary'
                              : 'border-transparent text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          Candle Patterns ({analysis.patterns.length})
                        </button>
                        <button style = {{margin:'15px'}}
                          onClick={() => setBottomTab('structure')}
                          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                            bottomTab === 'structure'
                              ? 'border-primary text-primary'
                              : 'border-transparent text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          Market Structure
                        </button>
                        <button style = {{margin:'15px'}}
                          onClick={() => setBottomTab('risk')}
                          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                            bottomTab === 'risk'
                              ? 'border-primary text-primary'
                              : 'border-transparent text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          Risk Sizer
                        </button>
                      </div>

                      {/* Tab Content Display */}
                      <div className="flex-1 overflow-y-auto max-h-[140px] text-xs pr-1 custom-scrollbar">
                        {bottomTab === 'patterns' && (
                          <div className="flex flex-col gap-2">
                            {analysis.patterns.length > 0 ? (
                              <div style={{ margin: '5px 0px 3px 0px' }} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {analysis.patterns.slice(-10).map((pat, idx) => (
                                <div key={idx} className="flex flex-col items-center justify-center text-center p-3 bg-surface-container border border-outline-variant rounded-lg gap-2">
                                  
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-primary text-xs">{pat.pattern}</span>
                                    <span className="text-[10px] text-on-surface-variant">{pat.date.split('T')[0]}</span>
                                  </div>
                            
                                  <div 
                                    style={{
                                      display: 'inline-block',
                                      width: 'auto',
                                      minWidth: '70px',
                                      padding: '4px 10px',
                                      borderRadius: '9999px',
                                      fontSize: '9px',
                                      fontWeight: 'bold',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      textAlign: 'center',
                                      whiteSpace: 'nowrap'
                                    }}
                                    className={
                                      pat.type === 'bullish' 
                                        ? 'bg-secondary/10 text-secondary border border-secondary/20' 
                                        : pat.type === 'bearish'
                                        ? 'bg-error-container text-error border border-error/15'
                                        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
                                    }
                                  >
                                    {pat.type}
                                  </div>
                            
                                </div>
                              ))}
                            </div>
                            ) : (
                              <div className="text-on-surface-variant italic text-center py-4">
                                No candlestick patterns detected in the current range.
                              </div>
                            )}
                          </div>
                        )}

                        {bottomTab === 'structure' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Structure metrics */}
                            <div className="flex flex-col gap-3 bg-surface-container border border-outline-variant p-3.5 rounded-xl text-center items-center justify-center">
                              <div className="flex flex-col items-center gap-0.5 text-xs">
                                <span className="text-on-surface-variant font-bold uppercase text-[9px] tracking-wider">Dow Theory Trend</span>
                                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                  analysis.market_structure.dow_trend === 'BULLISH' 
                                    ? 'bg-secondary/15 text-secondary' 
                                    : analysis.market_structure.dow_trend === 'BEARISH'
                                    ? 'bg-error-container text-error'
                                    : 'bg-surface-container-high text-on-surface'
                                }`}>
                                  {analysis.market_structure.dow_trend}
                                </span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5 text-xs border-t border-outline-variant pt-2 w-full">
                                <span className="text-on-surface-variant font-bold uppercase text-[9px] tracking-wider">Weinstein Stage</span>
                                <span className="font-bold text-primary bg-surface-container-high px-2 py-0.5 rounded text-[10px]">
                                  {analysis.market_structure.market_stage.replace('STAGE_', '').replace('_', ' ')}
                                </span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5 text-xs border-t border-outline-variant pt-2 w-full">
                                <span className="text-on-surface-variant font-bold uppercase text-[9px] tracking-wider">200 EMA Slope</span>
                                <span className={`font-bold text-[10px] px-2 py-0.5 rounded ${
                                  analysis.market_structure.ema_200_slope > 0 ? 'bg-secondary/15 text-secondary' : 'bg-error-container text-error'
                                }`}>
                                  {(analysis.market_structure.ema_200_slope * 100).toFixed(2)}%
                                </span>
                              </div>
                            </div>

                            {/* Swing points breakdown */}
                            <div className="flex flex-col items-center text-center gap-2">
                              <h4 className="font-bold text-on-surface-variant text-[11px] uppercase tracking-wider mb-1">Recent Swing points (ZigZag):</h4>
                              {analysis.swings.length > 0 ? (
                                <div className="flex flex-wrap justify-center gap-1.5">
                                  {analysis.swings.slice(-6).map((swing, idx) => (
                                    <span 
                                      key={idx} 
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                                        swing.type === 'high' 
                                          ? 'bg-secondary/10 text-secondary border-secondary/20' 
                                          : 'bg-surface-container border-outline-variant text-on-surface'
                                      }`}
                                    >
                                      {swing.label}: {swing.price.toFixed(1)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-on-surface-variant italic">No swings detected.</span>
                              )}
                            </div>
                          </div>
                        )}

                        {bottomTab === 'risk' && (
                          <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col items-center text-center gap-1">
                                <label htmlFor="risk-capital" className="text-on-surface-variant font-bold uppercase text-[9px] tracking-wider">Trading Capital (PKR)</label>
                                <input
                                  id="risk-capital"
                                  type="number"
                                  value={capital}
                                  onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
                                  className="bg-surface-container border border-outline-variant rounded-lg p-2 font-bold text-xs text-on-surface focus:outline-none focus:border-primary transition-all text-center w-full max-w-[220px]"
                                />
                              </div>
                              <div className="flex flex-col items-center text-center gap-1">
                                <label htmlFor="risk-percent" className="text-on-surface-variant font-bold uppercase text-[9px] tracking-wider">Account Risk %</label>
                                <input
                                  id="risk-percent"
                                  type="number"
                                  value={riskPercent}
                                  onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                                  step="0.1"
                                  className="bg-surface-container border border-outline-variant rounded-lg p-2 font-bold text-xs text-on-surface focus:outline-none focus:border-primary transition-all text-center w-full max-w-[220px]"
                                />
                              </div>
                            </div>

                            {/* Sizer Outputs */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-surface-container-low border border-outline-variant p-3 rounded-xl text-center font-medium tabular-nums justify-items-center">
                              <div className="flex flex-col items-center justify-center bg-surface-container-lowest p-2 rounded-lg border border-outline-variant w-full">
                                <span className="text-[9px] text-on-surface-variant uppercase font-bold">Total Risk</span>
                                <span className="text-xs font-bold text-error">PKR {riskAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              </div>
                              <div className="flex flex-col items-center justify-center bg-surface-container-lowest p-2 rounded-lg border border-outline-variant w-full">
                                <span className="text-[9px] text-on-surface-variant uppercase font-bold">Stop Distance</span>
                                <span className="text-xs font-bold text-primary">PKR {stopDistance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex flex-col items-center justify-center bg-surface-container-lowest p-2 rounded-lg border border-outline-variant w-full">
                                <span className="text-[9px] text-on-surface-variant uppercase font-bold">Sizing Shares</span>
                                <span className="text-xs font-bold text-secondary">{shares.toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col items-center justify-center bg-surface-container-lowest p-2 rounded-lg border border-outline-variant w-full">
                                <span className="text-[9px] text-on-surface-variant uppercase font-bold">Capital Req.</span>
                                <span className="text-xs font-bold text-primary">
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

              {/* Right Column - Verdict and Insight */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                {/* Confluence verdict */}
                {analysis && analysis.signals ? (
                  <SignalDashboard signals={analysis.signals} symbol={selectedSymbol} />
                ) : (
                  <div className="glass-panel p-6 min-h-[300px] flex items-center justify-center text-on-surface-variant italic text-xs">
                    Load an asset to view signal confluence details
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

      {/* Floating Action Button (Optional - Search/Quick Trade) */}
      <button 
        onClick={() => {
          if (stocks.length > 0) setSelectedSymbol(stocks[0].symbol);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-50 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[26px]">add_chart</span>
      </button>
    </div>
  );
}

export default App;
