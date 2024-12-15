import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import { CONSTANTS } from "../constants.js"
import {
  // CategoryV5,
  GetInstrumentsInfoParamsV5,
  SpotInstrumentInfoV5,
  LinearInverseInstrumentInfoV5
} from "bybit-api"

type SupportedCategory = "spot" | "linear" | "inverse"

class GetInstrumentInfo extends BaseToolImplementation {
  name = "get_instrument_info";
  toolDefinition: Tool = {
    name: this.name,
    description: "Get detailed instrument information for a specific trading pair",
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

      const params: GetInstrumentsInfoParamsV5 = {
        category,
        symbol,
      }

      const response = await this.client.getInstrumentsInfo(params)

      if (response.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.retMsg}`)
      }

      if (!response.result.list || response.result.list.length === 0) {
        throw new Error(`No instrument info found for symbol: ${symbol}`)
      }

      const info = response.result.list[0]
      let formattedInfo: any

      if (category === 'spot') {
        const spotInfo = info as SpotInstrumentInfoV5
        formattedInfo = {
          symbol: spotInfo.symbol,
          status: spotInfo.status,
          baseCoin: spotInfo.baseCoin,
          quoteCoin: spotInfo.quoteCoin,
          innovation: spotInfo.innovation === "1",
          marginTrading: spotInfo.marginTrading,
          lotSizeFilter: {
            basePrecision: spotInfo.lotSizeFilter.basePrecision,
            quotePrecision: spotInfo.lotSizeFilter.quotePrecision,
            minOrderQty: spotInfo.lotSizeFilter.minOrderQty,
            maxOrderQty: spotInfo.lotSizeFilter.maxOrderQty,
            minOrderAmt: spotInfo.lotSizeFilter.minOrderAmt,
            maxOrderAmt: spotInfo.lotSizeFilter.maxOrderAmt,
          },
          priceFilter: {
            tickSize: spotInfo.priceFilter.tickSize,
          },
        }
      } else {
        const futuresInfo = info as LinearInverseInstrumentInfoV5
        formattedInfo = {
          symbol: futuresInfo.symbol,
          status: futuresInfo.status,
          baseCoin: futuresInfo.baseCoin,
          quoteCoin: futuresInfo.quoteCoin,
          settleCoin: futuresInfo.settleCoin,
          contractType: futuresInfo.contractType,
          launchTime: futuresInfo.launchTime,
          deliveryTime: futuresInfo.deliveryTime,
          deliveryFeeRate: futuresInfo.deliveryFeeRate,
          priceFilter: {
            tickSize: futuresInfo.priceFilter.tickSize,
          },
          lotSizeFilter: {
            qtyStep: futuresInfo.lotSizeFilter.qtyStep,
            minOrderQty: futuresInfo.lotSizeFilter.minOrderQty,
            maxOrderQty: futuresInfo.lotSizeFilter.maxOrderQty,
          },
          leverageFilter: {
            minLeverage: futuresInfo.leverageFilter.minLeverage,
            maxLeverage: futuresInfo.leverageFilter.maxLeverage,
            leverageStep: futuresInfo.leverageFilter.leverageStep,
          },
          fundingInterval: futuresInfo.fundingInterval,
        }
      }

      // Add category and timestamp to the root level
      formattedInfo.category = category
      formattedInfo.retrievedAt = new Date().toISOString()

      return this.formatResponse(formattedInfo)
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export default GetInstrumentInfo
