
import React from 'react';
import { AgentStatus, AgentLog, AgentConfig } from '../types';

interface AgentPanelProps {
  status: AgentStatus;
  logs: AgentLog[];
  config: AgentConfig;
  onToggle: () => void;
  onClearLogs: () => void;
}

const AgentPanel: React.FC<AgentPanelProps> = ({ status, logs, config, onToggle, onClearLogs }) => {
  
  const getStatusColor = () => {
    switch (status) {
      case 'SCANNING HTF': return 'text-blue-400 border-blue-500 shadow-blue-500/20';
      case 'SCANNING MTF': return 'text-cyan-400 border-cyan-500 shadow-cyan-500/20';
      case 'SCANNING LTF': return 'text-teal-400 border-teal-500 shadow-teal-500/20';
      case 'SCANNING 1m': return 'text-pink-400 border-pink-500 shadow-pink-500/20';
      case 'ANALYZING': return 'text-purple-400 border-purple-500 shadow-purple-500/20';
      case 'EXECUTING': return 'text-emerald-400 border-emerald-500 shadow-emerald-500/20';
      case 'COOLDOWN': return 'text-amber-400 border-amber-500 shadow-amber-500/20';
      default: return 'text-slate-500 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col h-[400px]">
      {/* Agent Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-sm">
         <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${config.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
            <div>
               <h3 className="text-sm font-bold text-white uppercase tracking-widest">ICC Agent-01</h3>
               <p className="text-[10px] text-slate-500">Multi-Frame Autonomous Engine</p>
            </div>
         </div>

         <div className="flex items-center gap-3">
             <div className={`px-3 py-1 rounded border text-[10px] font-mono font-bold uppercase shadow-lg transition-all duration-500 ${getStatusColor()}`}>
               {status}
             </div>
             
             <button 
               onClick={onToggle}
               className={`
                 px-4 py-2 rounded font-bold text-xs uppercase transition-all
                 ${config.isActive 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30'}
               `}
             >
               {config.isActive ? 'Stop Agent' : 'Activate'}
             </button>
         </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 flex flex-col p-4 font-mono text-xs relative overflow-hidden">
         {/* Scan Line Animation */}
         {config.isActive && (
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/20 z-0 animate-[scan_2s_linear_infinite]"></div>
         )}

         {/* Logs Area */}
         <div className="flex-1 overflow-y-auto space-y-2 z-10 pr-2 scrollbar-thin">
             {logs.length === 0 && (
                <div className="text-slate-600 italic text-center mt-20">System Idle. Activate to begin simulation...</div>
             )}
             
             {logs.map((log) => (
               <div key={log.id} className="flex gap-2 animate-fade-in">
                  <span className="text-slate-600">[{log.timestamp}]</span>
                  <span className={`font-bold
                    ${log.type === 'INFO' ? 'text-cyan-300' : 
                      log.type === 'SUCCESS' ? 'text-emerald-400' : 
                      log.type === 'WARNING' ? 'text-amber-400' : 'text-red-400'}
                  `}>
                    {log.type === 'INFO' && 'ℹ'}
                    {log.type === 'SUCCESS' && '✓'}
                    {log.type === 'WARNING' && '⚠'}
                    {log.type === 'ERROR' && '✕'}
                  </span>
                  <span className="text-slate-300">{log.message}</span>
               </div>
             ))}
             {/* Anchor for auto-scroll */}
             <div style={{ float:"left", clear: "both" }}></div>
         </div>
      </div>

      {/* Footer Stats */}
      <div className="p-2 bg-slate-900 border-t border-slate-800 flex justify-between text-[10px] text-slate-500">
          <button onClick={onClearLogs} className="hover:text-white">Clear Terminal</button>
          <div className="flex gap-4">
             <span>Interval: {config.intervalSeconds}s</span>
             <span>Min Conf: {config.minConfidence}%</span>
          </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}} />
    </div>
  );
};

export default AgentPanel;
