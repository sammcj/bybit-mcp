import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  // CategoryV5,
  GetKlineParamsV5,
} from "bybit-api"

type SupportedCategory = "spot" | "linear" | "inverse"
type Interval = "1" | "3" | "5" | "15" | "30" | "60" | "120" | "240" | "360" | "720" | "D" | "M" | "W"

// Zod schema for input validation
const inputSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  category: z.enum(["spot", "linear", "inverse"]).optional(),
  interval: z.enum(["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "M", "W"]).optional(),
  limit: z.number().min(1).max(1000).optional().default(200),
  includeReferenceId: z.boolean().optional().default(false)
})

type ToolArguments = z.infer<typeof inputSchema>

class GetKline extends BaseToolImplementation {
  name = "get_kline";
  toolDefinition: Tool = {
    name: this.name,
    description: "Get kline/candlestick data for a trading pair. Supports optional reference ID for data verification.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Trading pair symbol (e.g., 'BTCUSDT')",
        },
        category: {
          type: "string",
          description: "Category of the instrument (spot, linear, inverse)",
          enum: ["spot", "linear", "inverse"],
        },
        interval: {
          type: "string",
          description: "Kline interval",
          enum: ["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "M", "W"],
        },
        limit: {
          type: "number",
          description: "Limit for the number of candles (max 1000)",
          minimum: 1,
          maximum: 1000,
        },
        includeReferenceId: {
          type: "boolean",
          description: "Include reference ID and metadata for data verification (default: false)",
        }
      },
      required: ["symbol"],
    },
  };

  async toolCall(request: z.infer<typeof CallToolRequestSchema>) {
    try {
      this.logInfo("Starting get_kline tool call")

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

      const {
        symbol,
        category = CONSTANTS.DEFAULT_CATEGORY as SupportedCategory,
        interval = CONSTANTS.DEFAULT_INTERVAL as Interval,
        limit,
        includeReferenceId
      } = validationResult.data

      this.logInfo(`Validated arguments - symbol: ${symbol}, category: ${category}, interval: ${interval}, limit: ${limit}, includeReferenceId: ${includeReferenceId}`)

      const params: GetKlineParamsV5 = {
        category,
        symbol,
        interval,
        limit,
      }

      // Execute API request with rate limiting and retry logic
      const response = await this.executeRequest(async () => {
        return await this.client.getKline(params)
      })

      // Transform the kline data into a more readable format
      const formattedKlines = response.list.map(kline => ({
        timestamp: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        turnover: kline[6]
      }))

      const result = {
        symbol,
        category,
        interval,
        limit,
        data: formattedKlines
      }

      // Add reference metadata if requested
      const resultWithMetadata = this.addReferenceMetadata(
        result,
        includeReferenceId,
        this.name,
        `/v5/market/kline`
      )

      this.logInfo(`Successfully retrieved kline data for ${symbol}`)
      return this.formatResponse(resultWithMetadata)
    } catch (error) {
      this.logInfo(`Error in get_kline: ${error instanceof Error ? error.message : String(error)}`)
      return this.handleError(error)
    }
  }
}

export default GetKline
