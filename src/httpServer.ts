#!/usr/bin/env node

/**
 * HTTP/SSE server for Bybit MCP server
 * Provides both modern Streamable HTTP and legacy SSE transport support
 */

import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { CONSTANTS } from "./constants.js";
import { loadTools, createToolsMap } from "./utils/toolLoader.js";
import { validateEnv } from "./env.js";

const { PROJECT_NAME, PROJECT_VERSION } = CONSTANTS;

// Server configuration
const PORT = process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT) : 8080;
const HOST = process.env.MCP_HTTP_HOST || "localhost";

// Store transports for each session type
const transports = {
  streamable: {} as Record<string, StreamableHTTPServerTransport>,
  sse: {} as Record<string, SSEServerTransport>
};

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "mcp-session-id", "Authorization"],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    name: PROJECT_NAME,
    version: PROJECT_VERSION,
    timestamp: new Date().toISOString(),
    transports: {
      streamable: Object.keys(transports.streamable).length,
      sse: Object.keys(transports.sse).length
    }
  });
});

// Simple HTTP endpoints for WebUI integration
app.get("/tools", async (req, res) => {
  try {
    const tools = await loadTools();
    const toolsList = tools.map(tool => ({
      name: tool.name,
      description: tool.toolDefinition.description,
      inputSchema: tool.toolDefinition.inputSchema
    }));

    res.json(toolsList);
  } catch (error) {
    console.error("Error loading tools:", error);
    res.status(500).json({
      error: "Failed to load tools",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/call-tool", async (req, res) => {
  try {
    const { name, arguments: args } = req.body;

    if (!name) {
      res.status(400).json({ error: "Tool name is required" });
      return;
    }

    // Load tools and find the requested tool
    const tools = await loadTools();
    const toolsMap = createToolsMap(tools);
    const tool = toolsMap.get(name);

    if (!tool) {
      res.status(404).json({ error: `Tool '${name}' not found` });
      return;
    }

    // Call the tool
    const mcpRequest = {
      method: "tools/call" as const,
      params: {
        name,
        arguments: args || {}
      }
    };

    const result = await tool.toolCall(mcpRequest);
    res.json(result);
  } catch (error) {
    console.error(`Error calling tool:`, error);
    res.status(500).json({
      error: "Tool execution failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Create MCP server instance
function createMcpServer(toolsMap: Map<string, any>): McpServer {
  const server = new McpServer({
    name: PROJECT_NAME,
    version: PROJECT_VERSION,
  });

  // Set up tools from the loaded tools map
  if (toolsMap && toolsMap.size > 0) {
    for (const [name, tool] of toolsMap) {
      // Register each tool with the server using the tool definition
      const toolDef = tool.toolDefinition;
      const inputSchema = toolDef.inputSchema;

      // Convert JSON schema to Zod schema (simplified approach)
      const zodSchema: any = {};
      if (inputSchema.properties) {
        for (const [propName, propDef] of Object.entries(inputSchema.properties as any)) {
          const prop = propDef as any;
          let zodType;

          switch (prop.type) {
            case 'string':
              zodType = z.string();
              break;
            case 'number':
              zodType = z.number();
              break;
            case 'boolean':
              zodType = z.boolean();
              break;
            case 'array':
              zodType = z.array(z.any());
              break;
            case 'object':
              zodType = z.object({});
              break;
            default:
              zodType = z.any();
          }

          // Make optional if not required
          const isRequired = inputSchema.required?.includes(propName);
          zodSchema[propName] = isRequired ? zodType : zodType.optional();
        }
      }

      // Register the tool
      server.tool(
        name,
        zodSchema,
        async (params: any) => {
          // Call the original tool with MCP request format
          const mcpRequest = {
            params: {
              name,
              arguments: params
            }
          };
          const result = await tool.toolCall(mcpRequest);
          return result;
        }
      );
    }
  }

  return server;
}

// Modern Streamable HTTP endpoint (preferred)
app.all('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.streamable[sessionId]) {
      // Reuse existing transport
      transport = transports.streamable[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          transports.streamable[sessionId] = transport;
          console.log(`[HTTP] New session initialized: ${sessionId}`);
        }
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports.streamable[transport.sessionId];
          console.log(`[HTTP] Session closed: ${transport.sessionId}`);
        }
      };

      // Load tools and create server
      const tools = await loadTools();
      const toolsMap = createToolsMap(tools);
      const server = createMcpServer(toolsMap);

      // Connect to the MCP server
      await server.connect(transport);
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided or not an initialize request',
        },
        id: null,
      });
      return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[HTTP] Error handling request:", error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error instanceof Error ? error.message : String(error)
      },
      id: null,
    });
  }
});

// Legacy SSE endpoint for backwards compatibility
app.get('/sse', async (req, res) => {
  try {
    console.log("[SSE] New SSE connection request");

    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport('/messages', res);
    transports.sse[transport.sessionId] = transport;

    console.log(`[SSE] Session created: ${transport.sessionId}`);

    // Clean up on connection close
    res.on("close", () => {
      delete transports.sse[transport.sessionId];
      console.log(`[SSE] Session closed: ${transport.sessionId}`);
    });

    // Load tools and create server
    const tools = await loadTools();
    const toolsMap = createToolsMap(tools);
    const server = createMcpServer(toolsMap);

    // Connect to the MCP server
    await server.connect(transport);
  } catch (error) {
    console.error("[SSE] Error setting up SSE connection:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Legacy message endpoint for SSE clients
app.post('/messages', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      res.status(400).json({
        error: "Missing sessionId query parameter"
      });
      return;
    }

    const transport = transports.sse[sessionId];
    if (!transport) {
      res.status(404).json({
        error: `No SSE transport found for sessionId: ${sessionId}`
      });
      return;
    }

    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error("[SSE] Error handling message:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Reusable handler for GET and DELETE requests on /mcp
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.streamable[sessionId]) {
    res.status(400).json({
      error: 'Invalid or missing session ID'
    });
    return;
  }

  const transport = transports.streamable[sessionId];
  await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Endpoint ${req.method} ${req.path} not found`,
    availableEndpoints: [
      "GET /health - Health check",
      "GET /tools - List available tools",
      "POST /call-tool - Execute a tool",
      "POST /mcp - Modern Streamable HTTP transport",
      "GET /mcp - Server-to-client notifications",
      "DELETE /mcp - Session termination",
      "GET /sse - Legacy SSE transport",
      "POST /messages - Legacy SSE messages"
    ]
  });
});

async function startHttpServer() {
  try {
    // Validate environment configuration
    validateEnv();

    // Test tool loading
    const tools = await loadTools();
    console.log(`✅ Loaded ${tools.length} tools: ${tools.map(t => t.name).join(", ")}`);

    // Start the server
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Bybit MCP HTTP Server started`);
      console.log(`📍 Server: http://${HOST}:${PORT}`);
      console.log(`🔗 Modern HTTP: http://${HOST}:${PORT}/mcp`);
      console.log(`🔗 Legacy SSE: http://${HOST}:${PORT}/sse`);
      console.log(`❤️  Health check: http://${HOST}:${PORT}/health`);
      console.log(`📊 Project: ${PROJECT_NAME} v${PROJECT_VERSION}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error("❌ Failed to start HTTP server:", error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection:", error);
});

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startHttpServer().catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
}

export { startHttpServer, app };
