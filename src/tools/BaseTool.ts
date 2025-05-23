import { Tool, TextContent, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { RestClientV5, APIResponseV3WithTime } from "bybit-api"
import { getEnvConfig } from "../env.js"

// Error categories for better error handling
export enum ErrorCategory {
  VALIDATION = "VALIDATION",
  API_ERROR = "API_ERROR",
  RATE_LIMIT = "RATE_LIMIT",
  NETWORK = "NETWORK",
  AUTHENTICATION = "AUTHENTICATION",
  PERMISSION = "PERMISSION",
  INTERNAL = "INTERNAL"
}

// Structured error interface
export interface ToolError {
  category: ErrorCategory
  code?: string | number
  message: string
  details?: any
  timestamp: string
  tool: string
}

// Standard error codes
export const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_SYMBOL: "INVALID_SYMBOL",
  INVALID_CATEGORY: "INVALID_CATEGORY",
  API_KEY_REQUIRED: "API_KEY_REQUIRED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  BYBIT_API_ERROR: "BYBIT_API_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  UNKNOWN_ERROR: "UNKNOWN_ERROR"
} as const

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

    const errorMessage = errorMap[code] || message
    const error = new Error(`Bybit API Error ${code}: ${errorMessage}`)
    ; (error as any).code = code
    ; (error as any).bybitCode = code
    ; (error as any).category = this.categoriseBybitError(code)
    return error
  }

  /**
   * Creates a standardised ToolError object
   */
  protected createToolError(
    category: ErrorCategory,
    message: string,
    code?: string | number,
    details?: any
  ): ToolError {
    return {
      category,
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      tool: this.name
    }
  }

  /**
   * Creates a validation error for invalid input
   */
  protected createValidationError(message: string, details?: any): ToolError {
    return this.createToolError(
      ErrorCategory.VALIDATION,
      message,
      ERROR_CODES.INVALID_INPUT,
      details
    )
  }

  /**
   * Creates an API error from Bybit response
   */
  protected createApiError(code: number, message: string): ToolError {
    const category = this.categoriseBybitError(code)
    return this.createToolError(
      category,
      `Bybit API Error ${code}: ${message}`,
      code
    )
  }

  /**
   * Categorises Bybit API errors
   */
  private categoriseBybitError(code: number): ErrorCategory {
    switch (code) {
      case 10002:
        return ErrorCategory.RATE_LIMIT
      case 10003:
      case 10004:
        return ErrorCategory.AUTHENTICATION
      case 10005:
        return ErrorCategory.PERMISSION
      case 10001:
        return ErrorCategory.VALIDATION
      default:
        return ErrorCategory.API_ERROR
    }
  }

  /**
   * Handles errors and returns MCP-compliant CallToolResult
   */
  protected handleError(error: any): CallToolResult {
    let toolError: ToolError

    if (error instanceof Error) {
      // Check if it's a Bybit API error (has bybitCode property)
      if ((error as any).bybitCode) {
        toolError = this.createApiError((error as any).bybitCode, error.message)
      }
      // Check if it's a validation error (from Zod)
      else if (error.message.includes("Invalid input")) {
        toolError = this.createValidationError(error.message)
      }
      // Check for specific error patterns
      else if (error.message.includes("API credentials required") || error.message.includes("development mode")) {
        toolError = this.createToolError(
          ErrorCategory.AUTHENTICATION,
          error.message,
          ERROR_CODES.API_KEY_REQUIRED
        )
      } else if (error.message.includes("Rate limit")) {
        toolError = this.createToolError(
          ErrorCategory.RATE_LIMIT,
          error.message,
          ERROR_CODES.RATE_LIMIT_EXCEEDED
        )
      } else if (error.message.includes("timeout") || error.message.includes("Request timeout")) {
        toolError = this.createToolError(
          ErrorCategory.NETWORK,
          error.message,
          ERROR_CODES.TIMEOUT
        )
      } else if (error.name === "NetworkError") {
        toolError = this.createToolError(
          ErrorCategory.NETWORK,
          error.message,
          ERROR_CODES.NETWORK_ERROR
        )
      } else {
        toolError = this.createToolError(
          ErrorCategory.INTERNAL,
          error.message,
          ERROR_CODES.UNKNOWN_ERROR
        )
      }
    } else {
      toolError = this.createToolError(
        ErrorCategory.INTERNAL,
        String(error),
        ERROR_CODES.UNKNOWN_ERROR
      )
    }

    // Log the error
    console.error(JSON.stringify({
      jsonrpc: "2.0",
      method: "notify",
      params: {
        level: "error",
        message: `${this.name} tool error: ${toolError.message}`
      }
    }))

    // Create MCP-compliant error response
    const content: TextContent = {
      type: "text",
      text: JSON.stringify(toolError, null, 2),
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
