import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import {
  // CategoryV5,
  PositionInfoParamsV5,
  APIResponseV3WithTime,
  PositionV5
} from "bybit-api"

// Zod schema for input validation
const inputSchema = z.object({
  category: z.enum(["linear", "inverse"]),
  symbol: z.string().optional(),
  baseCoin: z.string().optional(),
  settleCoin: z.string().optional(),
  limit: z.enum(["1", "10", "50", "100", "200"]).optional()
})

type ToolArguments = z.infer<typeof inputSchema>

// Type for the formatted response
interface FormattedPositionsResponse {
  category: "linear" | "inverse"
  symbol?: string
  baseCoin?: string
  settleCoin?: string
  limit: number
  data: PositionV5[]
  timestamp: string
  meta: {
    requestId: string
  }
}

class GetPositions extends BaseToolImplementation {
  name = "get_positions"
  toolDefinition: Tool = {
    name: this.name,
    description: "Get positions information for the authenticated user",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Product type",
          enum: ["linear", "inverse"],
        },
        symbol: {
          type: "string",
          description: "Trading symbol, e.g., BTCUSDT",
        },
        baseCoin: {
          type: "string",
          description: "Base coin. Used to get all symbols with this base coin",
        },
        settleCoin: {
          type: "string",
          description: "Settle coin. Used to get all symbols with this settle coin",
        },
        limit: {
          type: "string",
          description: "Maximum number of results (default: 200)",
          enum: ["1", "10", "50", "100", "200"],
        },
      },
      required: ["category"],
    },
  }

  private async getPositionsData(
    params: PositionInfoParamsV5
  ): Promise<APIResponseV3WithTime<{ list: PositionV5[] }>> {
    this.logInfo(`Fetching positions with params: ${JSON.stringify(params)}`)
    return await this.client.getPositionInfo(params)
  }

  async toolCall(request: z.infer<typeof CallToolRequestSchema>) {
    try {
      this.logInfo("Starting get_positions tool call")

      // Parse and validate input
      const validationResult = inputSchema.safeParse(request.params.arguments)
      if (!validationResult.success) {
        throw new Error(`Invalid input: ${validationResult.error.message}`)
      }

      const {
        category,
        symbol,
        baseCoin,
        settleCoin,
        limit = "200"
      } = validationResult.data

      this.logInfo(`Validated arguments - category: ${category}, symbol: ${symbol}, limit: ${limit}`)

      // Prepare request parameters
      const params: PositionInfoParamsV5 = {
        category,
        symbol,
        baseCoin,
        settleCoin,
        limit: parseInt(limit, 10)
      }

      // Execute API request with rate limiting and retry logic
      const response = await this.executeRequest(async () => {
        return await this.getPositionsData(params)
      })

      // Format response
      const result: FormattedPositionsResponse = {
        category,
        symbol,
        baseCoin,
        settleCoin,
        limit: parseInt(limit, 10),
        data: response.list,
        timestamp: new Date().toISOString(),
        meta: {
          requestId: crypto.randomUUID()
        }
      }

      this.logInfo(`Successfully retrieved positions data${symbol ? ` for ${symbol}` : ''}`)
      return this.formatResponse(result)
    } catch (error) {
      this.logInfo(`Error in get_positions: ${error instanceof Error ? error.message : String(error)}`)
      return this.handleError(error)
    }
  }
}

export default GetPositions
