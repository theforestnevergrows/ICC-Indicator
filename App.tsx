
import React, { useState, useRef, useEffect } from 'react';
import { TimeframeLabel, ImageInput, AnalysisResult, AgentStatus, AgentConfig, AgentLog, MarketSnapshot, CandleData } from './types';
import FileUpload from './components/FileUpload';
import AnalysisView from './components/AnalysisView';
import MarketTicker from './components/MarketTicker';
import TradingChart, { TradingChartHandle } from './components/TradingChart';
import AgentPanel from './components/AgentPanel';
import { analyzeCharts, analyzeMultiTimeframeAgent } from './services/geminiService';

const App: React.FC = () => {
  // --- Standard Manual Analysis State ---
  const [images, setImages] = useState<Record<TimeframeLabel, ImageInput | null>>({
    [TimeframeLabel.HTF]: null,
    [TimeframeLabel.MTF]: null,
    [TimeframeLabel.LTF]: null,
    [TimeframeLabel.LIVE]: null,
  });
  // Default to XAUUSD as requested
  const [activeSymbol, setActiveSymbol] = useState('XAUUSD');
  const [livePrice, setLivePrice] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Agent Simulation State ---
  const chartRef = useRef<TradingChartHandle>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('IDLE');
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    isActive: false,
    intervalSeconds: 60, // Increased to 60s to prevent Rate Limits (429)
    minConfidence: 75,
    riskPerTrade: 1
  });
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const agentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Manual Analysis Handlers ---
  const handleFileSelect = (label: TimeframeLabel, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImages(prev => ({
        ...prev,
        [label]: {
          id: crypto.randomUUID(),
          file,
          previewUrl: e.target?.result as string,
          label
        }
      }));
      setAnalysisResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (label: TimeframeLabel) => {
    setImages(prev => ({ ...prev, [label]: null }));
    setAnalysisResult(null);
  };

  const handleManualAnalyze = async () => {
    const activeImages = (Object.values(images) as (ImageInput | null)[]).filter(
        (img): img is ImageInput => img !== null && img.label !== TimeframeLabel.LIVE
    );

    if (activeImages.length === 0) {
      setError("Please upload at least one chart screenshot to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const serviceImages = activeImages.map(img => ({ label: img.label, file: img.file }));
      const result = await analyzeCharts(
        serviceImages, 
        { symbol: activeSymbol, price: livePrice }
      );
      setAnalysisResult(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Agent Simulation Handlers ---

  const addAgentLog = (message: string, type: AgentLog['type'] = 'INFO') => {
    const newLog: AgentLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setAgentLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const toggleAgent = () => {
    setAgentConfig(prev => ({ ...prev, isActive: !prev.isActive }));
  };

  // Agent Loop Effect
  useEffect(() => {
    if (agentConfig.isActive) {
      addAgentLog("Agent Activated. Initializing Multi-Timeframe Scan (Scalping Mode)...", 'INFO');
      // Start first cycle immediately
      runAgentCycle();
      agentTimerRef.current = setInterval(runAgentCycle, agentConfig.intervalSeconds * 1000);
    } else {
      if (agentTimerRef.current) clearInterval(agentTimerRef.current);
      setAgentStatus('IDLE');
      addAgentLog("Agent Deactivated.", 'WARNING');
    }

    return () => {
      if (agentTimerRef.current) clearInterval(agentTimerRef.current);
    };
  }, [agentConfig.isActive]);

  // Helper to switch frame and wait for render
  const captureFrame = async (tf: string): Promise<MarketSnapshot | null> => {
    if (!chartRef.current) return null;
    
    chartRef.current.setTimeframe(tf);
    
    // Wait for data fetch & render (Simulated wait, chart component handles async fetch)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Ensure chart reports ready
    if (!chartRef.current.isChartReady()) {
        addAgentLog(`Waiting for ${tf} chart data...`, 'WARNING');
        await new Promise(resolve => setTimeout(resolve, 1500)); // retry wait
    }
    
    return chartRef.current.getMarketSnapshot();
  };

  // --- QUOTA OPTIMIZATION: LOCAL ANALYSIS ---
  // Calculates if the market is moving enough to warrant an API call
  const isMarketActive = (candles: CandleData[]): boolean => {
    if (candles.length < 3) return true; // Not enough data, scan anyway
    
    const ranges = candles.map(c => (c.high - c.low) / c.open);
    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    
    // If volatility is extremely low (e.g. < 0.015%), skip analysis
    // Slightly strict to save quota
    const threshold = 0.00015; 
    return avgRange > threshold;
  };

  const runAgentCycle = async () => {
    if (agentStatus === 'EXECUTING' || !chartRef.current) return;

    try {
      // --- STEP 1: Scan HTF (4H) ---
      setAgentStatus('SCANNING HTF');
      const htfSnapshot = await captureFrame('4h');
      if (!htfSnapshot) throw new Error("Failed to capture HTF");

      // --- STEP 2: Scan MTF (15m) ---
      setAgentStatus('SCANNING MTF');
      const ltfSnapshot = await captureFrame('15m');
      if (!ltfSnapshot) throw new Error("Failed to capture MTF");

      // --- STEP 3: Scan 1m (Scalp) ---
      setAgentStatus('SCANNING 1m');
      const vltfSnapshot = await captureFrame('1m');
      if (!vltfSnapshot) throw new Error("Failed to capture 1m");

      // --- PRE-FLIGHT CHECK (SAVE QUOTA) ---
      const isActive = isMarketActive(vltfSnapshot.recentCandles);
      if (!isActive) {
          addAgentLog("Market Flat (Low Volatility). Skipping API Call to save quota.", 'WARNING');
          setAgentStatus('COOLDOWN');
          // Reset view
          setTimeout(() => chartRef.current?.setTimeframe('15m'), 1000);
          return;
      }

      // --- STEP 4: Analyze Confluence ---
      setAgentStatus('ANALYZING');
      addAgentLog(`Analyzing Confluence (1m/15m/4H) for ${activeSymbol}...`, 'INFO');

      const result = await analyzeMultiTimeframeAgent({
          htf: htfSnapshot,
          ltf: ltfSnapshot,
          vltf: vltfSnapshot,
          livePrice: vltfSnapshot.currentPrice,
          symbol: activeSymbol
      }, { skipGrounding: true }); // TRUE to save quota (High Frequency Mode)
      
      // Update main view
      setAnalysisResult(result);

      // --- STEP 5: Execution Logic ---
      if (result.execution.action !== 'WAIT') {
         if (result.execution.confidenceScore >= agentConfig.minConfidence) {
            setAgentStatus('EXECUTING');
            addAgentLog(`SCALP SIGNAL: ${result.execution.action} @ ${result.execution.entryPrice} (Conf: ${result.execution.confidenceScore}%)`, 'SUCCESS');
            
            // Reset chart to default view after trade
            setTimeout(() => chartRef.current?.setTimeframe('15m'), 2000);
         } else {
            addAgentLog(`Signal rejected: Low Confidence (${result.execution.confidenceScore}%).`, 'WARNING');
            setAgentStatus('COOLDOWN');
         }
      } else {
         addAgentLog("Structure Neutral. Waiting for setup...", 'INFO');
         setAgentStatus('COOLDOWN');
      }

    } catch (e: any) {
      // Handle Rate Limits (429) Gracefully
      if (e.message === "RATE_LIMIT") {
         addAgentLog("⚠️ Quota Limit Hit (429). Pausing Agent for 60s...", 'ERROR');
         setAgentStatus('COOLDOWN');
         
         // Force a longer delay before next cycle
         if (agentTimerRef.current) clearInterval(agentTimerRef.current);
         setTimeout(() => {
             addAgentLog("Cooldown Complete. Resuming Agent...", 'INFO');
             if (agentConfig.isActive) {
                runAgentCycle(); // One off run
                agentTimerRef.current = setInterval(runAgentCycle, agentConfig.intervalSeconds * 1000);
             }
         }, 60000); 
         
         return;
      }

      addAgentLog(`Agent Error: ${e.message}`, 'ERROR');
      setAgentStatus('COOLDOWN');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 font-sans selection:bg-cyan-500 selection:text-white flex flex-col">
      <MarketTicker />

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-8">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 via-cyan-500 to-blue-500 bg-clip-text text-transparent">
              ICC TERMINAL
            </h1>
            <p className="text-slate-400 mt-2 text-sm">AI-Powered Multi-Timeframe Autonomous Agent</p>
          </div>
        </header>

        <main className="flex flex-col lg:flex-row gap-6">
          
          {/* LEFT COLUMN: Chart & Manual Controls (66%) */}
          <div className="flex-1 space-y-6 lg:w-2/3">
            
            {/* Live Chart Section */}
            <section className="animate-slide-up">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Live Simulation Feed</h2>
                  {livePrice > 0 && (
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                          ● {activeSymbol} Live
                      </span>
                  )}
              </div>
              <TradingChart 
                  ref={chartRef}
                  onSymbolChange={setActiveSymbol}
                  onPriceUpdate={setLivePrice}
              />
            </section>

            {/* Manual Upload Section */}
            <section className="animate-slide-up bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Manual Structure Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FileUpload 
                  label={TimeframeLabel.HTF} 
                  description="Direction (4H/Daily)"
                  imagePreview={images.HTF?.previewUrl || null}
                  onFileSelect={handleFileSelect}
                  onRemove={handleRemoveImage}
                  disabled={isAnalyzing || agentConfig.isActive}
                />
                <FileUpload 
                  label={TimeframeLabel.MTF} 
                  description="Pattern (1H/15m)"
                  imagePreview={images.MTF?.previewUrl || null}
                  onFileSelect={handleFileSelect}
                  onRemove={handleRemoveImage}
                  disabled={isAnalyzing || agentConfig.isActive}
                />
                <FileUpload 
                  label={TimeframeLabel.LTF} 
                  description="Trigger (5m/1m)"
                  imagePreview={images.LTF?.previewUrl || null}
                  onFileSelect={handleFileSelect}
                  onRemove={handleRemoveImage}
                  disabled={isAnalyzing || agentConfig.isActive}
                />
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleManualAnalyze}
                  disabled={isAnalyzing || agentConfig.isActive}
                  className={`
                      px-8 py-3 rounded-lg font-bold uppercase tracking-widest text-xs transition-all transform
                      ${isAnalyzing || agentConfig.isActive
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                          : 'bg-slate-700 hover:bg-slate-600 text-white shadow-lg hover:scale-105'}
                  `}
                >
                  {isAnalyzing ? 'Scanning...' : 'Run Manual Scan'}
                </button>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Agent & Results (33%) */}
          <div className="lg:w-1/3 space-y-6 flex flex-col">
             
             {/* Agent Panel */}
             <AgentPanel 
                status={agentStatus}
                logs={agentLogs}
                config={agentConfig}
                onToggle={toggleAgent}
                onClearLogs={() => setAgentLogs([])}
             />

             {/* Results View (Used for both Agent & Manual) */}
             {analysisResult && (
                <div className="animate-slide-up">
                  <AnalysisView 
                      result={analysisResult} 
                      autoExecute={agentConfig.isActive} // Auto-execute if Agent is running
                      lastScannedFrame={agentConfig.isActive && chartRef.current?.getMarketSnapshot()?.image}
                  />
                </div>
             )}
          </div>

        </main>
      </div>
    </div>
  );
};

export default App;
