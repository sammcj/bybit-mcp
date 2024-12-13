import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  CategoryV5,
  GetOrderbookParamsV5,
  APIResponseV3WithTime
} from "bybit-api"

type SupportedCategory = "spot" | "linear" | "inverse"

class GetOrderbook extends BaseToolImplementation {
  name = "get_orderbook";
  toolDefinition: Tool = {
    name: this.name,
    description: "Get orderbook (market depth) data for a trading pair",
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
        limit: {
          type: "number",
          description: "Limit for the number of bids and asks (1, 25, 50, 100, 200)",
          enum: [1, 25, 50, 100, 200],
        },
      },
      required: ["symbol"],
    },
  };

  async toolCall(request: z.infer<typeof CallToolRequestSchema>) {
    try {
      const args = request.params.arguments as unknown
      if (!args || typeof args !== 'object') {
        throw new Error("Invalid arguments")
      }

      const typedArgs = args as Record<string, unknown>

      if (!typedArgs.symbol || typeof typedArgs.symbol !== 'string') {
        throw new Error("Missing or invalid symbol parameter")
      }

      const symbol = typedArgs.symbol
      const category = (
        typedArgs.category &&
        typeof typedArgs.category === 'string' &&
        ["spot", "linear", "inverse"].includes(typedArgs.category)
      ) ? typedArgs.category as SupportedCategory
        : CONSTANTS.DEFAULT_CATEGORY as SupportedCategory

      const limit = (
        typedArgs.limit &&
        typeof typedArgs.limit === 'number' &&
        [1, 25, 50, 100, 200].includes(typedArgs.limit)
      ) ? typedArgs.limit : 25

      const params: GetOrderbookParamsV5 = {
        category,
        symbol,
        limit,
      }

      const response = await this.client.getOrderbook(params)

      if (response.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.retMsg}`)
      }

      return this.formatResponse({
        symbol,
        category,
        limit,
        data: {
          bids: response.result.b,
          asks: response.result.a,
          timestamp: response.result.ts,
          updateId: response.result.u
        },
        retrievedAt: new Date().toISOString(),
      })
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export default GetOrderbook
