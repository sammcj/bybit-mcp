import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { KlineData, calculateRSI, calculateVolatility } from "../utils/mathUtils.js"
import { 
  detectOrderBlocks,
  getActiveLevels,
  calculateOrderBlockStats,
  VolumeAnalysisConfig
} from "../utils/volumeAnalysis.js"
import { 
  applyKNNToRSI, 
  KNNConfig 
} from "../utils/knnAlgorithm.js"
import { GetKlineParamsV5, KlineIntervalV3 } from "bybit-api"

// Zod schema for input validation
const inputSchema = z.object({
  symbol: z.string()
    .min(1, "Symbol is required")
    .regex(/^[A-Z0-9]+$/, "Symbol must contain only uppercase letters and numbers"),
  category: z.enum(["spot", "linear", "inverse"]),
  interval: z.enum(["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "W", "M"]),
  analysisDepth: z.number().min(100).max(500).optional().default(200),
  includeOrderBlocks: z.boolean().optional().default(true),
  includeMLRSI: z.boolean().optional().default(true),
  includeLiquidityZones: z.boolean().optional().default(true)
})

type ToolArguments = z.infer<typeof inputSchema>

interface LiquidityZone {
  price: number;
  strength: number;
  type: "support" | "resistance";
}

interface MarketStructureResponse {
  symbol: string;
  interval: string;
  marketRegime: "trending_up" | "trending_down" | "ranging" | "volatile";
  trendStrength: number;
  volatilityLevel: "low" | "medium" | "high";
  keyLevels: {
    support: number[];
    resistance: number[];
    liquidityZones: LiquidityZone[];
  };
  orderBlocks?: {
    bullishBlocks: any[];
    bearishBlocks: any[];
    activeBullishBlocks: number;
    activeBearishBlocks: number;
  };
  mlRsi?: {
    currentRsi: number;
    mlRsi: number;
    adaptiveOverbought: number;
    adaptiveOversold: number;
    trend: string;
    confidence: number;
  };
  recommendations: string[];
  metadata: {
    analysisDepth: number;
    calculationTime: number;
    confidence: number;
    dataQuality: "excellent" | "good" | "fair" | "poor";
  };
}

class GetMarketStructure extends BaseToolImplementation {
  name = "get_market_structure"
  toolDefinition: Tool = {
    name: this.name,
    description: "Advanced market structure analysis combining ML-RSI, order blocks, and liquidity zones. Provides comprehensive market regime detection and trading recommendations.",
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
        analysisDepth: {
          type: "number",
          description: "How far back to analyse (default: 200)",
          minimum: 100,
          maximum: 500
        },
        includeOrderBlocks: {
          type: "boolean",
          description: "Include order block analysis (default: true)"
        },
        includeMLRSI: {
          type: "boolean",
          description: "Include ML-RSI analysis (default: true)"
        },
        includeLiquidityZones: {
          type: "boolean",
          description: "Include liquidity analysis (default: true)"
        }
      },
      required: ["symbol", "category", "interval"]
    }
  }

  async toolCall(request: z.infer<typeof CallToolRequestSchema>): Promise<CallToolResult> {
    const startTime = Date.now()
    
    try {
      this.logInfo("Starting get_market_structure tool call")

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
      
      if (klineData.length < 50) {
        throw new Error(`Insufficient data. Need at least 50 data points, got ${klineData.length}`)
      }

      // Analyze market structure
      const analysis = await this.analyzeMarketStructure(klineData, args)

      const calculationTime = Date.now() - startTime

      const response: MarketStructureResponse = {
        symbol: args.symbol,
        interval: args.interval,
        marketRegime: analysis.marketRegime,
        trendStrength: analysis.trendStrength,
        volatilityLevel: analysis.volatilityLevel,
        keyLevels: analysis.keyLevels,
        orderBlocks: args.includeOrderBlocks ? analysis.orderBlocks : undefined,
        mlRsi: args.includeMLRSI ? analysis.mlRsi : undefined,
        recommendations: analysis.recommendations,
        metadata: {
          analysisDepth: args.analysisDepth,
          calculationTime,
          confidence: analysis.confidence,
          dataQuality: analysis.dataQuality
        }
      }

      this.logInfo(`Market structure analysis completed in ${calculationTime}ms. Regime: ${analysis.marketRegime}, Confidence: ${analysis.confidence}%`)
      return this.formatResponse(response)

    } catch (error) {
      this.logInfo(`Market structure analysis failed: ${error instanceof Error ? error.message : String(error)}`)
      return this.handleError(error)
    }
  }

  private async fetchKlineData(args: ToolArguments): Promise<KlineData[]> {
    const params: GetKlineParamsV5 = {
      category: args.category,
      symbol: args.symbol,
      interval: args.interval as KlineIntervalV3,
      limit: args.analysisDepth
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

  private async analyzeMarketStructure(klineData: KlineData[], args: ToolArguments) {
    const closePrices = klineData.map(k => k.close)
    const highs = klineData.map(k => k.high)
    const lows = klineData.map(k => k.low)
    
    // Calculate basic indicators
    const rsiValues = calculateRSI(closePrices, 14)
    const volatility = calculateVolatility(closePrices, 20)
    
    // Determine market regime
    const marketRegime = this.determineMarketRegime(klineData, rsiValues, volatility)
    
    // Calculate trend strength
    const trendStrength = this.calculateTrendStrength(closePrices)
    
    // Determine volatility level
    const volatilityLevel = this.determineVolatilityLevel(volatility)
    
    // Analyze order blocks if requested
    let orderBlocks: any = undefined
    if (args.includeOrderBlocks) {
      const config: VolumeAnalysisConfig = {
        volumePivotLength: 3, // Reduced for better detection
        bullishBlocks: 5,
        bearishBlocks: 5,
        mitigationMethod: 'wick'
      }
      
      const { bullishBlocks, bearishBlocks } = detectOrderBlocks(klineData, config)
      const stats = calculateOrderBlockStats(bullishBlocks, bearishBlocks)
      
      orderBlocks = {
        bullishBlocks,
        bearishBlocks,
        activeBullishBlocks: stats.activeBullishBlocks,
        activeBearishBlocks: stats.activeBearishBlocks
      }
    }
    
    // Analyze ML-RSI if requested
    let mlRsi: any = undefined
    if (args.includeMLRSI && rsiValues.length > 0) {
      const currentRsi = rsiValues[rsiValues.length - 1]
      // Simplified ML-RSI for market structure analysis
      mlRsi = {
        currentRsi,
        mlRsi: currentRsi, // Simplified for now
        adaptiveOverbought: 70,
        adaptiveOversold: 30,
        trend: currentRsi > 50 ? "bullish" : "bearish",
        confidence: 75
      }
    }
    
    // Identify key levels
    const keyLevels = this.identifyKeyLevels(klineData, args.includeLiquidityZones)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(marketRegime, trendStrength, volatilityLevel, mlRsi, orderBlocks)
    
    // Calculate overall confidence
    const confidence = this.calculateConfidence(klineData.length, volatility)
    
    // Assess data quality
    const dataQuality = this.assessDataQuality(klineData)
    
    return {
      marketRegime,
      trendStrength,
      volatilityLevel,
      keyLevels,
      orderBlocks,
      mlRsi,
      recommendations,
      confidence,
      dataQuality
    }
  }

  private determineMarketRegime(klineData: KlineData[], rsiValues: number[], volatility: number[]): "trending_up" | "trending_down" | "ranging" | "volatile" {
    const closePrices = klineData.map(k => k.close)
    const recentPrices = closePrices.slice(-20) // Last 20 periods
    
    if (recentPrices.length < 10) return "ranging"
    
    const firstPrice = recentPrices[0]
    const lastPrice = recentPrices[recentPrices.length - 1]
    const priceChange = (lastPrice - firstPrice) / firstPrice
    
    const avgVolatility = volatility.length > 0 
      ? volatility.slice(-10).reduce((sum, v) => sum + v, 0) / Math.min(10, volatility.length)
      : 0
    
    const avgRsi = rsiValues.length > 0
      ? rsiValues.slice(-10).reduce((sum, r) => sum + r, 0) / Math.min(10, rsiValues.length)
      : 50
    
    // High volatility threshold
    const highVolatilityThreshold = lastPrice * 0.02 // 2% of price
    
    if (avgVolatility > highVolatilityThreshold) {
      return "volatile"
    }
    
    if (priceChange > 0.03 && avgRsi > 45) { // 3% up move
      return "trending_up"
    } else if (priceChange < -0.03 && avgRsi < 55) { // 3% down move
      return "trending_down"
    } else {
      return "ranging"
    }
  }

  private calculateTrendStrength(prices: number[]): number {
    if (prices.length < 20) return 50
    
    const recent = prices.slice(-20)
    const slope = this.calculateLinearRegressionSlope(recent)
    const correlation = this.calculateCorrelation(recent)
    
    // Normalize slope and correlation to 0-100 scale
    const normalizedSlope = Math.min(100, Math.max(0, (Math.abs(slope) * 1000) + 50))
    const normalizedCorrelation = Math.abs(correlation) * 100
    
    return Math.round((normalizedSlope + normalizedCorrelation) / 2)
  }

  private calculateLinearRegressionSlope(values: number[]): number {
    const n = values.length
    const x = Array.from({ length: n }, (_, i) => i)
    
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = values.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, idx) => sum + val * values[idx], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  }

  private calculateCorrelation(values: number[]): number {
    const n = values.length
    const x = Array.from({ length: n }, (_, i) => i)
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / n
    const meanY = values.reduce((sum, val) => sum + val, 0) / n
    
    const numerator = x.reduce((sum, val, idx) => sum + (val - meanX) * (values[idx] - meanY), 0)
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0))
    const denomY = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0))
    
    return denomX * denomY !== 0 ? numerator / (denomX * denomY) : 0
  }

  private determineVolatilityLevel(volatility: number[]): "low" | "medium" | "high" {
    if (volatility.length === 0) return "medium"
    
    const avgVolatility = volatility.slice(-10).reduce((sum, v) => sum + v, 0) / Math.min(10, volatility.length)
    const maxVolatility = Math.max(...volatility.slice(-20))
    
    const relativeVolatility = avgVolatility / maxVolatility
    
    if (relativeVolatility < 0.3) return "low"
    if (relativeVolatility > 0.7) return "high"
    return "medium"
  }

  private identifyKeyLevels(klineData: KlineData[], includeLiquidityZones: boolean) {
    const highs = klineData.map(k => k.high)
    const lows = klineData.map(k => k.low)
    
    // Find significant highs and lows
    const resistance = this.findSignificantLevels(highs, 'high').slice(0, 5)
    const support = this.findSignificantLevels(lows, 'low').slice(0, 5)
    
    const liquidityZones: LiquidityZone[] = []
    
    if (includeLiquidityZones) {
      // Create liquidity zones around key levels
      resistance.forEach(level => {
        liquidityZones.push({
          price: level,
          strength: 75,
          type: "resistance"
        })
      })
      
      support.forEach(level => {
        liquidityZones.push({
          price: level,
          strength: 75,
          type: "support"
        })
      })
    }
    
    return {
      support: support.sort((a, b) => b - a), // Descending
      resistance: resistance.sort((a, b) => a - b), // Ascending
      liquidityZones
    }
  }

  private findSignificantLevels(values: number[], type: 'high' | 'low'): number[] {
    const levels: number[] = []
    const lookback = 5
    
    for (let i = lookback; i < values.length - lookback; i++) {
      const current = values[i]
      let isSignificant = true
      
      // Check if current value is a local extreme
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i) {
          if (type === 'high' && values[j] >= current) {
            isSignificant = false
            break
          } else if (type === 'low' && values[j] <= current) {
            isSignificant = false
            break
          }
        }
      }
      
      if (isSignificant) {
        levels.push(current)
      }
    }
    
    return levels
  }

  private generateRecommendations(
    marketRegime: string,
    trendStrength: number,
    volatilityLevel: string,
    mlRsi: any,
    orderBlocks: any
  ): string[] {
    const recommendations: string[] = []
    
    // Market regime recommendations
    switch (marketRegime) {
      case "trending_up":
        recommendations.push("Market is in an uptrend - consider long positions on pullbacks")
        if (trendStrength > 70) {
          recommendations.push("Strong uptrend detected - momentum strategies may be effective")
        }
        break
      case "trending_down":
        recommendations.push("Market is in a downtrend - consider short positions on rallies")
        if (trendStrength > 70) {
          recommendations.push("Strong downtrend detected - avoid catching falling knives")
        }
        break
      case "ranging":
        recommendations.push("Market is ranging - consider mean reversion strategies")
        recommendations.push("Look for support and resistance bounces")
        break
      case "volatile":
        recommendations.push("High volatility detected - use smaller position sizes")
        recommendations.push("Consider volatility-based strategies or wait for calmer conditions")
        break
    }
    
    // Volatility recommendations
    if (volatilityLevel === "high") {
      recommendations.push("High volatility - use wider stops and smaller positions")
    } else if (volatilityLevel === "low") {
      recommendations.push("Low volatility - potential for breakout moves")
    }
    
    // RSI recommendations
    if (mlRsi) {
      if (mlRsi.currentRsi > 70) {
        recommendations.push("RSI indicates overbought conditions - watch for potential reversal")
      } else if (mlRsi.currentRsi < 30) {
        recommendations.push("RSI indicates oversold conditions - potential buying opportunity")
      }
    }
    
    // Order block recommendations
    if (orderBlocks && (orderBlocks.activeBullishBlocks > 0 || orderBlocks.activeBearishBlocks > 0)) {
      recommendations.push("Active order blocks detected - watch for reactions at these levels")
    }
    
    return recommendations
  }

  private calculateConfidence(dataPoints: number, volatility: number[]): number {
    let confidence = 50 // Base confidence
    
    // More data points = higher confidence
    if (dataPoints > 150) confidence += 20
    else if (dataPoints > 100) confidence += 10
    
    // Lower volatility = higher confidence in analysis
    if (volatility.length > 0) {
      const avgVolatility = volatility.slice(-10).reduce((sum, v) => sum + v, 0) / Math.min(10, volatility.length)
      const maxVolatility = Math.max(...volatility)
      const relativeVolatility = avgVolatility / maxVolatility
      
      if (relativeVolatility < 0.3) confidence += 15
      else if (relativeVolatility > 0.7) confidence -= 10
    }
    
    return Math.min(100, Math.max(0, confidence))
  }

  private assessDataQuality(klineData: KlineData[]): "excellent" | "good" | "fair" | "poor" {
    if (klineData.length > 200) return "excellent"
    if (klineData.length > 150) return "good"
    if (klineData.length > 100) return "fair"
    return "poor"
  }
}

export default GetMarketStructure
