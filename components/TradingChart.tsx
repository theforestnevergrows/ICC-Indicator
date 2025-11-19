
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CrosshairMode } from 'lightweight-charts';
import { MarketSnapshot, CandleData } from '../types';

const CHART_HEIGHT = 500;

// Initial Defaults
const DEFAULT_SYMBOL = 'BTCUSDT';
const DEFAULT_TIMEFRAME = '1h';

// Mapping user-friendly names to Binance Spot Symbols
const SYMBOL_PROXY: Record<string, string> = {
  'XAUUSD': 'PAXGUSDT', // Gold Proxy
  'GOLD': 'PAXGUSDT',
  'EURUSD': 'EURUSDT',
  'GBPUSD': 'GBPUSDT',
  'AUDUSD': 'AUDUSDT',
  'USDCAD': 'USDCAD', // Often requires BUSD or stablecoin pairs, usually not on USDT spot. Sticking to ones that exist.
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
  'SOL': 'SOLUSDT'
};

const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

const CHART_TYPES = ['Candles', 'Area', 'Line'];

interface TradingChartProps {
  onSymbolChange?: (symbol: string) => void;
  onPriceUpdate?: (price: number) => void;
}

export interface TradingChartHandle {
  getMarketSnapshot: () => MarketSnapshot | null;
  setTimeframe: (tf: string) => void;
  setSymbol: (sym: string) => void;
  isChartReady: () => boolean;
}

const TradingChart = forwardRef<TradingChartHandle, TradingChartProps>(({ onSymbolChange, onPriceUpdate }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | ISeriesApi<"Line"> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  
  // Internal buffer to store recent candle data for the Agent
  const candleBufferRef = useRef<CandleData[]>([]);
  
  // activeSymbol is what the USER sees (e.g., XAUUSD)
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_SYMBOL);
  const [activeTimeframe, setActiveTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [activeChartType, setActiveChartType] = useState('Candles');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to get the actual API symbol (e.g., returns PAXGUSDT if input is XAUUSD)
  const getApiSymbol = (sym: string) => {
    const s = sym.toUpperCase();
    return SYMBOL_PROXY[s] || s;
  };

  // Expose Methods to Parent (Agent)
  useImperativeHandle(ref, () => ({
    getMarketSnapshot: () => {
      if (!chartRef.current) return null;
      
      try {
        // Capture the visual
        const image = chartRef.current.takeScreenshot().toDataURL('image/jpeg', 0.8);
        
        // Get the raw math (Last 5 candles)
        const recentCandles = candleBufferRef.current.slice(-5);
        
        return {
          image,
          symbol: activeSymbol,
          timeframe: activeTimeframe,
          currentPrice: currentPrice,
          recentCandles
        };
      } catch (e) {
        console.error("Snapshot failed:", e);
        return null;
      }
    },
    setTimeframe: (tf: string) => {
        if (TIMEFRAME_MAP[tf]) setActiveTimeframe(tf);
    },
    setSymbol: (sym: string) => {
        setActiveSymbol(sym.toUpperCase());
    },
    isChartReady: () => !isLoading && !error && currentPrice > 0
  }));

  // Fetch Historical Data (REST API)
  const fetchHistoricalData = async (displaySymbol: string, interval: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const apiSymbol = getApiSymbol(displaySymbol);
      const binanceInterval = TIMEFRAME_MAP[interval];

      // Using public node, handling errors gracefully
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${binanceInterval}&limit=100`
      );

      if (!response.ok) throw new Error('Symbol not found');

      const data = await response.json();

      const formattedData: CandleData[] = data.map((d: any) => ({
        time: d[0] / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        value: parseFloat(d[4]) // For Line/Area charts
      }));
      
      return formattedData;
    } catch (err: any) {
      console.warn("Fetch Historical Data Error:", err.message);
      setError(err.message === 'Failed to fetch' ? 'Network Error' : 'Invalid Symbol (Try BTCUSDT)');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Track mount status to prevent "Object is disposed" errors
    let isMounted = true;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      width: chartContainerRef.current.clientWidth,
      height: CHART_HEIGHT,
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
    });

    chartRef.current = chart;

    let series: any;
    if (activeChartType === 'Area') {
      series = chart.addAreaSeries({
        lineColor: '#06b6d4',
        topColor: 'rgba(6, 182, 212, 0.4)',
        bottomColor: 'rgba(6, 182, 212, 0.0)',
      });
    } else if (activeChartType === 'Line') {
      series = chart.addLineSeries({ color: '#06b6d4' });
    } else {
      series = chart.addCandlestickSeries({
        upColor: '#10B981',
        downColor: '#EF4444',
        borderVisible: false,
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
      });
    }
    seriesRef.current = series;

    const loadData = async () => {
      if (!isMounted) return;
      
      const data = await fetchHistoricalData(activeSymbol, activeTimeframe);
      
      if (!isMounted) return;

      if (data.length > 0) {
        candleBufferRef.current = data; // Init buffer
        if (seriesRef.current) {
          try {
             seriesRef.current.setData(data);
             chart.timeScale().fitContent();
             const lastPrice = data[data.length - 1].close;
             setCurrentPrice(lastPrice);
             if(onPriceUpdate) onPriceUpdate(lastPrice);
          } catch (e) {
             console.warn("Chart setData ignored (disposed)");
          }
        }
      }

      // Close existing socket if any
      if (socketRef.current) {
        socketRef.current.close();
      }

      const apiSymbol = getApiSymbol(activeSymbol);
      const binanceInterval = TIMEFRAME_MAP[activeTimeframe];
      
      // Websocket for live updates
      const wsUrl = `wss://stream.binance.com:9443/ws/${apiSymbol.toLowerCase()}@kline_${binanceInterval}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        if (!isMounted) return; // Safety check

        try {
            const message = JSON.parse(event.data);
            const k = message.k;

            const candle: CandleData = {
                time: k.t / 1000,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c)
            };

            // Update Series
            if (seriesRef.current) {
                const seriesData = activeChartType === 'Candles' ? candle : { ...candle, value: candle.close };
                // Wrap in try-catch to swallow "Object is disposed" if race condition occurs
                try {
                    seriesRef.current.update(seriesData);
                } catch (e) {
                    // Ignored
                }
            }
            
            // Update State & Buffer
            setCurrentPrice(candle.close);
            if(onPriceUpdate) onPriceUpdate(candle.close);
            
            // Update Buffer Logic
            const lastBuffered = candleBufferRef.current[candleBufferRef.current.length - 1];
            if (lastBuffered && lastBuffered.time === candle.time) {
                candleBufferRef.current[candleBufferRef.current.length - 1] = candle;
            } else {
                candleBufferRef.current.push(candle);
                if (candleBufferRef.current.length > 100) candleBufferRef.current.shift();
            }
        } catch (e) {
            console.warn("WS Update Error:", e);
        }
      };
      
      ws.onerror = () => {
          if (isMounted) setError("Real-time connection failed");
      };
    };

    loadData();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false; // Mark as unmounted
      window.removeEventListener('resize', handleResize);
      
      if (socketRef.current) {
        socketRef.current.onmessage = null; // Clear handler
        socketRef.current.close();
        socketRef.current = null;
      }

      // Nullify refs immediately to prevent async updates accessing them
      seriesRef.current = null;
      chartRef.current = null;

      try {
        chart.remove();
      } catch (e) {
        console.warn("Chart remove error:", e);
      }
    };
  }, [activeSymbol, activeTimeframe, activeChartType]);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm gap-4">
        
        <div className="flex items-center gap-4 flex-wrap">
          {/* Editable Symbol Input */}
          <div className="relative group">
             <input 
               type="text"
               value={activeSymbol}
               onChange={(e) => {
                 setActiveSymbol(e.target.value.toUpperCase());
                 onSymbolChange?.(e.target.value.toUpperCase());
               }}
               className="w-32 bg-slate-800 text-white font-bold py-2 px-4 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all uppercase tracking-wide placeholder-slate-600"
               placeholder="SYMBOL"
             />
             {/* Helper badge if proxying */}
             {SYMBOL_PROXY[activeSymbol] && (
                 <span className="absolute top-10 left-0 whitespace-nowrap text-[10px] text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/30">
                    Using Data: {SYMBOL_PROXY[activeSymbol]}
                 </span>
             )}
             <span className="text-[10px] text-slate-500 absolute -bottom-5 left-0 w-full truncate">
                 Try: XAUUSD, BTC, ETH
             </span>
          </div>

          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            {Object.keys(TIMEFRAME_MAP).map((tf) => (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
                  activeTimeframe === tf 
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Live Price</span>
              <div className={`flex items-center gap-2 font-mono text-xl font-black transition-colors duration-300 text-white`}>
                  {currentPrice > 0 ? (
                      <>
                        <span className="text-emerald-400 animate-pulse">●</span>
                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </>
                  ) : (
                      <span className="text-slate-500 text-sm">Loading...</span>
                  )}
              </div>
           </div>
        </div>
      </div>
      
      <div className="relative flex-1 w-full bg-slate-900">
         <div ref={chartContainerRef} className="w-full h-full" />
         
         {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
               <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Connecting to Market...</span>
               </div>
            </div>
         )}

         {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10">
                <div className="text-center">
                    <p className="text-red-400 font-bold mb-2">{error}</p>
                    <p className="text-xs text-slate-500 mb-4">Ensure the symbol exists (e.g., BTCUSDT).</p>
                    <button onClick={() => setActiveSymbol(DEFAULT_SYMBOL)} className="text-xs bg-slate-700 px-3 py-1 rounded text-white">Reset to Default</button>
                </div>
            </div>
         )}
      </div>
    </div>
  );
});

TradingChart.displayName = 'TradingChart';
export default TradingChart;
