
import React, { useEffect, useState } from 'react';

interface TickerItem {
  symbol: string;
  displayPair: string;
  price: string;
  changePercent: string;
  up: boolean;
}

// Mapping Binance symbols to display names.
// Using USDT pairs. PAXG is a gold-backed token, EUR/GBP are forex proxies.
const SYMBOL_MAP: Record<string, string> = {
  'BTCUSDT': 'BTC/USD',
  'ETHUSDT': 'ETH/USD',
  'PAXGUSDT': 'XAU/USD', // Gold Proxy
  'EURUSDT': 'EUR/USD',
  'GBPUSDT': 'GBP/USD',
  'SOLUSDT': 'SOL/USD',
  'XRPUSDT': 'XRP/USD',
  'BNBUSDT': 'BNB/USD',
  'ADAUSDT': 'ADA/USD',
  'DOGEUSDT': 'DOGE/USD',
};

const MarketTicker: React.FC = () => {
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // data is an array of all mini-tickers
        if (!Array.isArray(data)) return;

        const updates: Record<string, TickerItem> = {};

        data.forEach((ticker: any) => {
          const symbol = ticker.s;
          if (SYMBOL_MAP[symbol]) {
            const currentPrice = parseFloat(ticker.c);
            const openPrice = parseFloat(ticker.o);
            const changeRaw = ((currentPrice - openPrice) / openPrice) * 100;
            
            updates[symbol] = {
              symbol: symbol,
              displayPair: SYMBOL_MAP[symbol],
              price: currentPrice < 10 ? currentPrice.toFixed(4) : currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              changePercent: `${changeRaw > 0 ? '+' : ''}${changeRaw.toFixed(2)}%`,
              up: changeRaw >= 0
            };
          }
        });

        setTickerData((prev) => {
          // Merge updates with previous state to maintain order and prevent flickering of missing items in a partial update
          // However, !miniTicker@arr usually sends all active pairs.
          
          // If prev is empty, just convert updates values to array and sort
          if (prev.length === 0) {
             const items = Object.values(updates);
             return sortTickers(items);
          }

          // Update existing items
          const nextState = prev.map(item => updates[item.symbol] || item);
          
          // Add any new items that weren't in state yet (rare case after init)
          const existingSymbols = new Set(prev.map(p => p.symbol));
          Object.values(updates).forEach(u => {
            if (!existingSymbols.has(u.symbol)) {
                nextState.push(u);
            }
          });

          return nextState;
        });

      } catch (e) {
        console.error("Ticker parse error", e);
      }
    };

    ws.onclose = () => setIsConnected(false);

    return () => {
      ws.close();
    };
  }, []);

  const sortTickers = (items: TickerItem[]) => {
    const order = Object.keys(SYMBOL_MAP);
    return items.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));
  };

  // Fallback initial loading state or duplicate data for marquee
  const displayData = tickerData.length > 0 ? tickerData : Object.keys(SYMBOL_MAP).map(s => ({
    symbol: s,
    displayPair: SYMBOL_MAP[s],
    price: '---',
    changePercent: '0.00%',
    up: true
  }));

  return (
    <div className="w-full bg-slate-950 border-b border-slate-800 h-10 flex items-center overflow-hidden whitespace-nowrap relative z-40">
      {!isConnected && tickerData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50 text-[10px] text-slate-500 uppercase tracking-widest">
              Connecting to Global Markets...
          </div>
      )}
      
      <div className="flex items-center animate-marquee hover:pause-animation">
        {/* Triplicated list for seamless infinite scroll */}
        {[...displayData, ...displayData, ...displayData].map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="flex items-center mx-6 text-xs font-mono cursor-default hover:bg-slate-800 px-3 py-1 rounded transition-colors border border-transparent hover:border-slate-700">
            <span className="text-slate-400 font-bold mr-2">{item.displayPair}</span>
            <span className="text-white font-medium mr-3">{item.price}</span>
            <span className={`${item.up ? 'text-emerald-400' : 'text-red-400'} flex items-center font-bold`}>
              {item.up ? '▲' : '▼'} {item.changePercent}
            </span>
          </div>
        ))}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .hover\\:pause-animation:hover {
          animation-play-state: paused;
        }
      `}} />
    </div>
  );
};

export default MarketTicker;
