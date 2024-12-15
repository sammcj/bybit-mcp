import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  // CategoryV5,
  GetPublicTradingHistoryParamsV5,
  // PublicTradeV5
} from "bybit-api"

type SupportedCategory = "spot" | "linear" | "inverse"

class GetTrades extends BaseToolImplementation {
  name = "get_trades";
  toolDefinition: Tool = {
    name: this.name,
    description: "Get recent trades for a trading pair",
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
          type: "string",
          description: "Limit for the number of trades (max 1000)",
          enum: ["1", "10", "50", "100", "200", "500", "1000"],
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
        typeof typedArgs.limit === 'string' &&
        ["1", "10", "50", "100", "200", "500", "1000"].includes(typedArgs.limit)
      ) ? parseInt(typedArgs.limit, 10) : 200

      const params: GetPublicTradingHistoryParamsV5 = {
        category,
        symbol,
        limit,
      }

      const response = await this.client.getPublicTradingHistory(params)

      if (response.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.retMsg}`)
      }

      // Transform the trade data into a more readable format and return as array
      const formattedTrades = response.result.list.map(trade => ({
        id: trade.execId,
        symbol: trade.symbol,
        price: trade.price,
        size: trade.size,
        side: trade.side,
        time: trade.time,
        isBlockTrade: trade.isBlockTrade,
      }))

      return this.formatResponse(formattedTrades)
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export default GetTrades
