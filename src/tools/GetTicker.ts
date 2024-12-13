import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  CategoryV5,
  GetTickersParamsV5,
  TickerSpotV5,
  TickerLinearInverseV5,
  APIResponseV3WithTime,
  CategoryListV5
} from "bybit-api"

type SupportedCategory = "spot" | "linear" | "inverse"

interface ToolArguments {
  symbol: string
  category?: SupportedCategory
}

class GetTicker extends BaseToolImplementation {
  name = "get_ticker";
  toolDefinition: Tool = {
    name: this.name,
    description: "Get real-time ticker information for a trading pair",
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

      let response: APIResponseV3WithTime<CategoryListV5<TickerSpotV5[] | TickerLinearInverseV5[], SupportedCategory>>

      if (category === "spot") {
        const params: GetTickersParamsV5<"spot"> = {
          category: "spot",
          symbol
        }
        response = await this.client.getTickers(params)
      } else {
        const params: GetTickersParamsV5<"linear" | "inverse"> = {
          category: category as "linear" | "inverse",
          symbol
        }
        response = await this.client.getTickers(params)
      }

      if (response.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.retMsg}`)
      }

      return this.formatResponse({
        symbol,
        category,
        data: response.result,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export default GetTicker
