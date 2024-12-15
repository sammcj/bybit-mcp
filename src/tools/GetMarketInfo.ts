import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  // CategoryV5,
  GetInstrumentsInfoParamsV5,
} from "bybit-api"

type SupportedCategory = "spot" | "linear" | "inverse"

class GetMarketInfo extends BaseToolImplementation {
  name = "get_market_info";
  toolDefinition: Tool = {
    name: this.name,
    description: "Get detailed market information for trading pairs",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Category of the instrument (spot, linear, inverse)",
          enum: ["spot", "linear", "inverse"],
        },
        symbol: {
          type: "string",
          description: "Optional: Trading pair symbol (e.g., 'BTCUSDT'). If not provided, returns info for all symbols in the category",
        },
        limit: {
          type: "string",
          description: "Limit for the number of results (max 1000)",
          enum: ["1", "10", "50", "100", "200", "500", "1000"],
        },
      },
      required: [],
    },
  };

  async toolCall(request: z.infer<typeof CallToolRequestSchema>) {
    try {
      const args = request.params.arguments as unknown
      if (!args || typeof args !== 'object') {
        throw new Error("Invalid arguments")
      }

      const typedArgs = args as Record<string, unknown>

      // Validate category explicitly
      if (typedArgs.category && typeof typedArgs.category === 'string') {
        if (!["spot", "linear", "inverse"].includes(typedArgs.category)) {
          throw new Error(`Invalid category: ${typedArgs.category}. Must be one of: spot, linear, inverse`)
        }
      }

      const category = (
        typedArgs.category &&
        typeof typedArgs.category === 'string' &&
        ["spot", "linear", "inverse"].includes(typedArgs.category)
      ) ? typedArgs.category as SupportedCategory
        : CONSTANTS.DEFAULT_CATEGORY as SupportedCategory

      const symbol = typedArgs.symbol && typeof typedArgs.symbol === 'string'
        ? typedArgs.symbol
        : undefined

      const limit = (
        typedArgs.limit &&
        typeof typedArgs.limit === 'string' &&
        ["1", "10", "50", "100", "200", "500", "1000"].includes(typedArgs.limit)
      ) ? parseInt(typedArgs.limit, 10) : 200

      const params: GetInstrumentsInfoParamsV5 = {
        category,
        symbol,
        limit,
      }

      const response = await this.client.getInstrumentsInfo(params)

      if (response.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.retMsg}`)
      }

      // Return the list array directly
      return this.formatResponse(response.result.list)
    } catch (error) {
      // Ensure error responses are properly formatted
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        content: [{
          type: "text" as const,
          text: errorMessage
        }],
        isError: true
      }
    }
  }
}

export default GetMarketInfo
