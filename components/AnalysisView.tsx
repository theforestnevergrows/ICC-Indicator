
import React, { useState, useEffect } from 'react';
import { AnalysisResult, BridgeConfig, AccountState } from '../types';
import { executeTradeOnBridge } from '../services/bridgeService';
import { subscribeToAccountUpdates, executePaperTrade, closePosition } from '../services/paperTradingService';

interface AnalysisViewProps {
  result: AnalysisResult;
  autoExecute?: boolean; // Prop to trigger auto-trade
  lastScannedFrame?: string | null; // New prop to show the image AI saw
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ result, autoExecute, lastScannedFrame }) => {
  const [bridgeConfig, setBridgeConfig] = useState<BridgeConfig>({
    webhookUrl: 'https://api.pineconnector.net/webhook/v1/signal',
    apiKey: 'sk_live_example_key_12345',
    isEnabled: true
  });
  
  const [bridgeStatus, setBridgeStatus] = useState<'IDLE' | 'SENDING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [account, setAccount] = useState<AccountState | null>(null);
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    setTimestamp(new Date().toLocaleTimeString());
  }, [result]);

  // Subscribe to Demo Account Updates
  useEffect(() => {
    const unsubscribe = subscribeToAccountUpdates((state) => {
      setAccount({ ...state }); // copy state to force re-render
    });
    return () => unsubscribe();
  }, []);

  // Auto-Execution Logic
  useEffect(() => {
    if (autoExecute && result.execution.action !== 'WAIT' && bridgeStatus === 'IDLE') {
      handlePaperExecute();
    }
  }, [result, autoExecute]);

  const handlePaperExecute = () => {
    if (result.execution.action === 'WAIT') return;
    setBridgeStatus('SENDING');
    
    // Execute on Paper Trading Engine
    executePaperTrade(result.execution, result.assetName);
    
    setTimeout(() => {
      setBridgeStatus('SUCCESS');
    }, 500);
  };

  const MarkdownRenderer = ({ content }: { content: string }) => (
    <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-light leading-relaxed text-slate-300">
        {content.split('**').map((part, i) => 
            i % 2 === 1 ? <strong key={i} className="text-cyan-400 font-bold">{part}</strong> : part
        )}
    </div>
  );

  const isBuy = result.execution.action === 'BUY';
  const isSell = result.execution.action === 'SELL';
  const isWait = result.execution.action === 'WAIT';
  
  const actionColor = isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-slate-400';
  const actionBg = isBuy ? 'bg-emerald-500' : isSell ? 'bg-red-500' : 'bg-slate-600';

  // Helper to display price or placeholder
  const formatPrice = (price?: number) => (price && price > 0) ? price : '---';

  return (
    <div className="w-full animate-fade-in pb-20">
      
      {/* Demo Account Header */}
      {account && (
        <div className="mb-8 bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-6 items-center justify-between shadow-2xl shadow-black/50">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold">
               DEMO
             </div>
             <div>
               <div className="text-[10px] text-slate-400 uppercase tracking-widest">Equity</div>
               <div className="text-xl font-mono font-bold text-white">${account.equity.toFixed(2)}</div>
             </div>
           </div>
           
           <div className="flex gap-6">
             <div>
               <div className="text-[10px] text-slate-400 uppercase tracking-widest">Balance</div>
               <div className="font-mono text-slate-300">${account.balance.toFixed(2)}</div>
             </div>
             <div>
               <div className="text-[10px] text-slate-400 uppercase tracking-widest">P&L</div>
               <div className={`font-mono font-bold ${account.equity >= account.balance ? 'text-emerald-400' : 'text-red-400'}`}>
                 {(account.equity - account.balance).toFixed(2)}
               </div>
             </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Signal & Execution */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Last Scanned Frame (Proof of Vision) */}
          {lastScannedFrame && (
            <div className="relative group rounded-xl overflow-hidden border-2 border-slate-700 shadow-lg bg-black">
                <div className="absolute top-0 left-0 bg-black/70 text-[10px] text-cyan-400 px-2 py-1 uppercase font-bold z-10">
                    Analyzed Frame
                </div>
                <img src={lastScannedFrame} alt="AI Vision" className="w-full h-32 object-cover object-top opacity-80 hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 right-0 bg-black/80 text-[10px] text-slate-400 px-2 py-1">
                    {timestamp}
                </div>
            </div>
          )}

          {/* Signal Card */}
          <div className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.3)]
            ${isBuy ? 'bg-slate-900 border-emerald-500/50' : 
              isSell ? 'bg-slate-900 border-red-500/50' : 
              'bg-slate-900 border-slate-600'}
          `}>
             <div className="p-6">
                <div className="flex justify-between items-center mb-8">
                   <span className="text-[10px] font-mono uppercase text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">AI Decision</span>
                   <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isWait ? 'bg-slate-500' : 'animate-ping ' + actionBg}`}></span>
                      <span className={`text-sm font-black tracking-tight ${actionColor}`}>{result.execution.action}</span>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
                   <div className="space-y-1">
                      <span className="text-xs text-slate-500 uppercase block">Entry</span>
                      <span className="text-xl font-mono font-bold text-white">{formatPrice(result.execution.entryPrice)}</span>
                   </div>
                   <div className="space-y-1">
                      <span className="text-xs text-slate-500 uppercase block">SL</span>
                      <span className="text-xl font-mono font-bold text-red-400">{formatPrice(result.execution.stopLoss)}</span>
                   </div>
                </div>

                <button 
                  onClick={handlePaperExecute}
                  disabled={isWait || bridgeStatus === 'SUCCESS'}
                  className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all
                    ${isWait 
                       ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                       : bridgeStatus === 'SUCCESS'
                          ? 'bg-emerald-900 text-emerald-400 border border-emerald-500 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-400'}
                  `}
                >
                   {bridgeStatus === 'SUCCESS' ? 'Order Filled (Demo)' : 
                    isWait ? 'Monitoring Market...' : 'Execute Trade (Demo)'}
                </button>
             </div>
          </div>

          {/* Open Positions Panel */}
          {account && account.positions.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-800 text-xs font-bold uppercase text-slate-400">Open Positions</div>
              <div className="max-h-60 overflow-y-auto">
                {account.positions.map(pos => (
                  <div key={pos.id} className="p-3 border-b border-slate-800/50 hover:bg-slate-800 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${pos.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{pos.type}</span>
                        <span className="text-xs font-bold text-white">{pos.asset}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Lots: {pos.lots} @ {pos.entryPrice}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                      </div>
                      <button 
                        onClick={() => closePosition(pos.id)}
                        className="text-[10px] text-slate-500 hover:text-white underline mt-1"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Technical Analysis */}
        <div className="lg:col-span-8 space-y-6">
          {/* Confidence Meter */}
          <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex-1">
                  <div className="flex justify-between text-xs uppercase font-bold text-slate-400 mb-1">
                      <span>AI Confidence</span>
                      <span>{result.execution.confidenceScore}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-1000 ${result.execution.confidenceScore > 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                        style={{ width: `${result.execution.confidenceScore}%` }}
                      ></div>
                  </div>
              </div>
              <div className="text-right pl-4 border-l border-slate-700">
                   <div className="text-xs text-slate-500">Asset</div>
                   <div className="font-bold text-white">{result.assetName || 'Scanning...'}</div>
              </div>
              <div className="text-right pl-4 border-l border-slate-700">
                   <div className="text-xs text-slate-500">Bias</div>
                   <div className={`font-bold ${result.execution.action === 'BUY' ? 'text-emerald-400' : result.execution.action === 'SELL' ? 'text-red-400' : 'text-slate-400'}`}>
                     {result.tradeSetup?.bias || 'Neutral'}
                   </div>
              </div>
          </div>

          {/* ICC Phases Visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {['impulse', 'correction', 'continuation'].map((phase) => {
                const p = result.iccStructure?.[phase as keyof typeof result.iccStructure];
                const isActive = p?.status === 'COMPLETE';
                return (
                  <div key={phase} className={`relative border rounded-xl p-4 ${isActive ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                     <div className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-70 flex justify-between">
                        {phase} Phase
                        {isActive && <span className="text-emerald-400">✓</span>}
                     </div>
                     <div className={`text-sm font-bold mb-1 capitalize ${isActive ? 'text-white' : 'text-slate-500'}`}>
                        {p?.status || 'Pending'}
                     </div>
                  </div>
                );
             })}
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-lg">
             <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-700">
                <span className="text-lg mr-2">👁️</span>
                <span className="text-sm font-bold uppercase tracking-widest text-cyan-400">Visual Analysis Log</span>
             </div>
             <MarkdownRenderer content={result.iccAnalysis || 'Waiting for clear chart data...'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
