import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import {
  // CategoryV5,
  GetAccountHistoricOrdersParamsV5,
} from "bybit-api"

type SupportedCategory = "spot" | "linear" | "inverse"
type OrderStatus = "Created" | "New" | "Rejected" | "PartiallyFilled" | "PartiallyFilledCanceled" | "Filled" | "Cancelled" | "Untriggered" | "Triggered" | "Deactivated"
type OrderFilter = "Order" | "StopOrder"

class GetOrderHistory extends BaseToolImplementation {
  name = "get_order_history";
  toolDefinition: Tool = {
    name: this.name,
    description: "Get order history for the authenticated user",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Product type",
          enum: ["spot", "linear", "inverse"],
          default: "spot",
        },
        symbol: {
          type: "string",
          description: "Trading symbol, e.g., BTCUSDT",
        },
        baseCoin: {
          type: "string",
          description: "Base coin. Used to get all symbols with this base coin",
        },
        orderId: {
          type: "string",
          description: "Order ID",
        },
        orderLinkId: {
          type: "string",
          description: "User customised order ID",
        },
        orderStatus: {
          type: "string",
          description: "Order status",
          enum: ["Created", "New", "Rejected", "PartiallyFilled", "PartiallyFilledCanceled", "Filled", "Cancelled", "Untriggered", "Triggered", "Deactivated"],
        },
        orderFilter: {
          type: "string",
          description: "Order filter",
          enum: ["Order", "StopOrder"],
        },
        limit: {
          type: "string",
          description: "Maximum number of results (default: 200)",
          enum: ["1", "10", "50", "100", "200"],
        },
      },
      required: ["category"],
    },
  };

  async toolCall(request: z.infer<typeof CallToolRequestSchema>) {
    try {
      const args = request.params.arguments as unknown
      if (!args || typeof args !== 'object') {
        throw new Error("Invalid arguments")
      }

      const typedArgs = args as Record<string, unknown>

      if (!typedArgs.category || typeof typedArgs.category !== 'string' || !["spot", "linear", "inverse"].includes(typedArgs.category)) {
        throw new Error("Missing or invalid category parameter")
      }

      const category = typedArgs.category as SupportedCategory
      const symbol = typedArgs.symbol && typeof typedArgs.symbol === 'string'
        ? typedArgs.symbol
        : undefined
      const baseCoin = typedArgs.baseCoin && typeof typedArgs.baseCoin === 'string'
        ? typedArgs.baseCoin
        : undefined
      const orderId = typedArgs.orderId && typeof typedArgs.orderId === 'string'
        ? typedArgs.orderId
        : undefined
      const orderLinkId = typedArgs.orderLinkId && typeof typedArgs.orderLinkId === 'string'
        ? typedArgs.orderLinkId
        : undefined
      const orderStatus = (
        typedArgs.orderStatus &&
        typeof typedArgs.orderStatus === 'string' &&
        ["Created", "New", "Rejected", "PartiallyFilled", "PartiallyFilledCanceled", "Filled", "Cancelled", "Untriggered", "Triggered", "Deactivated"].includes(typedArgs.orderStatus)
      ) ? typedArgs.orderStatus as OrderStatus
        : undefined
      const orderFilter = (
        typedArgs.orderFilter &&
        typeof typedArgs.orderFilter === 'string' &&
        ["Order", "StopOrder"].includes(typedArgs.orderFilter)
      ) ? typedArgs.orderFilter as OrderFilter
        : undefined
      const limit = (
        typedArgs.limit &&
        typeof typedArgs.limit === 'string' &&
        ["1", "10", "50", "100", "200"].includes(typedArgs.limit)
      ) ? parseInt(typedArgs.limit, 10) : 200

      const params: GetAccountHistoricOrdersParamsV5 = {
        category,
        symbol,
        baseCoin,
        orderId,
        orderLinkId,
        orderStatus,
        orderFilter,
        limit,
      }

      const response = await this.client.getHistoricOrders(params)

      if (response.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.retMsg}`)
      }

      return this.formatResponse({
        category,
        symbol,
        baseCoin,
        orderId,
        orderLinkId,
        orderStatus,
        orderFilter,
        limit,
        data: response.result.list,
        retrievedAt: new Date().toISOString(),
      })
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export default GetOrderHistory
