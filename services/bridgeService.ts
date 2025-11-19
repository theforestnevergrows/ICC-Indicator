
import { TradeExecution, BridgeConfig } from "../types";

/**
 * This service acts as the "Bridge" between the Frontend Analysis and your 
 * Trading Backend (e.g., a Python Flask app connecting to MetaTrader/cTrader).
 */

export const executeTradeOnBridge = async (
  execution: TradeExecution, 
  asset: string,
  config: BridgeConfig
): Promise<{ success: boolean; message: string; tradeId?: string }> => {
  
  // Construct the payload that a trading bot (like PineConnector or custom) expects
  const payload = {
    secret: config.apiKey,
    ticker: asset,
    action: execution.action,
    order_type: execution.orderType,
    price: execution.entryPrice,
    sl: execution.stopLoss,
    tp1: execution.takeProfit1,
    tp2: execution.takeProfit2,
    volume: execution.lotSizeCalculation,
    comment: "ICC_Strategy_AI_Exec"
  };

  console.log("🚀 [BRIDGE] Dispatching Signal to Backend:", config.webhookUrl);
  console.log("📦 [BRIDGE] Payload:", JSON.stringify(payload, null, 2));

  // SIMULATION: In a real app, this would be a fetch() call
  // const response = await fetch(config.webhookUrl, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(payload)
  // });

  return new Promise((resolve) => {
    if (!config.isEnabled) {
        resolve({ success: false, message: "Bridge is disabled in settings." });
        return;
    }

    setTimeout(() => {
      if (execution.action === 'WAIT') {
        resolve({ success: false, message: "Signal was WAIT. No trade executed." });
      } else {
        resolve({ 
            success: true, 
            message: `Order Executed: ${execution.action} ${asset} @ ${execution.entryPrice}`, 
            tradeId: `ORD-${Math.floor(Math.random() * 999999)}` 
        });
      }
    }, 2000); // Simulate network latency
  });
};
