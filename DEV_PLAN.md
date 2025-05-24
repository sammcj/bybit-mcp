# Bybit MCP WebUI Development Plan

## 📋 Project Overview

A modern web interface for the Bybit MCP (Model Context Protocol) server that provides real-time cryptocurrency market data and advanced technical analysis tools through AI-powered chat interactions.

### 🎯 Core Concept

- **AI Chat Interface**: Users ask questions about crypto markets in natural language
- **MCP Integration**: AI automatically calls MCP tools to fetch real-time data from Bybit
- **Data Visualization**: Charts and analysis are displayed alongside chat responses
- **Technical Analysis**: ML-enhanced RSI, Order Blocks, Market Structure analysis

## ✅ What's Been Completed

### 🔧 **Core Infrastructure**

- [x] **MCP Server Integration**: Full HTTP API with 12 tools (get_ticker, get_kline, etc.)
- [x] **AI Client**: OpenAI-compatible API integration with Ollama
- [x] **Tool Calling**: Native function calling with fallback text parsing
- [x] **Debug Console**: Real-time streaming log viewer with filtering and export
- [x] **Configuration Management**: Settings for AI endpoint, MCP server, etc.

### 🎨 **UI Framework**

- [x] **Modern Design**: Clean, responsive interface with dark/light themes
- [x] **Navigation**: Sidebar with Chat, Charts, Analysis, MCP Tools tabs
- [x] **Chat Interface**: Message history, typing indicators, error handling
- [x] **Settings Modal**: Configuration for AI and MCP endpoints

### 🔗 **Integration Success**

- [x] **CORS Resolution**: Vite proxy configuration for development
- [x] **HTTP Endpoints**: Custom `/tools` and `/call-tool` endpoints on MCP server
- [x] **Real Data Flow**: AI → Tool Call → MCP Server → Bybit API → Response
- [x] **Error Handling**: Comprehensive logging and graceful fallbacks

### 🐛 **Debugging Tools**

- [x] **Streaming Logs**: Real-time console output in collapsible debug panel
- [x] **Tool Execution Tracking**: Detailed logs of every tool call and result
- [x] **Source Mapping**: File and line number tracking for all logs
- [x] **Export Functionality**: Save logs for analysis

## 🚧 What's Remaining

### 1. **MCP Tools Tab** (Empty Page)

**Status**: UI exists but no content
**Tasks**:

- [ ] Display list of available MCP tools with descriptions
- [ ] Show tool schemas and parameter requirements
- [ ] Add manual tool testing interface
- [ ] Display tool execution history
- [ ] Add tool performance metrics

### 2. **Charts Tab** (Placeholder Only)

**Status**: Layout exists but no chart implementation
**Tasks**:

- [ ] Integrate charting library (Chart.js, D3.js, or TradingView)
- [ ] Implement candlestick/OHLCV charts using `get_kline` data
- [ ] Add interactive controls (timeframe, symbol selection)
- [ ] Display real-time price updates
- [ ] Add technical indicators overlay
- [ ] Implement chart export functionality

### 3. **Analysis Tab** (Static Text)

**Status**: Basic layout with placeholder text
**Tasks**:

- [ ] **ML-Enhanced RSI**: Display RSI analysis with adaptive thresholds
- [ ] **Order Blocks**: Visualise institutional order accumulation zones
- [ ] **Market Structure**: Show comprehensive market regime analysis
- [ ] Add symbol/timeframe selectors
- [ ] Implement real-time analysis updates
- [ ] Add analysis export and sharing

### 4. **Enhanced Chat Features**

**Tasks**:

- [ ] **Chart Integration**: Auto-generate charts when AI mentions price data
- [ ] **Analysis Widgets**: Embed analysis results directly in chat
- [ ] **Message Actions**: Copy, share, regenerate responses
- [ ] **Chat History**: Persistent conversation storage
- [ ] **Quick Actions**: Predefined queries for common tasks

### 5. **Data Visualisation Improvements**

**Tasks**:

- [ ] **Real-time Updates**: WebSocket or polling for live data
- [ ] **Multiple Symbols**: Support for comparing different cryptocurrencies
- [ ] **Portfolio View**: Track multiple positions and P&L
- [ ] **Alert System**: Price and indicator-based notifications

## 🔧 Technical Architecture

### **Frontend Stack**

- **Framework**: Vanilla TypeScript with Vite
- **Styling**: CSS with CSS variables for theming
- **MCP Integration**: Official `@modelcontextprotocol/sdk` with HTTP fallback
- **AI Integration**: OpenAI-compatible API (Ollama)

### **Backend Integration**

- **MCP Server**: Node.js with Express HTTP server
- **API Endpoints**:
  - `GET /tools` - List available tools
  - `POST /call-tool` - Execute tools
  - `GET /health` - Health check
- **Data Source**: Bybit REST API

### **Development Setup**

```bash
# Terminal 1: Start MCP Server
pnpm run serve:http

# Terminal 2: Start WebUI
cd webui && pnpm dev
```

## 🎯 Priority Tasks (Next Sprint)

### **High Priority**

1. **Charts Implementation** - Core value proposition
2. **MCP Tools Tab** - Essential for debugging and exploration
3. **Analysis Tab** - Showcase advanced features

### **Medium Priority**

4. **Chat Enhancements** - Improve user experience
5. **Real-time Updates** - Add live data streaming

### **Low Priority**

6. **Portfolio Features** - Advanced functionality
7. **Alert System** - Nice-to-have features

## 📚 Key Learnings

### **MCP Integration Challenges**

- **Complex Protocol**: Official MCP SDK requires proper session management
- **Solution**: Custom HTTP endpoints provide simpler integration path
- **Hybrid Approach**: Use HTTP for tools, keep MCP protocol for future features

### **AI Tool Calling**

- **Model Compatibility**: Not all models support function calling properly
- **Fallback Strategy**: Text parsing works when native tool calls fail
- **Format Issues**: Ollama expects `arguments` as string, not object

### **Development Workflow**

- **Debug Console**: Essential for troubleshooting complex integrations
- **Real-time Logging**: Dramatically improves development speed
- **Incremental Testing**: Build and test each component separately

### **CORS and Proxying**

- **Development**: Vite proxy handles CORS issues elegantly
- **Production**: Direct API calls work with proper CORS headers

## 🚀 Success Metrics

### **Functional Goals**

- [x] AI can fetch real-time crypto prices
- [x] Tool calling works reliably
- [x] Debug information is accessible
- [ ] Charts display live market data
- [ ] Analysis tools provide actionable insights

### **User Experience Goals**

- [x] Intuitive chat interface
- [x] Responsive design
- [x] Error handling and recovery
- [ ] Fast chart rendering
- [ ] Seamless data updates

## 📝 Notes for Next Developer

### **Immediate Focus**

Start with the **Charts Tab** as it provides the most user value. The `get_kline` tool is working and returns OHLCV data ready for charting.

### **Code Structure**

- **Services**: Well-organized in `src/services/`
- **Components**: Modular design in `src/components/`
- **Types**: Comprehensive TypeScript definitions
- **Debugging**: Use the debug console (`Ctrl+``) extensively

### **Testing Strategy**

- Use debug console to verify tool calls
- Test with different AI models (current: qwen3-30b)
- Verify MCP server endpoints manually if needed

### **Known Working Examples**

- Ask: "What's the current BTC price?" → Gets real data
- Tool: `get_ticker(symbol="BTCUSDT", category="spot")` → Returns price data
- All 12 MCP tools are loaded and accessible

The foundation is solid - now it's time to build the visualization layer! 🎨
