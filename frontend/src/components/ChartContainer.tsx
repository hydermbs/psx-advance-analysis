import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries,createSeriesMarkers } from 'lightweight-charts';
import type { ISeriesApi, SeriesMarker, CandlestickData } from 'lightweight-charts';
import { Eye, EyeOff, TrendingUp } from 'lucide-react';

interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema_20?: number;
  ema_50?: number;
  ema_200?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
  rsi?: number;
  macd_line?: number;
  macd_signal?: number;
  macd_hist?: number;
}

interface PatternPoint {
  date: string;
  pattern: string;
  type: string;
  price: number;
}

interface ChartContainerProps {
  data: ChartDataPoint[];
  patterns: PatternPoint[];
  timeframe: string;
  symbol: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({ data, patterns, timeframe, symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [indicatorTab, setIndicatorTab] = useState<'volume' | 'rsi' | 'macd'>('volume');

  // Chart instances stored in refs
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'>>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'>>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'>>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'>>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'>>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'>>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'>>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'>>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // Create main price chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f1524' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        timeVisible: timeframe === 'int',
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries,{
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    // Add Volume Series (overlaid on price chart with its own transparent scale)
    const volumeSeries = chart.addSeries(HistogramSeries,{
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume-scale',
    });
    
    chart.priceScale('volume-scale').applyOptions({
      scaleMargins: {
        top: 0.8, // volume is at bottom 20%
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Add EMAs
    ema20SeriesRef.current = chart.addSeries(LineSeries,{ color: '#3b82f6', lineWidth: 2, title: 'EMA 20' });
    ema50SeriesRef.current = chart.addSeries(LineSeries,{ color: '#f59e0b', lineWidth: 2, title: 'EMA 50' });
    ema200SeriesRef.current = chart.addSeries(LineSeries,{ color: '#ec4899', lineWidth: 2, title: 'EMA 200' });

    // Add Bollinger Bands
    bbUpperSeriesRef.current = chart.addSeries(LineSeries,{ color: '#8b5cf6', lineWidth: 2, lineStyle: 1, title: 'BB Upper' });
    bbMiddleSeriesRef.current = chart.addSeries(LineSeries,{ color: '#8b5cf6', lineWidth: 2, lineStyle: 2, title: 'BB Middle' });
    bbLowerSeriesRef.current = chart.addSeries(LineSeries,{ color: '#8b5cf6', lineWidth: 2, lineStyle: 1, title: 'BB Lower' });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, timeframe]);

  // Update Data and Visibility on Toggles
  useEffect(() => {
    if (!candleSeriesRef.current || data.length === 0) return;

    // Prepare chart timeline
    const formattedCandles: CandlestickData[] = data.map((d) => {
      const timeVal = timeframe === 'int' 
        ? Math.floor(new Date(d.time).getTime() / 1000) 
        : d.time.split('T')[0];
      return {
        time: timeVal as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      };
    });

    candleSeriesRef.current.setData(formattedCandles);

    // Prepare Volume data
    if (volumeSeriesRef.current) {
      const formattedVolume = data.map((d) => {
        const timeVal = timeframe === 'int'
          ? Math.floor(new Date(d.time).getTime() / 1000)
          : d.time.split('T')[0];
        
        return {
          time: timeVal as any,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        };
      });
      volumeSeriesRef.current.setData(formattedVolume);
    }

    // Set EMAs
    if (ema20SeriesRef.current) {
      if (showEma20) {
        const ema20Data = data
          .filter((d) => d.ema_20 !== undefined)
          .map((d) => ({
            time: (timeframe === 'int' ? Math.floor(new Date(d.time).getTime() / 1000) : d.time.split('T')[0]) as any,
            value: d.ema_20!,
          }));
        ema20SeriesRef.current.setData(ema20Data);
      } else {
        ema20SeriesRef.current.setData([]);
      }
    }

    if (ema50SeriesRef.current) {
      if (showEma50) {
        const ema50Data = data
          .filter((d) => d.ema_50 !== undefined)
          .map((d) => ({
            time: (timeframe === 'int' ? Math.floor(new Date(d.time).getTime() / 1000) : d.time.split('T')[0]) as any,
            value: d.ema_50!,
          }));
        ema50SeriesRef.current.setData(ema50Data);
      } else {
        ema50SeriesRef.current.setData([]);
      }
    }

    if (ema200SeriesRef.current) {
      if (showEma200) {
        const ema200Data = data
          .filter((d) => d.ema_200 !== undefined)
          .map((d) => ({
            time: (timeframe === 'int' ? Math.floor(new Date(d.time).getTime() / 1000) : d.time.split('T')[0]) as any,
            value: d.ema_200!,
          }));
        ema200SeriesRef.current.setData(ema200Data);
      } else {
        ema200SeriesRef.current.setData([]);
      }
    }

    // Set Bollinger Bands
    const showBands = showBB;
    if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
      if (showBands) {
        const t = (d: any) => (timeframe === 'int' ? Math.floor(new Date(d.time).getTime() / 1000) : d.time.split('T')[0]) as any;
        bbUpperSeriesRef.current.setData(data.filter((d) => d.bb_upper !== undefined).map((d) => ({ time: t(d), value: d.bb_upper! })));
        bbMiddleSeriesRef.current.setData(data.filter((d) => d.bb_middle !== undefined).map((d) => ({ time: t(d), value: d.bb_middle! })));
        bbLowerSeriesRef.current.setData(data.filter((d) => d.bb_lower !== undefined).map((d) => ({ time: t(d), value: d.bb_lower! })));
      } else {
        bbUpperSeriesRef.current.setData([]);
        bbMiddleSeriesRef.current.setData([]);
        bbLowerSeriesRef.current.setData([]);
      }
    }

    // Place Markers for Patterns
    if (candleSeriesRef.current && patterns.length > 0) {
      const markers: SeriesMarker<any>[] = [];
      
      patterns.forEach((pat) => {
        // Find matching data point to verify time mapping
        const matchingPoint = data.find(
          (d) => d.time.split('T')[0] === pat.date.split('T')[0]
        );
        
        if (matchingPoint) {
          const timeVal = timeframe === 'int'
            ? Math.floor(new Date(matchingPoint.time).getTime() / 1000)
            : matchingPoint.time.split('T')[0];
            
          markers.push({
            time: timeVal as any,
            position: pat.type === 'bullish' ? 'belowBar' : pat.type === 'bearish' ? 'aboveBar' : 'inBar',
            color: pat.type === 'bullish' ? '#10b981' : pat.type === 'bearish' ? '#ef4444' : '#f59e0b',
            shape: pat.type === 'bullish' ? 'arrowUp' : pat.type === 'bearish' ? 'arrowDown' : 'circle',
            text: pat.pattern,
          });
        }
      });
      createSeriesMarkers(candleSeriesRef.current, markers);
    }
  }, [data, showEma20, showEma50, showEma200, showBB, patterns, timeframe]);

  return (
    <div className="glass-panel p-4 flex flex-col gap-4 w-full" style={{ minHeight: '520px' }}>
      {/* Header controls */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-blue-500 w-5 h-5" />
          <h2 className="text-xl font-bold tracking-tight">{symbol} Technical Chart</h2>
          <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded uppercase font-semibold">
            {timeframe === 'int' ? '5M Intraday' : '1D EOD'}
          </span>
        </div>
        
        {/* Toggle Overlays */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowEma20(!showEma20)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded border transition-all ${
              showEma20 
                ? 'bg-blue-600/20 border-blue-500/30 text-blue-400 font-medium' 
                : 'bg-transparent border-[rgba(255,255,255,0.08)] text-slate-400'
            }`}
          >
            {showEma20 ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            EMA 20
          </button>
          <button
            onClick={() => setShowEma50(!showEma50)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded border transition-all ${
              showEma50 
                ? 'bg-amber-600/20 border-amber-500/30 text-amber-400 font-medium' 
                : 'bg-transparent border-[rgba(255,255,255,0.08)] text-slate-400'
            }`}
          >
            {showEma50 ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            EMA 50
          </button>
          <button
            onClick={() => setShowEma200(!showEma200)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded border transition-all ${
              showEma200 
                ? 'bg-pink-600/20 border-pink-500/30 text-pink-400 font-medium' 
                : 'bg-transparent border-[rgba(255,255,255,0.08)] text-slate-400'
            }`}
          >
            {showEma200 ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            EMA 200
          </button>
          <button
            onClick={() => setShowBB(!showBB)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded border transition-all ${
              showBB 
                ? 'bg-purple-600/20 border-purple-500/30 text-purple-400 font-medium' 
                : 'bg-transparent border-[rgba(255,255,255,0.08)] text-slate-400'
            }`}
          >
            {showBB ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Bands
          </button>
        </div>
      </div>

      {/* Main chart rendering container */}
      <div ref={chartContainerRef} className="relative w-full rounded-lg overflow-hidden border border-[rgba(255,255,255,0.04)]" />

      {/* Indicator Sub-tabs (RSI / MACD indicator views) */}
      <div className="flex flex-col gap-2 mt-2">
        <div className="flex border-b border-[rgba(255,255,255,0.06)]">
          <button
            onClick={() => setIndicatorTab('volume')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
              indicatorTab === 'volume' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Volume Analysis
          </button>
          <button
            onClick={() => setIndicatorTab('rsi')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
              indicatorTab === 'rsi' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            RSI (14)
          </button>
          <button
            onClick={() => setIndicatorTab('macd')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
              indicatorTab === 'macd' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            MACD Histogram
          </button>
        </div>

        {/* Tab contents */}
        <div className="bg-[#0b0f19]/40 rounded-lg p-3 border border-[rgba(255,255,255,0.03)] text-xs min-h-[80px]">
          {indicatorTab === 'volume' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-slate-400">
                <span>Latest Vol: {data[data.length - 1]?.volume.toLocaleString()} shares</span>
                <span>Avg Vol (20): {(data.slice(-20).reduce((acc, curr) => acc + curr.volume, 0) / 20).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <p className="text-slate-500 leading-relaxed mt-1">
                Volume spikes denote institutional interest. Tying price breakouts with above-average volume yields higher signal success probability.
              </p>
            </div>
          )}

          {indicatorTab === 'rsi' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Current RSI:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${
                  (data[data.length - 1]?.rsi ?? 50) <= 30 
                    ? 'text-emerald-400 bg-emerald-950/20' 
                    : (data[data.length - 1]?.rsi ?? 50) >= 70 
                    ? 'text-rose-400 bg-rose-950/20' 
                    : 'text-blue-400'
                }`}>
                  {data[data.length - 1]?.rsi?.toFixed(2) ?? 'N/A'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative mt-1">
                {/* Oversold boundary 30% */}
                <div className="absolute left-[30%] right-[30%] top-0 bottom-0 bg-slate-700/60" />
                <div 
                  className="absolute top-0 bottom-0 bg-blue-500 w-2 h-2 rounded-full transition-all duration-300"
                  style={{ left: `${data[data.length - 1]?.rsi ?? 50}%`, transform: 'translateX(-50%)' }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>30 (Oversold)</span>
                <span>50 (Mid)</span>
                <span>70 (Overbought)</span>
              </div>
            </div>
          )}

          {indicatorTab === 'macd' && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 text-slate-400">
                <div>MACD: <span className="font-semibold text-slate-200">{data[data.length - 1]?.macd_line?.toFixed(3) ?? 'N/A'}</span></div>
                <div>Signal: <span className="font-semibold text-slate-200">{data[data.length - 1]?.macd_signal?.toFixed(3) ?? 'N/A'}</span></div>
                <div>Hist: <span className={`font-semibold ${
                  (data[data.length - 1]?.macd_hist ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>{data[data.length - 1]?.macd_hist?.toFixed(3) ?? 'N/A'}</span></div>
              </div>
              <p className="text-slate-500 mt-1 leading-relaxed">
                MACD crossovers denote shifts in momentum. Crossovers matching Dow Theory trends yield high-confidence entry trigger markers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
