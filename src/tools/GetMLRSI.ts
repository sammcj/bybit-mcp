import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { 
  calculateRSI, 
  extractFeatures, 
  kalmanFilter, 
  alma, 
  doubleEma,
  KlineData,
  FeatureVector 
} from "../utils/mathUtils.js"
import { 
  applyKNNToRSI, 
  batchProcessKNN, 
  KNNConfig, 
  KNNResult 
} from "../utils/knnAlgorithm.js"
import { GetKlineParamsV5, KlineIntervalV3 } from "bybit-api"

// Zod schema for input validation
const inputSchema = z.object({
  symbol: z.string()
    .min(1, "Symbol is required")
    .regex(/^[A-Z0-9]+$/, "Symbol must contain only uppercase letters and numbers"),
  category: z.enum(["spot", "linear", "inverse"]),
  interval: z.enum(["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "W", "M"]),
  rsiLength: z.number().min(2).max(50).optional().default(14),
  knnNeighbors: z.number().min(1).max(50).optional().default(5),
  knnLookback: z.number().min(20).max(500).optional().default(100),
  mlWeight: z.number().min(0).max(1).optional().default(0.4),
  featureCount: z.number().min(1).max(5).optional().default(3),
  smoothingMethod: z.enum(["none", "kalman", "alma", "double_ema"]).optional().default("none"),
  limit: z.number().min(50).max(1000).optional().default(200)
})

type ToolArguments = z.infer<typeof inputSchema>

interface MLRSIDataPoint {
  timestamp: number;
  standardRsi: number;
  mlRsi: number;
  adaptiveOverbought: number;
  adaptiveOversold: number;
  knnDivergence: number;
  effectiveNeighbors: number;
  trend: "bullish" | "bearish" | "neutral";
  confidence: number;
}

interface MLRSIResponse {
  symbol: string;
  interval: string;
  data: MLRSIDataPoint[];
  metadata: {
    mlEnabled: boolean;
    featuresUsed: string[];
    smoothingApplied: string;
    calculationTime: number;
    rsiLength: number;
    knnConfig: KNNConfig;
  };
}

class GetMLRSI extends BaseToolImplementation {
  name = "get_ml_rsi"
  toolDefinition: Tool = {
    name: this.name,
    description: "Get ML-enhanced RSI using K-Nearest Neighbors algorithm for pattern recognition. Provides adaptive overbought/oversold levels and enhanced RSI values based on historical pattern similarity.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Trading pair symbol (e.g., 'BTCUSDT')",
          pattern: "^[A-Z0-9]+$"
        },
        category: {
          type: "string",
          description: "Category of the instrument",
          enum: ["spot", "linear", "inverse"]
        },
        interval: {
          type: "string",
          description: "Kline interval",
          enum: ["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "W", "M"]
        },
        rsiLength: {
          type: "number",
          description: "RSI calculation period (default: 14)",
          minimum: 2,
          maximum: 50
        },
        knnNeighbors: {
          type: "number",
          description: "Number of neighbors for KNN algorithm (default: 5)",
          minimum: 1,
          maximum: 50
        },
        knnLookback: {
          type: "number",
          description: "Historical period for pattern matching (default: 100)",
          minimum: 20,
          maximum: 500
        },
        mlWeight: {
          type: "number",
          description: "ML influence weight 0-1 (default: 0.4)",
          minimum: 0,
          maximum: 1
        },
        featureCount: {
          type: "number",
          description: "Number of features to use 1-5 (default: 3)",
          minimum: 1,
          maximum: 5
        },
        smoothingMethod: {
          type: "string",
          description: "Smoothing method to apply (default: none)",
          enum: ["none", "kalman", "alma", "double_ema"]
        },
        limit: {
          type: "number",
          description: "Number of data points to return (default: 200)",
          minimum: 50,
          maximum: 1000
        }
      },
      required: ["symbol", "category", "interval"]
    }
  }

  async toolCall(request: z.infer<typeof CallToolRequestSchema>): Promise<CallToolResult> {
    const startTime = Date.now()
    
    try {
      this.logInfo("Starting get_ml_rsi tool call")

      // Parse and validate input
      const validationResult = inputSchema.safeParse(request.params.arguments)
      if (!validationResult.success) {
        const errorDetails = validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
        throw new Error(`Invalid input: ${JSON.stringify(errorDetails)}`)
      }

      const args = validationResult.data

      // Fetch kline data
      const klineData = await this.fetchKlineData(args)
      
      if (klineData.length < args.rsiLength + args.knnLookback) {
        throw new Error(`Insufficient data. Need at least ${args.rsiLength + args.knnLookback} data points, got ${klineData.length}`)
      }

      // Calculate standard RSI
      const closePrices = klineData.map(k => k.close)
      const rsiValues = calculateRSI(closePrices, args.rsiLength)
      
      if (rsiValues.length === 0) {
        throw new Error("Failed to calculate RSI values")
      }

      // Extract features for all data points
      const allFeatures: FeatureVector[] = []
      for (let i = 0; i < klineData.length; i++) {
        const features = extractFeatures(klineData, i, rsiValues, args.featureCount, args.knnLookback)
        allFeatures.push(features || { rsi: rsiValues[i] || 0 })
      }

      // Configure KNN
      const knnConfig: KNNConfig = {
        neighbors: args.knnNeighbors,
        lookbackPeriod: args.knnLookback,
        mlWeight: args.mlWeight,
        featureCount: args.featureCount
      }

      // Apply KNN enhancement
      const knnResults = batchProcessKNN(rsiValues, allFeatures, klineData, knnConfig)

      // Apply smoothing if requested
      const smoothedResults = this.applySmoothingToResults(knnResults, rsiValues, args.smoothingMethod)

      // Format response data
      const responseData = this.formatMLRSIData(klineData, rsiValues, smoothedResults, args.limit)

      const calculationTime = Date.now() - startTime

      const response: MLRSIResponse = {
        symbol: args.symbol,
        interval: args.interval,
        data: responseData,
        metadata: {
          mlEnabled: true,
          featuresUsed: this.getFeatureNames(args.featureCount),
          smoothingApplied: args.smoothingMethod,
          calculationTime,
          rsiLength: args.rsiLength,
          knnConfig
        }
      }

      this.logInfo(`ML-RSI calculation completed in ${calculationTime}ms`)
      return this.formatResponse(response)

    } catch (error) {
      this.logInfo(`ML-RSI calculation failed: ${error instanceof Error ? error.message : String(error)}`)
      return this.handleError(error)
    }
  }

  private async fetchKlineData(args: ToolArguments): Promise<KlineData[]> {
    const params: GetKlineParamsV5 = {
      category: args.category,
      symbol: args.symbol,
      interval: args.interval as KlineIntervalV3,
      limit: args.limit
    }

    const response = await this.executeRequest(() => this.client.getKline(params))
    
    if (!response.list || response.list.length === 0) {
      throw new Error("No kline data received from API")
    }

    // Convert API response to KlineData format
    return response.list.map(kline => ({
      timestamp: parseInt(kline[0]),
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    })).reverse() // Reverse to get chronological order
  }

  private applySmoothingToResults(
    knnResults: KNNResult[], 
    rsiValues: number[], 
    method: string
  ): KNNResult[] {
    if (method === "none" || knnResults.length === 0) {
      return knnResults
    }

    const enhancedRsiValues = knnResults.map(r => r.enhancedRsi)
    let smoothedValues: number[] = []

    switch (method) {
      case "kalman":
        smoothedValues = kalmanFilter(enhancedRsiValues, 0.01, 0.1)
        break
      case "alma":
        smoothedValues = alma(enhancedRsiValues, Math.min(14, enhancedRsiValues.length), 0.85, 6)
        break
      case "double_ema":
        smoothedValues = doubleEma(enhancedRsiValues, Math.min(10, enhancedRsiValues.length))
        break
      default:
        smoothedValues = enhancedRsiValues
    }

    // Apply smoothed values back to results
    return knnResults.map((result, index) => ({
      ...result,
      enhancedRsi: smoothedValues[index] || result.enhancedRsi
    }))
  }

  private formatMLRSIData(
    klineData: KlineData[], 
    rsiValues: number[], 
    knnResults: KNNResult[], 
    limit: number
  ): MLRSIDataPoint[] {
    const data: MLRSIDataPoint[] = []
    const startIndex = Math.max(0, klineData.length - limit)

    for (let i = startIndex; i < klineData.length; i++) {
      const knnIndex = i - (rsiValues.length - knnResults.length)
      const knnResult = knnIndex >= 0 ? knnResults[knnIndex] : null
      const rsiIndex = i - (klineData.length - rsiValues.length)
      const standardRsi = rsiIndex >= 0 ? rsiValues[rsiIndex] : 50

      if (knnResult) {
        const trend = this.determineTrend(knnResult.enhancedRsi, knnResult.adaptiveOverbought, knnResult.adaptiveOversold)
        
        data.push({
          timestamp: klineData[i].timestamp,
          standardRsi,
          mlRsi: knnResult.enhancedRsi,
          adaptiveOverbought: knnResult.adaptiveOverbought,
          adaptiveOversold: knnResult.adaptiveOversold,
          knnDivergence: knnResult.knnDivergence,
          effectiveNeighbors: knnResult.effectiveNeighbors,
          trend,
          confidence: knnResult.confidence
        })
      }
    }

    return data
  }

  private determineTrend(rsi: number, overbought: number, oversold: number): "bullish" | "bearish" | "neutral" {
    if (rsi > overbought) return "bearish"
    if (rsi < oversold) return "bullish"
    if (rsi > 55) return "bullish"
    if (rsi < 45) return "bearish"
    return "neutral"
  }

  private getFeatureNames(featureCount: number): string[] {
    const features = ["rsi"]
    if (featureCount >= 2) features.push("momentum")
    if (featureCount >= 3) features.push("volatility")
    if (featureCount >= 4) features.push("slope")
    if (featureCount >= 5) features.push("price_momentum")
    return features
  }
}

export default GetMLRSI
