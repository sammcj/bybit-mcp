# Bybit MCP WebUI Enhancement Plan

## Overview

The Bybit MCP WebUI has been successfully enhanced with a custom agent system providing multi-step reasoning capabilities. This document outlines completed work and upcoming enhancements for data verification and user trust.

## ✅ Completed Implementation

### Core Agent System (COMPLETED)
- **Custom Agent Service**: Multi-step reasoning with iterative tool calling
- **Simplified Configuration**: Essential settings only, removed complex multi-agent options
- **Browser Compatible**: No Node.js dependencies, runs entirely in the browser
- **Integrated Settings**: Agent configuration moved to main settings modal
- **Error Handling**: Robust handling of placeholder responses and tool call failures

### Key Features Delivered
1. **Single-Agent Mode**: Streamlined workflow with one agent handling all tasks
2. **Multi-Step Tool Calling**: Agent iterates through multiple tool calls automatically
3. **Intelligent Content Validation**: Handles AI placeholder responses gracefully
4. **Clean UI**: No auto-popup modals, optional configuration
5. **Real-time Streaming**: Live agent responses with workflow visibility

## � Next Phase: Data Verification & Trust System

### Overview
Enhance user confidence in AI responses by implementing a citation system that allows verification of all data points returned from MCP tool calls. This addresses the critical need for users to distinguish between AI-generated content and real API data.

### Problem Statement
**Trust Gap**: Users cannot verify whether data mentioned by the AI (prices, indicators, market data) comes from real Bybit API calls or is hallucinated by the AI model. This is critical for trading decisions where data accuracy is paramount.

### Solution: Citation & Verification System
Implement a comprehensive system that:
1. **Tracks all tool responses** with unique reference IDs
2. **Links AI responses to source data** through citation markers
3. **Provides interactive verification** via hover tooltips and data panels
4. **Maintains loose coupling** so MCP server works with other clients

## 📋 Implementation Tasks

### Phase 1: System Prompt Enhancement
**Goal**: Ensure agent always knows current context and uses reference IDs

#### Task 1.1: Dynamic Timestamp in System Prompt
- [ ] Add current date/time (YYYY-MM-DD HH:MM:SS) to system prompt
- [ ] Update system prompt generation to include real-time timestamp
- [ ] Ensure agent understands relative time context for trading analysis

#### Task 1.2: Reference ID Instructions
- [ ] Update system prompt to instruct agent to use `includeReferenceId: true` for all Bybit tool calls
- [ ] Add guidance for including reference IDs in responses when citing data
- [ ] Provide examples of proper citation format: "BTC is trading at $43,250 [REF001]"

### Phase 2: MCP Server Enhancement (Loosely Coupled)
**Goal**: Add optional reference ID capability without breaking existing functionality

#### Task 2.1: Optional Reference ID Parameter
- [ ] Add optional `includeReferenceId: boolean` parameter to all Bybit tool functions
- [ ] When enabled, include `_referenceId` field in tool responses
- [ ] Generate unique reference IDs (e.g., REF001, REF002, etc.)
- [ ] Add `_timestamp` field for when the data was retrieved

#### Task 2.2: Enhanced Tool Descriptions
- [ ] Update tool descriptions to mention reference ID capability
- [ ] Maintain backward compatibility - default behavior unchanged
- [ ] Document the reference ID feature for other MCP clients

#### Task 2.3: Response Format Enhancement
```typescript
// Example enhanced response format
{
  symbol: "DOGEUSDT",
  price: "0.0847",
  change24h: "+2.34%",
  volume: "1234567.89",
  // Optional fields when includeReferenceId: true
  _referenceId: "REF001",
  _timestamp: "2024-01-15T22:45:12Z",
  _toolName: "get_ticker",
  _endpoint: "/v5/market/tickers"
}
```

### Phase 3: WebUI Citation System
**Goal**: Capture, store, and display tool response data for verification

#### Task 3.1: Tool Response Capture System
- [ ] Intercept all MCP tool responses in the agent service
- [ ] Store responses with metadata in a citation store
- [ ] Create `CitationStore` class for managing reference data
- [ ] Implement automatic cleanup of old citations

#### Task 3.2: AI Response Processing
- [ ] Parse AI responses for citation patterns `[REF###]`
- [ ] Convert citation markers to interactive elements
- [ ] Link citations to stored tool response data
- [ ] Handle multiple citations per response

#### Task 3.3: Interactive Citation UI
- [ ] Create hover tooltips showing:
  - Tool name used
  - Timestamp of API call
  - Raw data returned
  - API endpoint hit
- [ ] Style citations as clickable/hoverable elements
- [ ] Implement smooth tooltip animations

### Phase 4: Data Verification Panel
**Goal**: Provide comprehensive view of all tool calls and extracted data

#### Task 4.1: Verification Sidebar
- [ ] Create collapsible "Data Verification" panel
- [ ] Show recent tool calls in chronological order
- [ ] Display key metrics extracted from responses
- [ ] Provide filters for different data types (prices, indicators, etc.)

#### Task 4.2: Smart Data Extraction
- [ ] Extract key trading metrics from tool responses:
  - Prices and price changes
  - Technical indicators (RSI, MACD, etc.)
  - Volume and market data
  - Order book information
- [ ] Avoid displaying large arrays (candlestick data, etc.)
- [ ] Highlight important changes or alerts

#### Task 4.3: Full Data View
- [ ] Click citation or panel item to view full raw response
- [ ] JSON viewer with syntax highlighting
- [ ] Copy-to-clipboard functionality
- [ ] Export data functionality

## Browser Compatibility Issue

### Problem
LlamaIndex packages include Node.js-specific dependencies (fs, path, child_process, etc.) that cannot run in browser environments. The build fails with errors like:
```
"errorMonitor" is not exported by "__vite-browser-external"
Module "node:fs" has been externalized for browser compatibility
```

### Phase 3: UI Integration (2-3 days)

#### 3.1 Update Chat Interface
- [ ] Replace `aiClient` usage with `llamaIndexAgent`
- [ ] Implement real-time workflow event display
- [ ] Add agent activity indicators
- [ ] Show tool execution progress
- [ ] Display agent reasoning steps

#### 3.2 Enhanced User Experience
- [ ] Add workflow visualisation component
- [ ] Implement agent selection UI
- [ ] Create workflow complexity slider
- [ ] Add "explain reasoning" toggle
- [ ] Show tool execution timeline

#### 3.3 Configuration UI
- [ ] Add agent settings to settings modal
- [ ] Implement workflow preset selection
- [ ] Add debug mode toggle
- [ ] Create agent performance metrics display

### Phase 4: Advanced Features (3-4 days)

#### 4.1 Workflow Templates
- [ ] Create predefined analysis workflows:
  - **Quick Analysis**: Single-step price check
  - **Standard Analysis**: Multi-tool technical analysis
  - **Deep Analysis**: Full multi-agent comprehensive analysis
  - **Risk Assessment**: Focus on risk management tools
- [ ] Implement workflow template selector
- [ ] Add custom workflow builder (future)

#### 4.2 Agent Memory and Context
- [ ] Implement conversation memory
- [ ] Add market context persistence
- [ ] Create analysis history tracking

#### 4.3 Performance Optimisation
- [ ] Add parallel tool execution where possible
- [ ] Optimise workflow execution paths

## Risk Mitigation

### Fallback Strategy
- [ ] Keep existing `aiClient.ts` as fallback
- [ ] Implement graceful degradation
- [ ] Add agent health monitoring
- [ ] Create manual override options

### Error Handling
- [ ] Implement comprehensive error boundaries
- [ ] Add retry mechanisms for failed tool calls
- [ ] Create user-friendly error messages
- [ ] Log detailed error information for debugging
