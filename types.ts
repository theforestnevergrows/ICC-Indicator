
export enum Sentiment {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
  UNCERTAIN = 'UNCERTAIN'
}

export interface FundamentalData {
  newsEvents: string[];
  economicBias: string;
  institutionalSentiment: string;
}

export interface ICCPhase {
  phase: 'IMPULSE' | 'CORRECTION' | 'CONTINUATION' | 'UNDEFINED';
  description: string;
  status: 'COMPLETE' | 'DEVELOPING' | 'FAILED';
}

export interface TradeExecution {
  action: 'BUY' | 'SELL' | 'WAIT';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  suggestedLeverage: number;
  lotSizeCalculation: number;
  confidenceScore: number;
  invalidationLevel: number;
}

export interface AnalysisResult {
  assetName: string;
  currentPrice: number;
  sentiment: Sentiment;
  confluenceScore: number;
  iccStructure: {
    impulse: ICCPhase;
    correction: ICCPhase;
    continuation: ICCPhase;
  };
  keyLevels: string[];
  iccAnalysis: string;
  fundamentals: FundamentalData;
  execution: TradeExecution;
  tradeSetup: {
    bias: string;
    invalidation: string;
    confirmation: string;
  };
  searchPrice?: number;
}

export enum TimeframeLabel {
  HTF = 'HTF',
  MTF = 'MTF',
  LTF = 'LTF',
  LIVE = 'LIVE'
}

export interface ImageInput {
  id: string;
  file: File | null; 
  base64Data?: string;
  frames?: string[];
  previewUrl: string;
  label: TimeframeLabel;
}

export interface BridgeConfig {
  webhookUrl: string;
  apiKey: string;
  isEnabled: boolean;
}

// --- Paper Trading Types ---

export interface TradePosition {
  id: string;
  ticket: number;
  asset: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  lots: number;
  openTime: number;
  pnl: number;
  status: 'OPEN' | 'CLOSED';
  closeReason?: 'TP' | 'SL' | 'MANUAL';
}

export interface AccountState {
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  positions: TradePosition[];
}

// --- AI Agent Types ---

export type AgentStatus = 'IDLE' | 'SCANNING HTF' | 'SCANNING MTF' | 'SCANNING LTF' | 'SCANNING 1m' | 'ANALYZING' | 'EXECUTING' | 'COOLDOWN';

export interface AgentConfig {
  isActive: boolean;
  intervalSeconds: number; // How often to scan
  minConfidence: number;  // Min confidence to execute
  riskPerTrade: number;   // % of balance
}

export interface AgentLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
}

// --- Precision Data Types ---

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketSnapshot {
  image: string; // Base64 image
  symbol: string;
  timeframe: string;
  currentPrice: number;
  recentCandles: CandleData[]; // Last 5 candles for math verification
}

export interface MultiFrameSnapshot {
  htf: MarketSnapshot;
  ltf: MarketSnapshot;
  vltf: MarketSnapshot; // 1m Scalping Frame
  livePrice: number;
  symbol: string;
}
