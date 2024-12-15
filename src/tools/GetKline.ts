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

class GetKline extends BaseToolImplementation {
  name = "get_kline";
  toolDefinition: Tool = {
    name: this.name,
    description: "Get kline/candlestick data for a trading pair",
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
          type: "string",
          description: "Limit for the number of candles (max 1000)",
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

      const interval = (
        typedArgs.interval &&
        typeof typedArgs.interval === 'string' &&
        ["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "M", "W"].includes(typedArgs.interval)
      ) ? typedArgs.interval as Interval
        : CONSTANTS.DEFAULT_INTERVAL as Interval

      const limit = (
        typedArgs.limit &&
        typeof typedArgs.limit === 'string' &&
        ["1", "10", "50", "100", "200", "500", "1000"].includes(typedArgs.limit)
      ) ? parseInt(typedArgs.limit, 10) : 200

      const params: GetKlineParamsV5 = {
        category,
        symbol,
        interval,
        limit,
      }

      const response = await this.client.getKline(params)

      if (response.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.retMsg}`)
      }

      // Transform the kline data into a more readable format and return as array
      const formattedKlines = response.result.list.map(kline => ({
        timestamp: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        turnover: kline[6]
      }))

      return this.formatResponse(formattedKlines)
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export default GetKline
