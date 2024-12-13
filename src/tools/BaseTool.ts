import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { RestClientV5 } from "bybit-api"

export abstract class BaseToolImplementation {
  abstract name: string
  abstract toolDefinition: Tool
  abstract toolCall(request: z.infer<typeof CallToolRequestSchema>): Promise<any>

  protected client: RestClientV5
  protected isDevMode: boolean

  constructor() {
    // Initialize the Bybit client with API credentials from environment variables
    const apiKey = process.env.BYBIT_API_KEY
    const apiSecret = process.env.BYBIT_API_SECRET
    const useTestnet = process.env.BYBIT_USE_TESTNET === "true"
    this.isDevMode = !apiKey || !apiSecret

    if (this.isDevMode) {
      this.client = new RestClientV5({
        testnet: true,
      })
    } else {
      this.client = new RestClientV5({
        key: apiKey,
        secret: apiSecret,
        testnet: useTestnet,
      })
    }

    this.initialize()
  }

  protected initialize() {
    if (this.isDevMode) {
      this.logWarning("Running in development mode with limited functionality")
    }
  }

  protected handleError(error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({
      jsonrpc: "2.0",
      method: "notify",
      params: {
        type: "error",
        message: `${this.name} tool error: ${errorMessage}`
      }
    }))

    return {
      content: [
        {
          type: "error",
          text: JSON.stringify({
            tool: this.name,
            error: errorMessage,
            code: error.code,
            status: error.status,
          }, null, 2),
        },
      ],
    }
  }

  protected formatResponse(data: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    }
  }

  protected logInfo(message: string) {
    console.info(JSON.stringify({
      jsonrpc: "2.0",
      method: "notify",
      params: {
        type: "info",
        message: `${this.name}: ${message}`
      }
    }))
  }

  protected logWarning(message: string) {
    console.warn(JSON.stringify({
      jsonrpc: "2.0",
      method: "notify",
      params: {
        type: "warning",
        message: `${this.name}: ${message}`
      }
    }))
  }
}
