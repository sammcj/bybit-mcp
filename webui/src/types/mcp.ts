/**
 * TypeScript types for MCP (Model Context Protocol) server integration
 */

// Base MCP types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

// Tool definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Bybit-specific types
export interface BybitCategory {
  spot: 'spot';
  linear: 'linear';
  inverse: 'inverse';
  option: 'option';
}

export interface TickerData {
  symbol: string;
  category: string;
  lastPrice: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  prevPrice24h: string;
  volume24h: string;
  turnover24h: string;
  bid1Price: string;
  bid1Size: string;
  ask1Price: string;
  ask1Size: string;
  usdIndexPrice?: string;
  timestamp: string;
}

export interface KlineData {
  symbol: string;
  category: string;
  interval: string;
  data: Array<{
    startTime: number;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    closePrice: string;
    volume: string;
    turnover: string;
  }>;
}

export interface OrderbookData {
  symbol: string;
  category: string;
  bids: Array<[string, string]>; // [price, size]
  asks: Array<[string, string]>; // [price, size]
  timestamp: string;
}

// Advanced analysis types
export interface MLRSIData {
  symbol: string;
  interval: string;
  data: Array<{
    timestamp: number;
    standardRsi: number;
    mlRsi: number;
    adaptiveOverbought: number;
    adaptiveOversold: number;
    knnDivergence: number;
    effectiveNeighbors: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  }>;
  metadata: {
    mlEnabled: boolean;
    featuresUsed: string[];
    smoothingApplied: string;
    calculationTime: number;
  };
}

export interface OrderBlock {
  id: string;
  timestamp: number;
  top: number;
  bottom: number;
  average: number;
  volume: number;
  mitigated: boolean;
  mitigationTime?: number;
}

export interface OrderBlocksData {
  symbol: string;
  interval: string;
  bullishBlocks: OrderBlock[];
  bearishBlocks: OrderBlock[];
  currentSupport: number[];
  currentResistance: number[];
  metadata: {
    volumePivotLength: number;
    mitigationMethod: string;
    blocksDetected: number;
    activeBullishBlocks: number;
    activeBearishBlocks: number;
  };
}

export interface MarketStructureData {
  symbol: string;
  interval: string;
  marketRegime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile';
  trendStrength: number;
  volatilityLevel: 'low' | 'medium' | 'high';
  keyLevels: {
    support: number[];
    resistance: number[];
    liquidityZones: Array<{
      price: number;
      strength: number;
      type: 'support' | 'resistance';
    }>;
  };
  orderBlocks?: OrderBlocksData;
  mlRsi?: MLRSIData;
  recommendations: string[];
  metadata: {
    analysisDepth: number;
    calculationTime: number;
    confidence: number;
  };
}

// Tool parameter types
export interface GetTickerParams {
  symbol: string;
  category?: keyof BybitCategory;
}

export interface GetKlineParams {
  symbol: string;
  category?: keyof BybitCategory;
  interval?: string;
  limit?: number;
}

export interface GetOrderbookParams {
  symbol: string;
  category?: keyof BybitCategory;
  limit?: number;
}

export interface GetMLRSIParams {
  symbol: string;
  category: keyof BybitCategory;
  interval: string;
  rsiLength?: number;
  knnNeighbors?: number;
  knnLookback?: number;
  mlWeight?: number;
  featureCount?: number;
  smoothingMethod?: string;
  limit?: number;
}

export interface GetOrderBlocksParams {
  symbol: string;
  category: keyof BybitCategory;
  interval: string;
  volumePivotLength?: number;
  bullishBlocks?: number;
  bearishBlocks?: number;
  mitigationMethod?: string;
  limit?: number;
}

export interface GetMarketStructureParams {
  symbol: string;
  category: keyof BybitCategory;
  interval: string;
  analysisDepth?: number;
  includeOrderBlocks?: boolean;
  includeMLRSI?: boolean;
  includeLiquidityZones?: boolean;
}

// Available MCP tools
export type MCPToolName = 
  | 'get_ticker'
  | 'get_orderbook'
  | 'get_kline'
  | 'get_market_info'
  | 'get_trades'
  | 'get_instrument_info'
  | 'get_wallet_balance'
  | 'get_positions'
  | 'get_order_history'
  | 'get_ml_rsi'
  | 'get_order_blocks'
  | 'get_market_structure';

export type MCPToolParams<T extends MCPToolName> = 
  T extends 'get_ticker' ? GetTickerParams :
  T extends 'get_kline' ? GetKlineParams :
  T extends 'get_orderbook' ? GetOrderbookParams :
  T extends 'get_ml_rsi' ? GetMLRSIParams :
  T extends 'get_order_blocks' ? GetOrderBlocksParams :
  T extends 'get_market_structure' ? GetMarketStructureParams :
  Record<string, unknown>;

export type MCPToolResponse<T extends MCPToolName> = 
  T extends 'get_ticker' ? TickerData :
  T extends 'get_kline' ? KlineData :
  T extends 'get_orderbook' ? OrderbookData :
  T extends 'get_ml_rsi' ? MLRSIData :
  T extends 'get_order_blocks' ? OrderBlocksData :
  T extends 'get_market_structure' ? MarketStructureData :
  unknown;
