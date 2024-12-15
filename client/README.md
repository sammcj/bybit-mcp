# Bybit MCP Client

A TypeScript client for interacting with Ollama LLMs and the bybit-mcp server. This client provides a command-line interface for easy access to both Ollama's language models and bybit-mcp's trading tools.

## Quick Start

1. Clone the repository and navigate to the client directory:

```bash
cd client
```

2. Copy the example environment file and configure as needed:

```bash
cp .env.example .env
```

3. Start the interactive chat:

```bash
pnpm start
```

This will automatically:

- Check and install dependencies if needed
- Validate the environment configuration
- Verify Ollama connection
- Start the integrated chat interface

## Environment Configuration

The client uses environment variables for configuration. You can set these in your `.env` file:

```bash
# Ollama configuration
OLLAMA_HOST=http://localhost:11434
DEFAULT_MODEL=llama-3.2-11b-instruct:Q8_0

# Debug mode
DEBUG=false
```

For the bybit-mcp server configuration (when using integrated mode), the following environment variables are required:

```bash
# Bybit API Configuration (required for integrated mode)
BYBIT_API_KEY=your_api_key_here
BYBIT_API_SECRET=your_api_secret_here
BYBIT_USE_TESTNET=true  # optional, defaults to false
```

Environment variables take precedence over stored configuration.

## Installation

### Locally

```bash
pnpm i
```

### NPM

**Note: This will only be available if I decide to publish the package to npm.**

```bash
pnpm install @bybit-mcp/client
```

## Usage

The client provides several commands for interacting with Ollama models and bybit-mcp tools. It can run in two modes:

1. Integrated mode: Automatically manages the bybit-mcp server
2. Standalone mode: Connects to an externally managed server

### Quick Launch

The fastest way to start chatting:
```bash
pnpm start    # or
pnpm chat     # or
node build/launch.js
```

### Global Options

These options can be used with any command:

```bash
# Run in integrated mode (auto-manages server)
bybit-mcp-client --integrated [command]

# Enable debug logging
bybit-mcp-client --debug [command]

# Use testnet (for integrated mode)
bybit-mcp-client --testnet [command]
```

### List Available Models

View all available Ollama models:

```bash
bybit-mcp-client models
```

### List Available Tools

View all available bybit-mcp tools:

```bash
# Integrated mode (auto-manages server)
bybit-mcp-client --integrated tools

# Standalone mode (external server)
bybit-mcp-client tools "node /path/to/bybit-mcp/build/index.js"
```

### Chat with a Model

Start an interactive chat session with an Ollama model:

```bash
# Use default model
bybit-mcp-client chat

# Specify a model
bybit-mcp-client chat codellama

# Add a system message for context
bybit-mcp-client chat llama-3.2-11b-instruct:Q8_0 --system "You are a helpful assistant"
```

### Call a Tool

Execute a bybit-mcp tool with arguments:

```bash
# Integrated mode
bybit-mcp-client --integrated tool get_ticker symbol=BTCUSDT

# Standalone mode
bybit-mcp-client tool "node /path/to/bybit-mcp/build/index.js" get_ticker symbol=BTCUSDT

# With optional category parameter
bybit-mcp-client --integrated tool get_ticker symbol=BTCUSDT category=linear
```

## API Usage

You can also use the client programmatically in your TypeScript/JavaScript applications:

```typescript
import { BybitMcpClient, Config } from '@bybit-mcp/client';

const config = new Config();
const client = new BybitMcpClient(config);

// Using integrated mode (auto-manages server)
await client.startIntegratedServer();

// Or connect to external server
// await client.connectToServer('node /path/to/bybit-mcp/build/index.js');

// Chat with a model
const messages = [
  { role: 'user', content: 'Hello, how are you?' }
];
const response = await client.chat('llama-3.2-11b-instruct:Q8_0', messages);
console.log(response);

// Call a bybit-mcp tool
const result = await client.callTool('get_ticker', { symbol: 'BTCUSDT' });
console.log(result);

// Clean up (this will also stop the integrated server if running)
await client.close();
```

## Features

- Quick start script for instant setup
- Environment-based configuration
- Integrated mode for automatic server management
- Interactive chat with Ollama models
- Streaming chat responses
- Easy access to bybit-mcp trading tools
- Configurable settings with persistent storage
- Debug logging support
- TypeScript support
- Command-line interface
- Programmatic API

## Requirements

- Node.js >= 20
- Ollama running locally or remotely
- bybit-mcp server (automatically managed in integrated mode)

## Available Tools

For a complete list of available trading tools and their parameters, see the [main README](../README.md#tool-documentation).
