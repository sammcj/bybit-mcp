# Bybit MCP WebUI

A modern, lightweight web interface for the Bybit MCP (Model Context Protocol) server with AI-powered chat capabilities.

## Features

- 🤖 **AI-Powered Chat**: Interactive chat interface with OpenAI-compatible API support (Ollama, etc.)
- 📊 **Real-Time Charts**: Interactive candlestick charts with volume using Lightweight Charts
- 🔧 **MCP Integration**: Direct access to all 12 Bybit MCP tools including advanced technical analysis
- 🧠 **Advanced Analysis**: ML-enhanced RSI, Order Block detection, and Market Structure analysis
- 🎨 **Modern UI**: Clean, responsive design with dark/light theme support
- ⚡ **Fast & Lightweight**: Built with Vite + Vanilla TypeScript for optimal performance

## Technology Stack

- pnpm: Package manager
- **Frontend**: Vite + Vanilla TypeScript
- **Charts**: Lightweight Charts (TradingView) + Chart.js
- **Styling**: CSS3 with CSS Variables
- **AI Integration**: OpenAI-compatible API client with streaming support
- **MCP Integration**: Direct HTTP client with TypeScript types

## Quick Start

### Prerequisites

- Node.js 22+
- Running Bybit MCP server (see main project README)
- AI service (Ollama recommended) running locally or remotely

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Start MCP server (in terminal 1):

```bash
cd .. && node build/httpServer.js
```

3. Start WebUI development server (in terminal 2):

```bash
pnpm dev
```

4. Open your browser to `http://localhost:3000`

**Alternative**: Use the experimental concurrent setup:
```bash
pnpm dev:full
```

### Production Build

```bash
pnpm build
pnpm preview
```

## Configuration

The WebUI can be configured through the settings modal (⚙️ icon) or by modifying the default configuration in the code.

### AI Configuration

- **Endpoint**: URL of your AI service (default: `http://localhost:11434`)
- **Model**: Model name to use (default: `qwen3-30b-a3b-ud-128k-nothink:q4_k_xl`)
- **Temperature**: Response creativity (0.0 - 1.0)
- **Max Tokens**: Maximum response length

### MCP Configuration

- **Endpoint**: URL of your Bybit MCP server (default: `http://localhost:8080`)
- **Timeout**: Request timeout in milliseconds

## Available Views

### 💬 AI Chat

- Interactive chat with AI assistant
- Streaming responses
- Example queries for quick start
- Connection status indicators

### 📈 Charts

- Real-time price charts
- Volume indicators
- Multiple timeframes
- Symbol selection

### 🔧 MCP Tools

- Direct access to all MCP tools
- Tool parameter configuration
- Response formatting

### 🧠 Analysis

- ML-enhanced RSI visualisation
- Order block overlays
- Market structure analysis
- Trading recommendations

## MCP Tools Integration

The WebUI provides access to all Bybit MCP server tools:

### Market Data

- `get_ticker` - Real-time price data
- `get_kline` - Candlestick/OHLCV data
- `get_orderbook` - Market depth data
- `get_trades` - Recent trades
- `get_market_info` - Market information
- `get_instrument_info` - Instrument details

### Account Data

- `get_wallet_balance` - Wallet balances
- `get_positions` - Current positions
- `get_order_history` - Order history

### Advanced Analysis

- `get_ml_rsi` - ML-enhanced RSI with adaptive thresholds
- `get_order_blocks` - Institutional order accumulation zones
- `get_market_structure` - Comprehensive market analysis

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Focus chat input
- `Enter` - Send message
- `Shift + Enter` - New line in chat
- `Escape` - Close modals

## Themes

The WebUI supports three theme modes:

- **Light**: Clean, bright interface
- **Dark**: Easy on the eyes for extended use
- **Auto**: Follows system preference

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development

### Project Structure

```
src/
├── components/          # UI components
│   ├── ChatApp.ts      # Main chat interface
│   └── ChartComponent.ts # Chart wrapper
├── services/           # Core services
│   ├── aiClient.ts     # AI API integration
│   ├── mcpClient.ts    # MCP server client
│   └── configService.ts # Configuration management
├── styles/             # CSS architecture
│   ├── variables.css   # CSS custom properties
│   ├── base.css       # Base styles and reset
│   ├── components.css  # Component styles
│   └── main.css       # Main stylesheet
├── types/              # TypeScript definitions
│   ├── ai.ts          # AI service types
│   ├── mcp.ts         # MCP protocol types
│   └── charts.ts      # Chart data types
├── utils/              # Utility functions
│   └── formatters.ts   # Data formatting helpers
└── main.ts            # Application entry point
```

### Adding New Features

1. **New MCP Tool**: Add types to `src/types/mcp.ts` and update the client
2. **New Chart Type**: Extend `ChartComponent.ts` with new series types
3. **New AI Feature**: Update `aiClient.ts` and chat interface
4. **New Theme**: Modify CSS variables in `src/styles/variables.css`

### Code Style

- Use TypeScript strict mode
- Follow functional programming principles where possible
- Implement comprehensive error handling
- Add JSDoc comments for public APIs
- Use consistent naming conventions

## Performance

The WebUI is optimised for performance:

- **Minimal Bundle**: Vanilla TypeScript with selective imports
- **Efficient Charts**: Lightweight Charts for optimal rendering
- **Smart Caching**: Configuration and data caching
- **Lazy Loading**: Components loaded on demand
- **Streaming**: Real-time AI responses without blocking

## Security

- **No API Keys in Frontend**: All sensitive data handled by backend services
- **CORS Protection**: Proper cross-origin request handling
- **Input Validation**: Client-side validation for all user inputs
- **Secure Defaults**: Safe configuration defaults

## Troubleshooting

### Common Issues

1. **AI Not Responding**: Check Ollama is running and accessible
2. **MCP Tools Failing**: Verify Bybit MCP server is running
3. **Charts Not Loading**: Check browser console for errors
4. **Theme Not Applying**: Clear browser cache and reload

### Debug Mode

Enable debug logging by opening browser console and running:
```javascript
localStorage.setItem('debug', 'true');
location.reload();
```

## License

MIT License - see the main project LICENSE file for details.
