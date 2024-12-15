import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  // CategoryV5,
  GetOrderbookParamsV5,
  APIResponseV3WithTime
} from "bybit-api"

// Zod schema for input validation
const inputSchema = z.object({
  symbol: z.string()
    .min(1, "Symbol is required")
    .regex(/^[A-Z0-9]+$/, "Symbol must contain only uppercase letters and numbers"),
  category: z.enum(["spot", "linear", "inverse"]).optional(),
  limit: z.union([
    z.enum(["1", "25", "50", "100", "200"]),
    z.number().transform(n => {
      const validLimits = [1, 25, 50, 100, 200]
      const closest = validLimits.reduce((prev, curr) =>
        Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev
      )
      return String(closest)
    })
  ]).optional()
})

type SupportedCategory = z.infer<typeof inputSchema>["category"]
type ToolArguments = z.infer<typeof inputSchema>

// Type for Bybit orderbook response
interface OrderbookData {
  s: string      // Symbol
  b: [string, string][] // Bids [price, size]
  a: [string, string][] // Asks [price, size]
  ts: number     // Timestamp
  u: number      // Update ID
}

class GetOrderbook extends BaseToolImplementation {
  name = "get_orderbook"
  toolDefinition: Tool = {
    name: this.name,
    description: "Get orderbook (market depth) data for a trading pair",
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
          description: "Category of the instrument (spot, linear, inverse)",
          enum: ["spot", "linear", "inverse"],
        },
        limit: {
          type: "string",
          description: "Limit for the number of bids and asks (1, 25, 50, 100, 200)",
          enum: ["1", "25", "50", "100", "200"],
        },
      },
      required: ["symbol"],
    },
  }

  private async getOrderbookData(
    symbol: string,
    category: "spot" | "linear" | "inverse",
    limit: string
  ): Promise<APIResponseV3WithTime<OrderbookData>> {
    const params: GetOrderbookParamsV5 = {
      category,
      symbol,
      limit: parseInt(limit, 10),
    }
    this.logInfo(`Fetching orderbook with params: ${JSON.stringify(params)}`)
    return await this.client.getOrderbook(params)
  }

  async toolCall(request: z.infer<typeof CallToolRequestSchema>) {
    try {
      this.logInfo("Starting get_orderbook tool call")

      // Parse and validate input
      const validationResult = inputSchema.safeParse(request.params.arguments)
      if (!validationResult.success) {
        throw new Error(`Invalid input: ${JSON.stringify(validationResult.error.errors)}`)
      }

      const {
        symbol,
        category = CONSTANTS.DEFAULT_CATEGORY as "spot" | "linear" | "inverse",
        limit = "25"
      } = validationResult.data

      this.logInfo(`Validated arguments - symbol: ${symbol}, category: ${category}, limit: ${limit}`)

      // Execute API request with rate limiting and retry logic
      const response = await this.executeRequest(async () => {
        const data = await this.getOrderbookData(symbol, category, limit)
        return data
      })

      // Format response
      const result = {
        symbol,
        category,
        limit: parseInt(limit, 10),
        asks: response.a,
        bids: response.b,
        timestamp: response.ts,
        updateId: response.u,
        meta: {
          requestId: crypto.randomUUID()
        }
      }

      this.logInfo(`Successfully retrieved orderbook data for ${symbol}`)
      return this.formatResponse(result)
    } catch (error) {
      this.logInfo(`Error in get_orderbook: ${error instanceof Error ? error.message : String(error)}`)
      return this.handleError(error)
    }
  }
}

export default GetOrderbook
