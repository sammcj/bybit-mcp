#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { CONSTANTS } from "./constants.js"
import { loadTools, createToolsMap } from "./utils/toolLoader.js"

const { PROJECT_NAME, PROJECT_VERSION } = CONSTANTS

let toolsMap: Map<string, any>

const server = new Server(
  {
    name: PROJECT_NAME,
    version: PROJECT_VERSION,
  },
  {
    capabilities: {
      tools: {
        enabled: true,
      },
    },
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!toolsMap || toolsMap.size === 0) {
    return { tools: [] }
  }
  return {
    tools: Array.from(toolsMap.values()).map((tool) => tool.toolDefinition),
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!toolsMap) {
    throw new Error("Tools not initialized")
  }

  const tool = toolsMap.get(request.params.name)
  if (!tool) {
    throw new Error(
      `Unknown tool: ${request.params.name}. Available tools: ${Array.from(
        toolsMap.keys()
      ).join(", ")}`
    )
  }
  return tool.toolCall(request)
})

function formatJsonRpcMessage(type: string, message: string) {
  return {
    jsonrpc: "2.0",
    method: "notify",
    params: {
      type,
      message,
    },
  }
}

async function main() {
  try {
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
