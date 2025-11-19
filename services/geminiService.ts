
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, Sentiment, MarketSnapshot, MultiFrameSnapshot } from "../types";

const getFileBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result as string;
      encoded = encoded.replace(/^data:(.*,)?/, '');
      if ((encoded.length % 4) > 0) {
        encoded += '='.repeat(4 - (encoded.length % 4));
      }
      resolve(encoded);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Defines the exact structure we need for the UI display
const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    assetName: { type: Type.STRING },
    currentPrice: { type: Type.NUMBER },
    sentiment: { type: Type.STRING, enum: [Sentiment.BULLISH, Sentiment.BEARISH, Sentiment.NEUTRAL, Sentiment.UNCERTAIN] },
    confluenceScore: { type: Type.INTEGER },
    iccStructure: {
      type: Type.OBJECT,
      properties: {
        impulse: { type: Type.OBJECT, properties: { phase: { type: Type.STRING }, description: { type: Type.STRING }, status: { type: Type.STRING } } },
        correction: { type: Type.OBJECT, properties: { phase: { type: Type.STRING }, description: { type: Type.STRING }, status: { type: Type.STRING } } },
        continuation: { type: Type.OBJECT, properties: { phase: { type: Type.STRING }, description: { type: Type.STRING }, status: { type: Type.STRING } } }
      }
    },
    keyLevels: { type: Type.ARRAY, items: { type: Type.STRING } },
    iccAnalysis: { type: Type.STRING },
    fundamentals: {
      type: Type.OBJECT,
      properties: { newsEvents: { type: Type.ARRAY, items: { type: Type.STRING } }, economicBias: { type: Type.STRING }, institutionalSentiment: { type: Type.STRING } }
    },
    execution: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ["BUY", "SELL", "WAIT"] },
        orderType: { type: Type.STRING },
        entryPrice: { type: Type.NUMBER },
        stopLoss: { type: Type.NUMBER },
        takeProfit1: { type: Type.NUMBER },
        takeProfit2: { type: Type.NUMBER },
        riskRewardRatio: { type: Type.NUMBER },
        suggestedLeverage: { type: Type.NUMBER },
        lotSizeCalculation: { type: Type.NUMBER },
        confidenceScore: { type: Type.NUMBER },
        invalidationLevel: { type: Type.NUMBER }
      },
      required: ["action", "confidenceScore"]
    },
    tradeSetup: {
      type: Type.OBJECT,
      properties: { bias: { type: Type.STRING }, invalidation: { type: Type.STRING }, confirmation: { type: Type.STRING } }
    },
  },
  required: ["assetName", "execution", "iccAnalysis"]
};

const getMarketVerification = async (symbol: string, ai: GoogleGenAI): Promise<string> => {
  try {
    // Map proxies for Search
    let searchSymbol = symbol;
    if (symbol.includes('PAXG')) searchSymbol = 'XAUUSD Gold Price';
    if (symbol.includes('EURUSDT')) searchSymbol = 'EURUSD Forex Price';

    // console.log(`🔍 Verifying ${searchSymbol} with Gemini Search Grounding...`);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find the CURRENT LIVE price of ${searchSymbol}. Also check for any major news impacting it today.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    
    const text = response.text || "No search data available.";
    return text;
  } catch (e) {
    console.warn("⚠️ Search verification failed (Network/API Error):", e);
    return "Live market verification unavailable due to network error.";
  }
};

// Main function for manual uploads
export const analyzeCharts = async (
  images: { label: string; file: File | null; base64Data?: string }[],
  marketContext?: { symbol: string; price: number }
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];

  let verificationContext = "";
  if (marketContext?.symbol) {
      verificationContext = await getMarketVerification(marketContext.symbol, ai);
  }

  const instruction = `
    You are an expert Forex & Crypto Trading Analyst specializing in ICC (Impulse-Correction-Continuation).
    
    LIVE MARKET CONTEXT:
    - Asset: ${marketContext?.symbol || "Unknown"}
    - Current Live Price: ${marketContext?.price || "Unknown"}
    - Google Search Verification: ${verificationContext}
    
    IMPORTANT: If the Asset is "PAXGUSDT", treat it exactly as "XAUUSD" (Gold).
    
    YOUR TASK:
    1. Analyze the provided chart images (HTF, MTF, LTF).
    2. CROSS-REFERENCE the chart patterns with the "Live Search Verification" data. 
    3. Analyze the Price Action for ICC Structure.
    4. Provide a strict TRADE DECISION (BUY, SELL, or WAIT).

    OUTPUT FORMAT:
    Return ONLY valid JSON matching the schema.
  `;

  parts.push({ text: instruction });

  for (const img of images) {
    let data = "";
    if (img.base64Data) {
      data = img.base64Data;
    } else if (img.file) {
      data = await getFileBase64(img.file);
    }
    
    if (data) {
      parts.push({ text: `[Image: ${img.label}]` });
      parts.push({ inlineData: { mimeType: "image/jpeg", data: data } });
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
      },
    });

    if (!response.text) throw new Error("No response generated.");
    
    const parsed = JSON.parse(response.text);
    
    return {
        ...parsed,
        assetName: marketContext?.symbol || parsed.assetName,
        currentPrice: parsed.currentPrice || marketContext?.price || 0,
        execution: {
            action: parsed.execution?.action || 'WAIT',
            confidenceScore: parsed.execution?.confidenceScore || 0,
            entryPrice: parsed.execution?.entryPrice || marketContext?.price || 0,
            stopLoss: parsed.execution?.stopLoss || 0,
            takeProfit1: parsed.execution?.takeProfit1 || 0,
            ...parsed.execution
        }
    } as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze charts. Please ensure you uploaded a valid trading chart.");
  }
};

/**
 * MULTI-TIMEFRAME AGENT ANALYSIS (SCALPING ENABLED)
 */
export const analyzeMultiTimeframeAgent = async (
    data: MultiFrameSnapshot,
    options: { skipGrounding?: boolean } = {}
): Promise<AnalysisResult> => {
    if (!process.env.API_KEY) throw new Error("API Key is missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 1. Google Grounding (Optional: Skipped for High-Frequency Scalping to save Quota)
    let searchVerification = "Skipped for High-Frequency Scan";
    if (!options.skipGrounding) {
        searchVerification = await getMarketVerification(data.symbol, ai);
    }

    // 2. Format Candle Data for prompt
    const htfCandles = data.htf.recentCandles.map(c => `HTF 4H: C:${c.close}`).join(', ');
    const ltfCandles = data.ltf.recentCandles.map(c => `MTF 15m: C:${c.close}`).join(', ');
    const vltfCandles = data.vltf.recentCandles.map(c => `SCALP 1m: C:${c.close}`).join(', ');

    const instruction = `
      ACT AS AN AUTONOMOUS SCALPING AI.
      
      LIVE DATA:
      - Symbol: ${data.symbol} (Assume XAUUSD if PAXGUSDT)
      - Chart Price: ${data.livePrice}
      - Note: If user quotes a higher price (e.g. 4000+), ignore it for visual pattern analysis. Trust the provided chart structure.

      INPUTS:
      1. [HTF]: 4H Chart - Trend Direction.
      2. [MTF]: 15m Chart - Structure (ICC).
      3. [SCALP]: 1m Chart - Immediate Trigger.
      
      RECENT CLOSES:
      ${htfCandles}
      ${ltfCandles}
      ${vltfCandles}

      STRATEGY (SCALPING + ICC):
      - HTF must show Clear Trend or Rejection.
      - MTF must be in Correction or Impulse phase.
      - SCALP (1m) must show a breakout or engulfing candle in direction of HTF.
      
      DECISION RULES:
      - If 1m is flat/choppy -> WAIT.
      - If 1m aligns with 4H trend -> EXECUTE.
      - Provide 1:2 Risk/Reward targets based on 1m/15m structure.
    `;

    const parts = [
        { text: instruction },
        { text: "[HTF 4H SNAPSHOT]" },
        { inlineData: { mimeType: "image/jpeg", data: data.htf.image.replace(/^data:(.*,)?/, '') } },
        { text: "[MTF 15m SNAPSHOT]" },
        { inlineData: { mimeType: "image/jpeg", data: data.ltf.image.replace(/^data:(.*,)?/, '') } },
        { text: "[SCALP 1m SNAPSHOT]" },
        { inlineData: { mimeType: "image/jpeg", data: data.vltf.image.replace(/^data:(.*,)?/, '') } }
    ];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: ANALYSIS_SCHEMA,
            }
        });

        if (!response.text) throw new Error("Empty response from AI");

        const parsed = JSON.parse(response.text);
        
        return {
            ...parsed,
            assetName: data.symbol,
            currentPrice: data.livePrice,
            searchPrice: 0, 
            execution: {
                ...parsed.execution,
                entryPrice: data.livePrice 
            }
        } as AnalysisResult;

    } catch (e: any) {
        // Catch rate limit errors specifically
        if (e.toString().includes("429") || e.message?.includes("429") || e.status === "RESOURCE_EXHAUSTED") {
           throw new Error("RATE_LIMIT");
        }
        console.error("Agent Multi-Frame Analysis Failed", e);
        throw new Error("Agent failed to correlate timeframes. Please check chart data.");
    }
};

export const analyzeAgentSnapshot = async (
    snapshot: MarketSnapshot
): Promise<AnalysisResult> => {
    return analyzeMultiTimeframeAgent({
        htf: snapshot,
        ltf: snapshot,
        vltf: snapshot,
        livePrice: snapshot.currentPrice,
        symbol: snapshot.symbol
    });
}
