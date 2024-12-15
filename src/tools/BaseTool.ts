import { Tool, TextContent, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { RestClientV5, APIResponseV3WithTime } from "bybit-api"
import { getEnvConfig } from "../env.js"

// Rate limit configuration (as per Bybit docs)
const RATE_LIMIT = {
  maxRequestsPerSecond: 10,
  maxRequestsPerMinute: 120,
  retryAfter: 2000, // ms
  maxRetries: 3
}

interface QueuedRequest {
  execute: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
}

export abstract class BaseToolImplementation {
  abstract name: string
  abstract toolDefinition: Tool
  abstract toolCall(request: z.infer<typeof CallToolRequestSchema>): Promise<CallToolResult>

  protected client: RestClientV5
  protected isDevMode: boolean
  private requestQueue: QueuedRequest[] = []
  private processingQueue = false
  private requestCount = 0
  private lastRequestTime = 0
  private requestHistory: number[] = [] // Timestamps of requests within the last minute
  private initialized = false

  constructor() {
    const config = getEnvConfig()
    this.isDevMode = !config.apiKey || !config.apiSecret

    if (this.isDevMode) {
      this.client = new RestClientV5({
        testnet: true,
      })
    } else {
      this.client = new RestClientV5({
        key: config.apiKey,
        secret: config.apiSecret,
        testnet: config.useTestnet,
        recv_window: 5000, // 5 second receive window
      })
    }
  }

  protected ensureInitialized() {
    if (!this.initialized) {
      if (this.isDevMode) {
        this.logWarning("Running in development mode with limited functionality")
      }
      this.initialized = true
    }
  }

  /**
   * Enqueues a request with rate limiting and retry logic
   */
  protected async executeRequest<T>(
    operation: () => Promise<APIResponseV3WithTime<T>>,
    retryCount = 0
  ): Promise<T> {
    this.ensureInitialized()
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        execute: async () => {
          try {
            // Check rate limits
            if (!this.canMakeRequest()) {
              const waitTime = this.getWaitTime()
              this.logInfo(`Rate limit reached. Waiting ${waitTime}ms`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
            }

            // Execute request with timeout
            const response = await Promise.race([
              operation(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timeout")), 10000)
              )
            ]) as APIResponseV3WithTime<T>

            // Update rate limit tracking
            this.updateRequestHistory()

            // Handle Bybit API errors
            if (response.retCode !== 0) {
              throw this.createBybitError(response.retCode, response.retMsg)
            }

            return response.result
          } catch (error) {
            // Retry logic for specific errors
            if (
              retryCount < RATE_LIMIT.maxRetries &&
              this.shouldRetry(error)
            ) {
              this.logWarning(`Retrying request (attempt ${retryCount + 1})`)
              await new Promise(resolve =>
                setTimeout(resolve, RATE_LIMIT.retryAfter)
              )
              return this.executeRequest(operation, retryCount + 1)
            }
            throw error
          }
        },
        resolve,
        reject
      })

      if (!this.processingQueue) {
        this.processQueue()
      }
    })
  }

  private async processQueue() {
    if (this.requestQueue.length === 0) {
      this.processingQueue = false
      return
    }

    this.processingQueue = true
    const request = this.requestQueue.shift()

    if (request) {
      try {
        const result = await request.execute()
        request.resolve(result)
      } catch (error) {
        request.reject(error)
      }
    }

    // Process next request
    setImmediate(() => this.processQueue())
  }

  private canMakeRequest(): boolean {
    const now = Date.now()
    // Clean up old requests
    this.requestHistory = this.requestHistory.filter(
      time => now - time < 60000
    )

    return (
      this.requestHistory.length < RATE_LIMIT.maxRequestsPerMinute &&
      now - this.lastRequestTime >= (1000 / RATE_LIMIT.maxRequestsPerSecond)
    )
  }

  private getWaitTime(): number {
    const now = Date.now()
    const timeToWaitForSecondLimit = Math.max(
      0,
      this.lastRequestTime + (1000 / RATE_LIMIT.maxRequestsPerSecond) - now
    )

    if (this.requestHistory.length >= RATE_LIMIT.maxRequestsPerMinute) {
      const timeToWaitForMinuteLimit = Math.max(
        0,
        this.requestHistory[0] + 60000 - now
      )
      return Math.max(timeToWaitForSecondLimit, timeToWaitForMinuteLimit)
    }

    return timeToWaitForSecondLimit
  }

  private updateRequestHistory() {
    const now = Date.now()
    this.requestHistory.push(now)
    this.lastRequestTime = now
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors or specific Bybit error codes
    return (
      error.name === "NetworkError" ||
      error.code === 10002 || // Rate limit
      error.code === 10006 || // System busy
      error.code === -1      // Unknown error
    )
  }

  private createBybitError(code: number, message: string): Error {
    const errorMap: Record<number, string> = {
      10001: "Parameter error",
      10002: "Rate limit exceeded",
      10003: "Invalid API key",
      10004: "Invalid sign",
      10005: "Permission denied",
      10006: "System busy",
      10009: "Order not found",
      10010: "Insufficient balance",
    }

    const error = new Error(
      `Bybit API Error ${code}: ${errorMap[code] || message}`
    )
      ; (error as any).code = code
    return error
  }

  protected handleError(error: any): CallToolResult {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({
      jsonrpc: "2.0",
      method: "notify",
      params: {
        level: "error",
        message: `${this.name} tool error: ${errorMessage}`
      }
    }))

    const content: TextContent = {
      type: "text",
      text: JSON.stringify({
        tool: this.name,
        error: errorMessage,
        code: error.code,
        status: error.status,
        timestamp: new Date().toISOString()
      }, null, 2),
      annotations: {
        audience: ["assistant", "user"],
        priority: 1
      }
    }

    return {
      content: [content],
      isError: true
    }
  }

  protected formatResponse(data: any): CallToolResult {
    this.ensureInitialized()
    const content: TextContent = {
      type: "text",
      text: JSON.stringify(data, null, 2),
      annotations: {
        audience: ["assistant", "user"],
        priority: 1
      }
    }

    return {
      content: [content]
    }
  }

  protected logInfo(message: string) {
    console.info(JSON.stringify({
      jsonrpc: "2.0",
      method: "notify",
      params: {
        level: "info",
        message: `${this.name}: ${message}`
      }
    }))
  }

  protected logWarning(message: string) {
    console.warn(JSON.stringify({
      jsonrpc: "2.0",
      method: "notify",
      params: {
        level: "warning",
        message: `${this.name}: ${message}`
      }
    }))
  }
}
