
import { TradeExecution, AccountState, TradePosition } from "../types";

// Initial Demo Account State
const INITIAL_BALANCE = 100000; // $100k Demo Account

let accountState: AccountState = {
  balance: INITIAL_BALANCE,
  equity: INITIAL_BALANCE,
  marginUsed: 0,
  freeMargin: INITIAL_BALANCE,
  positions: []
};

// Listeners for UI updates
type Listener = (state: AccountState) => void;
const listeners: Listener[] = [];

export const subscribeToAccountUpdates = (listener: Listener) => {
  listeners.push(listener);
  listener(accountState);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
};

const notifyListeners = () => {
  listeners.forEach(l => l(accountState));
};

// Execute a trade on the Paper Account
export const executePaperTrade = (execution: TradeExecution, asset: string) => {
  if (execution.action === 'WAIT') return;

  const newPosition: TradePosition = {
    id: crypto.randomUUID(),
    ticket: Math.floor(Math.random() * 900000) + 100000,
    asset: asset,
    type: execution.action as 'BUY' | 'SELL',
    entryPrice: execution.entryPrice,
    currentPrice: execution.entryPrice, // Starts at entry
    sl: execution.stopLoss,
    tp: execution.takeProfit1, // Default to TP1
    lots: execution.lotSizeCalculation,
    openTime: Date.now(),
    pnl: 0, // Starts at 0 (ignoring spread for demo simplicity)
    status: 'OPEN'
  };

  accountState.positions.unshift(newPosition);
  accountState.marginUsed += (newPosition.entryPrice * newPosition.lots * 100) / 100; // Simplified margin
  updateEquity();
  notifyListeners();
  
  return newPosition;
};

export const closePosition = (id: string) => {
  const posIndex = accountState.positions.findIndex(p => p.id === id);
  if (posIndex === -1) return;

  const pos = accountState.positions[posIndex];
  accountState.balance += pos.pnl; // Realize PnL
  accountState.positions.splice(posIndex, 1); // Remove from open
  
  updateEquity();
  notifyListeners();
};

// Simulate Market Movement (The "Market Watcher")
// In a real app, this would come from the Live Price API
export const tickMarket = () => {
  if (accountState.positions.length === 0) return;

  accountState.positions = accountState.positions.map(pos => {
    // Random walk simulation for demo purposes
    // 50/50 chance to move up or down slightly
    const volatility = pos.entryPrice * 0.0001; 
    const move = (Math.random() - 0.5) * volatility;
    
    const newPrice = pos.currentPrice + move;
    
    // Calculate PnL: (Diff * Lots * ContractSize)
    // Standard Lot = 100,000 units
    const priceDiff = newPrice - pos.entryPrice;
    const direction = pos.type === 'BUY' ? 1 : -1;
    const pnl = priceDiff * direction * pos.lots * 100000;

    // Check SL/TP
    if (pos.type === 'BUY') {
        if (newPrice <= pos.sl) return { ...pos, currentPrice: newPrice, pnl, status: 'CLOSED', closeReason: 'SL' };
        if (newPrice >= pos.tp) return { ...pos, currentPrice: newPrice, pnl, status: 'CLOSED', closeReason: 'TP' };
    } else {
        if (newPrice >= pos.sl) return { ...pos, currentPrice: newPrice, pnl, status: 'CLOSED', closeReason: 'SL' };
        if (newPrice <= pos.tp) return { ...pos, currentPrice: newPrice, pnl, status: 'CLOSED', closeReason: 'TP' };
    }

    return { ...pos, currentPrice: newPrice, pnl };
  });

  // Filter out closed positions and add to balance
  const closed = accountState.positions.filter(p => p.status === 'CLOSED');
  closed.forEach(p => {
      accountState.balance += p.pnl;
  });
  
  // Keep only open positions
  accountState.positions = accountState.positions.filter(p => p.status === 'OPEN');
  
  updateEquity();
  notifyListeners();
};

const updateEquity = () => {
  const floatingPnL = accountState.positions.reduce((sum, p) => sum + p.pnl, 0);
  accountState.equity = accountState.balance + floatingPnL;
  accountState.freeMargin = accountState.equity - accountState.marginUsed;
};

// Start the market ticker simulation
setInterval(tickMarket, 1000);
