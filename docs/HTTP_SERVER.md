# Bybit MCP HTTP Server

The Bybit MCP server now supports HTTP/SSE transport in addition to the standard stdio transport. This enables web applications and other HTTP clients to interact with the MCP server.

## Features

- **Modern Streamable HTTP Transport**: Latest MCP protocol support with session management
- **Legacy SSE Transport**: Backwards compatibility with older MCP clients
- **Health Monitoring**: Built-in health check endpoint
- **CORS Support**: Configurable cross-origin resource sharing
- **Session Management**: Automatic session lifecycle management
- **Graceful Shutdown**: Proper cleanup on server termination

## Configuration

### Environment Variables

- `MCP_HTTP_PORT`: Server port (default: 8080)
- `MCP_HTTP_HOST`: Server host (default: localhost)
- `CORS_ORIGIN`: CORS origin policy (default: *)

### Example Configuration

```bash
export MCP_HTTP_PORT=8080
export MCP_HTTP_HOST=0.0.0.0
export CORS_ORIGIN="https://myapp.com"
```

## Endpoints

### Health Check
- **URL**: `GET /health`
- **Description**: Server health and status information
- **Response**: JSON with server status, version, and active transport counts

```json
{
  "status": "healthy",
  "name": "bybit-mcp",
  "version": "0.2.0",
  "timestamp": "2025-05-24T04:19:35.168Z",
  "transports": {
    "streamable": 0,
    "sse": 0
  }
}
```

### Modern Streamable HTTP Transport
- **URL**: `POST|GET|DELETE /mcp`
- **Description**: Modern MCP protocol endpoint with session management
- **Headers**: 
  - `Content-Type: application/json`
  - `mcp-session-id: <session-id>` (for existing sessions)

### Legacy SSE Transport
- **URL**: `GET /sse`
- **Description**: Server-Sent Events endpoint for legacy clients
- **Response**: SSE stream with session ID

- **URL**: `POST /messages?sessionId=<session-id>`
- **Description**: Message endpoint for SSE clients
- **Headers**: `Content-Type: application/json`

## Usage

### Starting the HTTP Server

```bash
# Build the project
pnpm build

# Start HTTP server
pnpm start:http

# Or run directly
node build/httpServer.js
```

### Client Connection Examples

#### Modern HTTP Client (Recommended)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
});

const transport = new StreamableHTTPClientTransport(
  new URL('http://localhost:8080/mcp')
);

await client.connect(transport);
```

#### Legacy SSE Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const client = new Client({
  name: 'legacy-client',
  version: '1.0.0'
});

const transport = new SSEClientTransport(
  new URL('http://localhost:8080/sse')
);

await client.connect(transport);
```

#### Backwards Compatible Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const baseUrl = new URL('http://localhost:8080');
let client: Client;

try {
  // Try modern transport first
  client = new Client({ name: 'client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', baseUrl));
  await client.connect(transport);
  console.log("Connected using Streamable HTTP transport");
} catch (error) {
  // Fall back to SSE transport
  console.log("Falling back to SSE transport");
  client = new Client({ name: 'client', version: '1.0.0' });
  const sseTransport = new SSEClientTransport(new URL('/sse', baseUrl));
  await client.connect(sseTransport);
  console.log("Connected using SSE transport");
}
```

### Web Application Integration

The HTTP server is designed to work seamlessly with web applications. The included WebUI demonstrates how to integrate with the MCP server over HTTP.

#### Proxy Configuration (Vite)

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/mcp': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mcp/, ''),
      },
    },
  },
});
```

## Available Tools

The HTTP server exposes all the same tools as the stdio version:

- `get_instrument_info` - Get trading instrument information
- `get_kline` - Get candlestick/kline data
- `get_ml_rsi` - Get ML-enhanced RSI indicator
- `get_market_info` - Get market information
- `get_market_structure` - Get market structure analysis
- `get_order_blocks` - Get order block detection
- `get_order_history` - Get order history
- `get_orderbook` - Get order book data
- `get_positions` - Get current positions
- `get_ticker` - Get ticker information
- `get_trades` - Get recent trades
- `get_wallet_balance` - Get wallet balance

## Security Considerations

- Configure CORS appropriately for production use
- Use HTTPS in production environments
- Consider rate limiting for public deployments
- Validate all input parameters
- Monitor session counts and cleanup

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the port using `MCP_HTTP_PORT` environment variable
2. **CORS errors**: Configure `CORS_ORIGIN` environment variable
3. **Connection refused**: Ensure the server is running and accessible
4. **Session errors**: Check that session IDs are properly managed

### Debugging

Enable debug logging by setting the log level:

```bash
export LOG_LEVEL=debug
node build/httpServer.js
```

### Health Check

Always verify the server is healthy:

```bash
curl http://localhost:8080/health
```

## Performance

- Session management is memory-based (consider Redis for production)
- Automatic cleanup of closed sessions
- Configurable timeouts and limits
- Graceful shutdown handling

## Development

For development, you can run both the HTTP server and WebUI simultaneously:

```bash
# Terminal 1: Start MCP HTTP server
pnpm start:http

# Terminal 2: Start WebUI development server
cd webui && pnpm dev
```

The WebUI will proxy MCP requests to the HTTP server automatically.
