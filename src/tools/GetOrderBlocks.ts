import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { KlineData } from "../utils/mathUtils.js"
import { 
  detectOrderBlocks,
  getActiveLevels,
  calculateOrderBlockStats,
  OrderBlock,
  VolumeAnalysisConfig
} from "../utils/volumeAnalysis.js"
import { GetKlineParamsV5, KlineIntervalV3 } from "bybit-api"

// Zod schema for input validation
const inputSchema = z.object({
  symbol: z.string()
    .min(1, "Symbol is required")
    .regex(/^[A-Z0-9]+$/, "Symbol must contain only uppercase letters and numbers"),
  category: z.enum(["spot", "linear", "inverse"]),
  interval: z.enum(["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "W", "M"]),
  volumePivotLength: z.number().min(1).max(20).optional().default(5),
  bullishBlocks: z.number().min(1).max(10).optional().default(3),
  bearishBlocks: z.number().min(1).max(10).optional().default(3),
  mitigationMethod: z.enum(["wick", "close"]).optional().default("wick"),
  limit: z.number().min(100).max(1000).optional().default(200)
})

type ToolArguments = z.infer<typeof inputSchema>

interface OrderBlockResponse {
  symbol: string;
  interval: string;
  bullishBlocks: Array<{
    id: string;
    timestamp: number;
    top: number;
    bottom: number;
    average: number;
    volume: number;
    mitigated: boolean;
    mitigationTime?: number;
  }>;
  bearishBlocks: Array<{
    id: string;
    timestamp: number;
    top: number;
    bottom: number;
    average: number;
    volume: number;
    mitigated: boolean;
    mitigationTime?: number;
  }>;
  currentSupport: number[];
  currentResistance: number[];
  metadata: {
    volumePivotLength: number;
    mitigationMethod: string;
    blocksDetected: number;
    activeBullishBlocks: number;
    activeBearishBlocks: number;
    averageVolume: number;
    calculationTime: number;
  };
}

class GetOrderBlocks extends BaseToolImplementation {
  name = "get_order_blocks"
  toolDefinition: Tool = {
    name: this.name,
    description: "Detect institutional order accumulation zones based on volume analysis. Identifies bullish and bearish order blocks using volume peaks and tracks their mitigation status.",
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
        volumePivotLength: {
          type: "number",
          description: "Volume pivot detection period (default: 5)",
          minimum: 1,
          maximum: 20
        },
        bullishBlocks: {
          type: "number",
          description: "Number of bullish blocks to track (default: 3)",
          minimum: 1,
          maximum: 10
        },
        bearishBlocks: {
          type: "number",
          description: "Number of bearish blocks to track (default: 3)",
          minimum: 1,
          maximum: 10
        },
        mitigationMethod: {
          type: "string",
          description: "Mitigation detection method (default: wick)",
          enum: ["wick", "close"]
        },
        limit: {
          type: "number",
          description: "Historical data points to analyse (default: 200)",
          minimum: 100,
          maximum: 1000
        }
      },
      required: ["symbol", "category", "interval"]
    }
  }

  async toolCall(request: z.infer<typeof CallToolRequestSchema>): Promise<CallToolResult> {
    const startTime = Date.now()
    
    try {
      this.logInfo("Starting get_order_blocks tool call")

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
      
      if (klineData.length < args.volumePivotLength * 2 + 10) {
        throw new Error(`Insufficient data. Need at least ${args.volumePivotLength * 2 + 10} data points, got ${klineData.length}`)
      }

      // Configure volume analysis
      const config: VolumeAnalysisConfig = {
        volumePivotLength: args.volumePivotLength,
        bullishBlocks: args.bullishBlocks,
        bearishBlocks: args.bearishBlocks,
        mitigationMethod: args.mitigationMethod
      }

      // Detect order blocks
      const { bullishBlocks, bearishBlocks } = detectOrderBlocks(klineData, config)

      // Get active support and resistance levels
      const { support, resistance } = getActiveLevels([...bullishBlocks, ...bearishBlocks])

      // Calculate statistics
      const stats = calculateOrderBlockStats(bullishBlocks, bearishBlocks)

      const calculationTime = Date.now() - startTime

      const response: OrderBlockResponse = {
        symbol: args.symbol,
        interval: args.interval,
        bullishBlocks: bullishBlocks.map(block => ({
          id: block.id,
          timestamp: block.timestamp,
          top: block.top,
          bottom: block.bottom,
          average: block.average,
          volume: block.volume,
          mitigated: block.mitigated,
          mitigationTime: block.mitigationTime
        })),
        bearishBlocks: bearishBlocks.map(block => ({
          id: block.id,
          timestamp: block.timestamp,
          top: block.top,
          bottom: block.bottom,
          average: block.average,
          volume: block.volume,
          mitigated: block.mitigated,
          mitigationTime: block.mitigationTime
        })),
        currentSupport: support.slice(0, 5), // Top 5 support levels
        currentResistance: resistance.slice(0, 5), // Top 5 resistance levels
        metadata: {
          volumePivotLength: args.volumePivotLength,
          mitigationMethod: args.mitigationMethod,
          blocksDetected: stats.totalBlocks,
          activeBullishBlocks: stats.activeBullishBlocks,
          activeBearishBlocks: stats.activeBearishBlocks,
          averageVolume: stats.averageVolume,
          calculationTime
        }
      }

      this.logInfo(`Order block detection completed in ${calculationTime}ms. Found ${stats.totalBlocks} blocks (${stats.activeBullishBlocks} bullish, ${stats.activeBearishBlocks} bearish active)`)
      return this.formatResponse(response)

    } catch (error) {
      this.logInfo(`Order block detection failed: ${error instanceof Error ? error.message : String(error)}`)
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
}

export default GetOrderBlocks
