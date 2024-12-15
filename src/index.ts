#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  LoggingLevel,
  // SetLevelRequest
} from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { CONSTANTS } from "./constants.js"
import { loadTools, createToolsMap } from "./utils/toolLoader.js"
import { validateEnv } from "./env.js"

// Standard JSON-RPC error codes
const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603

const { PROJECT_NAME, PROJECT_VERSION } = CONSTANTS

let toolsMap: Map<string, any>

// Create schema for logging request
const LoggingRequestSchema = z.object({
  method: z.literal("logging/setLevel"),
  params: z.object({
    level: z.enum([
      "debug",
      "info",
      "notice",
      "warning",
      "error",
      "critical",
      "alert",
      "emergency"
    ] as const)
  })
})

const server = new Server(
  {
    name: PROJECT_NAME,
    version: PROJECT_VERSION,
  },
  {
    capabilities: {
      tools: {
        listChanged: true
      },
      resources: {
        subscribe: true,
        listChanged: true
      },
      prompts: {
        listChanged: true
      },
      logging: {}
    },
  }
)

// Set up logging handler
server.setRequestHandler(LoggingRequestSchema, async (request) => {
  const level = request.params.level
  // Configure logging level
  return {}
})

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!toolsMap || toolsMap.size === 0) {
    return { tools: [] }
  }
  return {
    tools: Array.from(toolsMap.values()).map((tool) => tool.toolDefinition),
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!toolsMap) {
      throw new Error("Tools not initialized")
    }

    const tool = toolsMap.get(request.params.name)
    if (!tool) {
      throw {
        code: METHOD_NOT_FOUND,
        message: `Unknown tool: ${request.params.name}. Available tools: ${Array.from(
          toolsMap.keys()
        ).join(", ")}`
      }
    }

    if (!request.params.arguments || typeof request.params.arguments !== 'object') {
      throw {
        code: INVALID_PARAMS,
        message: "Invalid or missing arguments"
      }
    }

    return tool.toolCall(request)
  } catch (error: any) {
    if (error.code) {
      throw error
    }
    throw {
      code: INTERNAL_ERROR,
      message: error instanceof Error ? error.message : String(error)
    }
  }
})

function formatJsonRpcMessage(level: LoggingLevel, message: string) {
  return {
    jsonrpc: "2.0",
    method: "notifications/message",
    params: {
      level,
      message,
      logger: "bybit-mcp"
    },
  }
}

async function main() {
  try {
    // Validate environment configuration
    validateEnv()

    const tools = await loadTools()
    toolsMap = createToolsMap(tools)

    if (tools.length === 0) {
      console.log(JSON.stringify(formatJsonRpcMessage(
        "warning",
        "No tools were loaded. Server will start but may have limited functionality."
      )))
    } else {
      console.log(JSON.stringify(formatJsonRpcMessage(
        "info",
        `Loaded ${tools.length} tools: ${tools.map(t => t.name).join(", ")}`
      )))
    }

    const transport = new StdioServerTransport()
    await server.connect(transport)

    console.log(JSON.stringify(formatJsonRpcMessage(
      "info",
      "Server started successfully"
    )))
  } catch (error) {
    console.error(JSON.stringify(formatJsonRpcMessage(
      "error",
      error instanceof Error ? error.message : String(error)
    )))
    process.exit(1)
  }
}

process.on("unhandledRejection", (error) => {
  console.error(JSON.stringify(formatJsonRpcMessage(
    "error",
    error instanceof Error ? error.message : String(error)
  )))
})

main().catch((error) => {
  console.error(JSON.stringify(formatJsonRpcMessage(
    "error",
    error instanceof Error ? error.message : String(error)
  )))
  process.exit(1)
})
