import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  // CategoryV5,
  GetTickersParamsV5,
  TickerSpotV5,
  TickerLinearInverseV5,
  APIResponseV3WithTime,
  CategoryListV5
} from "bybit-api"

// Zod schema for input validation
const inputSchema = z.object({
  symbol: z.string()
    .min(1, "Symbol is required")
    .regex(/^[A-Z0-9]+$/, "Symbol must contain only uppercase letters and numbers"),
  category: z.enum(["spot", "linear", "inverse"]).optional()
})

type SupportedCategory = z.infer<typeof inputSchema>["category"]
type ToolArguments = z.infer<typeof inputSchema>

class GetTicker extends BaseToolImplementation {
  name = "get_ticker"
  toolDefinition: Tool = {
    name: this.name,
    description: "Get real-time ticker information for a trading pair",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Trading pair symbol (e.g., 'BTCUSDT')",
          pattern: "^[A-Z0-9]+$",
          annotations: {
            priority: 1 // Required parameter
          }
        },
        category: {
          type: "string",
          description: "Category of the instrument (spot, linear, inverse)",
          enum: ["spot", "linear", "inverse"],
          annotations: {
            priority: 0 // Optional parameter
          }
        }
      },
      required: ["symbol"]
    }
  }

  private async getTickerData(
    symbol: string,
    category: "spot" | "linear" | "inverse"
  ): Promise<APIResponseV3WithTime<CategoryListV5<TickerSpotV5[] | TickerLinearInverseV5[], typeof category>>> {
    if (category === "spot") {
      const params: GetTickersParamsV5<"spot"> = {
        category: "spot",
        symbol
      }
      return await this.client.getTickers(params)
    } else {
      const params: GetTickersParamsV5<"linear" | "inverse"> = {
        category: category,
        symbol
      }
      return await this.client.getTickers(params)
    }
  }

  async toolCall(request: z.infer<typeof CallToolRequestSchema>): Promise<CallToolResult> {
    try {
      this.logInfo("Starting get_ticker tool call")

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

      const { symbol, category = CONSTANTS.DEFAULT_CATEGORY as "spot" | "linear" | "inverse" } = validationResult.data
      this.logInfo(`Validated arguments - symbol: ${symbol}, category: ${category}`)

      // Execute API request with rate limiting and retry logic
      const response = await this.executeRequest(async () => {
        return await this.getTickerData(symbol, category)
      })

      // Extract the first ticker from the list
      const ticker = response.list[0]
      if (!ticker) {
        throw new Error(`No ticker data found for ${symbol}`)
      }

      // Format response with lastPrice at root level
      const baseResult = {
        timestamp: new Date().toISOString(),
        meta: {
          requestId: crypto.randomUUID()
        },
        symbol,
        category,
        lastPrice: ticker.lastPrice,
        price24hPcnt: ticker.price24hPcnt,
        highPrice24h: ticker.highPrice24h,
        lowPrice24h: ticker.lowPrice24h,
        prevPrice24h: ticker.prevPrice24h,
        volume24h: ticker.volume24h,
        turnover24h: ticker.turnover24h,
        bid1Price: ticker.bid1Price,
        bid1Size: ticker.bid1Size,
        ask1Price: ticker.ask1Price,
        ask1Size: ticker.ask1Size
      }

      // Add spot-specific fields if applicable
      if (category === "spot" && "usdIndexPrice" in ticker) {
        return this.formatResponse({
          ...baseResult,
          usdIndexPrice: ticker.usdIndexPrice
        })
      }

      this.logInfo(`Successfully retrieved ticker data for ${symbol}`)
      return this.formatResponse(baseResult)
    } catch (error) {
      this.logInfo(`Error in get_ticker: ${error instanceof Error ? error.message : String(error)}`)
      return this.handleError(error)
    }
  }
}

export default GetTicker
