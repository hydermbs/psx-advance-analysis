import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries,createSeriesMarkers } from 'lightweight-charts';
import type { ISeriesApi, SeriesMarker, CandlestickData } from 'lightweight-charts';

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

export const ChartContainer: React.FC<ChartContainerProps> = ({ data = [], patterns = [], timeframe, symbol }) => {
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
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#191c1e',
      },
      grid: {
        vertLines: { color: 'rgba(15, 23, 42, 0.04)' },
        horzLines: { color: 'rgba(15, 23, 42, 0.04)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(15, 23, 42, 0.08)',
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(15, 23, 42, 0.08)',
        timeVisible: timeframe === 'int',
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#006e2f',
      downColor: '#ba1a1a',
      borderVisible: false,
      wickUpColor: '#006e2f',
      wickDownColor: '#ba1a1a',
    });
    candleSeriesRef.current = candleSeries;

    // Add Volume Series (overlaid on price chart with its own transparent scale)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#cbd5e1',
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
    ema20SeriesRef.current = chart.addSeries(LineSeries, { color: '#005321', lineWidth: 2, title: 'EMA 20' });
    ema50SeriesRef.current = chart.addSeries(LineSeries, { color: '#da9100', lineWidth: 2, title: 'EMA 50' });
    ema200SeriesRef.current = chart.addSeries(LineSeries, { color: '#ba1a1a', lineWidth: 2, title: 'EMA 200' });

    // Add Bollinger Bands
    bbUpperSeriesRef.current = chart.addSeries(LineSeries, { color: '#76777d', lineWidth: 1, lineStyle: 1, title: 'BB Upper' });
    bbMiddleSeriesRef.current = chart.addSeries(LineSeries, { color: '#c6c6cd', lineWidth: 1, lineStyle: 2, title: 'BB Middle' });
    bbLowerSeriesRef.current = chart.addSeries(LineSeries, { color: '#76777d', lineWidth: 1, lineStyle: 1, title: 'BB Lower' });

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
            color: pat.type === 'bullish' ? '#006e2f' : pat.type === 'bearish' ? '#ba1a1a' : '#76777d',
            shape: pat.type === 'bullish' ? 'arrowUp' : pat.type === 'bearish' ? 'arrowDown' : 'circle',
            text: pat.pattern,
          });
        }
      });
      createSeriesMarkers(candleSeriesRef.current, markers);
    }
  }, [data, showEma20, showEma50, showEma200, showBB, patterns, timeframe]);

  return (
    <div className="glass-panel p-5 flex flex-col gap-4 w-full" style={{ minHeight: '600px' }}>
      {/* Header controls */}
      <div className="flex items-center justify-between border-b border-outline-variant pb-3 flex-wrap gap-2">
        <div style={{ margin: '5px 5px 5px 5px' }} className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[24px]">query_stats</span>
          <h2 className="text-base font-bold tracking-tight text-on-surface">{symbol} Technical Chart</h2>
          <span className="text-[10px] bg-primary text-on-primary px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
            {timeframe === 'int' ? '15M Intraday' : '1D EOD'}
          </span>
        </div>
        
        {/* Toggle Overlays */}
        <div style={{ margin: '5px 5px 5px 5px' }} className="flex items-center gap-1.5 text-xs">
          <button
            style={{ padding: '5px 5px 5px 5px' }}
            onClick={() => setShowEma20(!showEma20)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-[0.98] ${
              showEma20 
                ? 'bg-secondary/15 border-secondary/30 text-secondary font-bold' 
                : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {showEma20 ? 'visibility' : 'visibility_off'}
            </span>
            EMA 20
          </button>
          <button
            style={{ padding: '5px 5px 5px 5px' }}
            onClick={() => setShowEma50(!showEma50)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-[0.98] ${
              showEma50 
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 font-bold' 
                : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {showEma50 ? 'visibility' : 'visibility_off'}
            </span>
            EMA 50
          </button>
          <button
            style={{ padding: '5px 5px 5px 5px' }}
            onClick={() => setShowEma200(!showEma200)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-[0.98] ${
              showEma200 
                ? 'bg-error-container border-error/20 text-error font-bold' 
                : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {showEma200 ? 'visibility' : 'visibility_off'}
            </span>
            EMA 200
          </button>
          <button
            style={{ padding: '5px 5px 5px 5px' }}
            onClick={() => setShowBB(!showBB)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-[0.98] ${
              showBB 
                ? 'bg-primary-fixed text-primary border-primary-fixed-dim font-bold' 
                : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {showBB ? 'visibility' : 'visibility_off'}
            </span>
            Bands
          </button>
        </div>
      </div>

      {/* Main chart rendering container */}
      <div ref={chartContainerRef} className="relative w-full rounded-lg overflow-hidden border border-outline-variant bg-white" />

      {/* Indicator Sub-tabs (RSI / MACD indicator views) */}
      <div style = {{alignItems: 'center', justifyContent: 'center'}}className="flex flex-col gap-2 mt-2">
        <div style={{ margin: '5px 10px 5px 10px' }} className="flex border-b border-outline-variant">
          <button
            style={{ padding: '5px 5px 5px 5px' }}
            onClick={() => setIndicatorTab('volume')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              indicatorTab === 'volume' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Volume Analysis
          </button>
          <button
            style={{ padding: '5px 10px 5px 10px' }}
            onClick={() => setIndicatorTab('rsi')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              indicatorTab === 'rsi' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            RSI (14)
          </button>
          <button
            style={{ padding: '5px 10px 5px 10px' }}
            onClick={() => setIndicatorTab('macd')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              indicatorTab === 'macd' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            MACD Histogram
          </button>
        </div>

        {/* Tab contents */}
        <div style={{ margin: '10px 5px 5px 5px' }} className="bg-surface-container-low rounded-xl p-4 border border-outline-variant text-xs min-h-[90px]">
          {indicatorTab === 'volume' && (
            <div style={{ margin: '10px 5px 5px 5px' }} className="flex flex-col gap-2">
              <div  className="flex justify-between text-on-surface font-medium tabular-nums">
                <span>Latest Vol: <strong className="text-primary">{data[data.length - 1]?.volume.toLocaleString()}</strong> shares</span>
                <span>Avg Vol (20): <strong className="text-primary">{(data.slice(-20).reduce((acc, curr) => acc + curr.volume, 0) / 20).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
              </div>
              <p className="text-on-surface-variant leading-relaxed mt-1">
                Volume spikes denote institutional interest. Tying price breakouts with above-average volume yields higher signal success probability.
              </p>
            </div>
          )}

          {indicatorTab === 'rsi' && (
            <div style={{ margin: '10px 5px 5px 5px' }} className="flex flex-col gap-2">
              <div className="flex justify-between items-center font-medium">
                <span className="text-on-surface">Current RSI (14):</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] tabular-nums ${
                  (data[data.length - 1]?.rsi ?? 50) <= 30 
                    ? 'text-secondary bg-secondary-fixed/30 border border-secondary-fixed' 
                    : (data[data.length - 1]?.rsi ?? 50) >= 70 
                    ? 'text-error bg-error-container border border-error/20' 
                    : 'text-primary bg-surface-container border border-outline-variant'
                }`}>
                  {data[data.length - 1]?.rsi?.toFixed(2) ?? 'N/A'}
                </span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden relative mt-1">
                {/* Oversold boundary 30% */}
                <div className="absolute left-[30%] right-[30%] top-0 bottom-0 bg-surface-container-high" />
                <div 
                  className="absolute top-0 bottom-0 bg-primary w-2 h-2 rounded-full transition-all duration-300"
                  style={{ left: `${data[data.length - 1]?.rsi ?? 50}%`, transform: 'translateX(-50%)' }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider">
                <span>30 (Oversold)</span>
                <span>50 (Mid)</span>
                <span>70 (Overbought)</span>
              </div>
            </div>
          )}

          {indicatorTab === 'macd' && (
            <div style={{ margin: '10px 5px 5px 5px' }} className="flex flex-col gap-2">
              <div className="grid grid-cols-3 text-on-surface font-medium tabular-nums gap-4">
                <div>MACD: <span className="font-bold text-primary">{data[data.length - 1]?.macd_line?.toFixed(3) ?? 'N/A'}</span></div>
                <div>Signal: <span className="font-bold text-primary">{data[data.length - 1]?.macd_signal?.toFixed(3) ?? 'N/A'}</span></div>
                <div>Hist: <span className={`font-bold ${
                  (data[data.length - 1]?.macd_hist ?? 0) >= 0 ? 'text-secondary' : 'text-error'
                }`}>{data[data.length - 1]?.macd_hist?.toFixed(3) ?? 'N/A'}</span></div>
              </div>
              <p className="text-on-surface-variant mt-1 leading-relaxed">
                MACD crossovers denote shifts in momentum. Crossovers matching Dow Theory trends yield high-confidence entry trigger markers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
