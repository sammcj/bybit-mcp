import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  CategoryV5,
  GetInstrumentsInfoParamsV5,
  APIResponseV3WithTime,
  SpotInstrumentInfoV5,
  LinearInverseInstrumentInfoV5
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
          type: "number",
          description: "Limit for the number of results (max 1000)",
          minimum: 1,
          maximum: 1000,
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
        typeof typedArgs.limit === 'number' &&
        typedArgs.limit >= 1 &&
        typedArgs.limit <= 1000
      ) ? typedArgs.limit : 200

      const params: GetInstrumentsInfoParamsV5 = {
        category,
        symbol,
        limit,
      }

      const response = await this.client.getInstrumentsInfo(params)

      if (response.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.retMsg}`)
      }

      // Transform the data into a more readable format based on category
      const formattedInfo = response.result.list.map(info => {
        if (category === 'spot') {
          const spotInfo = info as SpotInstrumentInfoV5
          return {
            symbol: spotInfo.symbol,
            status: spotInfo.status,
            baseCoin: spotInfo.baseCoin,
            quoteCoin: spotInfo.quoteCoin,
            innovation: spotInfo.innovation === "1",
            marginTrading: spotInfo.marginTrading,
            lotSizeFilter: spotInfo.lotSizeFilter,
            priceFilter: spotInfo.priceFilter,
          }
        } else {
          const futuresInfo = info as LinearInverseInstrumentInfoV5
          return {
            symbol: futuresInfo.symbol,
            status: futuresInfo.status,
            baseCoin: futuresInfo.baseCoin,
            quoteCoin: futuresInfo.quoteCoin,
            settleCoin: futuresInfo.settleCoin,
            contractType: futuresInfo.contractType,
            launchTime: futuresInfo.launchTime,
            deliveryTime: futuresInfo.deliveryTime,
            deliveryFeeRate: futuresInfo.deliveryFeeRate,
            priceFilter: futuresInfo.priceFilter,
            lotSizeFilter: futuresInfo.lotSizeFilter,
            leverageFilter: futuresInfo.leverageFilter,
            fundingInterval: futuresInfo.fundingInterval,
          }
        }
      })

      return this.formatResponse({
        category,
        symbol: symbol || "all",
        limit,
        data: formattedInfo,
        retrievedAt: new Date().toISOString(),
      })
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export default GetMarketInfo
