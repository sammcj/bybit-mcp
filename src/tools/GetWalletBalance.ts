import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BaseToolImplementation } from "./BaseTool.js"
import {
  AccountTypeV5,
  APIResponseV3WithTime,
  WalletBalanceV5
} from "bybit-api"

// Zod schema for input validation
const inputSchema = z.object({
  accountType: z.enum(["UNIFIED", "CONTRACT", "SPOT"]),
  coin: z.string().optional()
})

type ToolArguments = z.infer<typeof inputSchema>

// Type for the formatted response
interface FormattedWalletResponse {
  accountType: AccountTypeV5
  coin?: string
  data: {
    list: WalletBalanceV5[]
  }
  timestamp: string
  meta: {
    requestId: string
  }
}

export class GetWalletBalance extends BaseToolImplementation {
  name = "get_wallet_balance"

  toolDefinition: Tool = {
    name: this.name,
    description: "Get wallet balance information for the authenticated user",
    inputSchema: {
      type: "object",
      properties: {
        accountType: {
          type: "string",
          description: "Account type",
          enum: ["UNIFIED", "CONTRACT", "SPOT"],
        },
        coin: {
          type: "string",
          description: "Cryptocurrency symbol, e.g., BTC, ETH, USDT. If not specified, returns all coins.",
        },
      },
      required: ["accountType"],
    },
  }

  private async getWalletData(
    accountType: AccountTypeV5,
    coin?: string
  ): Promise<APIResponseV3WithTime<{ list: WalletBalanceV5[] }>> {
    this.logInfo(`Fetching wallet balance for account type: ${accountType}${coin ? `, coin: ${coin}` : ''}`)
    return await this.client.getWalletBalance({
      accountType,
      coin,
    })
  }

  async toolCall(request: z.infer<typeof CallToolRequestSchema>) {
    try {
      this.logInfo("Starting get_wallet_balance tool call")

      if (this.isDevMode) {
        throw new Error("Cannot get wallet balance in development mode - API credentials required")
      }

      // Parse and validate input
      const validationResult = inputSchema.safeParse(request.params.arguments)
      if (!validationResult.success) {
        const errorDetails = validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
        throw new Error(`Invalid input: ${JSON.stringify(errorDetails)}`)
      }

      const { accountType, coin } = validationResult.data
      this.logInfo(`Validated arguments - accountType: ${accountType}${coin ? `, coin: ${coin}` : ''}`)

      // Execute API request with rate limiting and retry logic
      const response = await this.executeRequest(async () => {
        return await this.getWalletData(accountType, coin)
      })

      // Format response
      const result: FormattedWalletResponse = {
        accountType,
        coin,
        data: {
          list: response.list
        },
        timestamp: new Date().toISOString(),
        meta: {
          requestId: crypto.randomUUID()
        }
      }

      this.logInfo(`Successfully retrieved wallet balance for ${accountType}${coin ? ` (${coin})` : ''}`)
      return this.formatResponse(result)
    } catch (error) {
      this.logInfo(`Error in get_wallet_balance: ${error instanceof Error ? error.message : String(error)}`)
      return this.handleError(error)
    }
  }
}

export default GetWalletBalance
