# LlamaIndex Migration Plan

## Overview

Migrate the Bybit MCP WebUI from custom AI client implementation to LlamaIndex for enhanced agentic capabilities, multi-step workflows, and better tool orchestration.

## Key Benefits

- **Multi-step reasoning**: LLM can chain multiple tool calls automatically
- **Native MCP integration**: Built-in support for MCP servers
- **Workflow orchestration**: Complex decision trees and conditional logic
- **Streaming events**: Real-time visibility into agent thinking process
- **Multi-agent support**: Different agents for different analysis types

## Migration Tasks

### Phase 1: Core Infrastructure (2-3 days) ✅ COMPLETED

**Status**: Successfully implemented custom agent system with multi-step tool calling capabilities. Browser compatibility achieved by building our own agent orchestration instead of using LlamaIndex.

## ✅ Implementation Summary

### What We Built
- **Custom Agent Service**: `CustomAgentService` class that provides multi-step reasoning
- **Multi-Step Tool Calling**: Agent can iterate through multiple tool calls to complete complex tasks
- **Configurable Workflows**: Support for different complexity levels (simple, standard, comprehensive)
- **Real-time Events**: Workflow event system for monitoring agent progress
- **Streaming Support**: Real-time streaming of agent responses
- **Agent Configuration**: Comprehensive settings system with presets
- **Browser Compatible**: No Node.js dependencies, runs entirely in the browser

### Key Features Implemented
1. **Agent Loop**: Iterative reasoning that continues until task completion or max iterations
2. **Tool Integration**: Uses existing MCP client for tool execution
3. **Event System**: Real-time workflow events for UI feedback
4. **Configuration Management**: Persistent agent settings with validation
5. **Fallback Support**: Graceful degradation to legacy AI client
6. **UI Integration**: Agent settings modal and mode toggle

### Technical Architecture
- **Agent Service**: `src/services/llamaIndexAgent.ts` (renamed from LlamaIndex for clarity)
- **Configuration**: `src/services/agentConfig.ts` with localStorage persistence
- **Type System**: Comprehensive types for agents, workflows, and events
- **UI Components**: Agent settings modal and workflow event display
- **Integration**: Seamless integration with existing ChatApp and AI client

## 🚨 Current Issues & Required Fixes

### Issue 1: Agent Settings Modal Auto-Popup
**Problem**: Agent settings modal appears automatically on every app load, forcing users to configure settings before using the app.

**Root Cause**: Unknown - need to investigate if modal is being auto-opened or has CSS visibility issues.

**Required Fix**:
- Remove auto-popup behaviour
- Modal should only open when user clicks settings button
- Use sensible defaults so configuration is optional

### Issue 2: Overly Complex Configuration
**Problem**: Current agent configuration is too complex with unnecessary options:
- Multi-agent vs Single-agent (we only need single-agent)
- Workflow complexity levels that are confusing (Simple/Standard/Comprehensive)
- Analysis feature toggles that should be automatic (Risk Assessment, Market Structure, ML Analysis)

**User Feedback**:
> "We don't ever need multi-agent"
> "It's not clear what the difference between Standard and Comprehensive is"
> "Analysis Features don't make sense, features should just be tools the agent can call if it decides it needs to based on the conversation"

**Required Simplification**:
1. **Remove multi-agent support** - only single-agent mode
2. **Simplify workflow complexity** - use one mode, let agent/user prompt decide complexity
3. **Remove analysis feature toggles** - let agent decide what tools to use based on conversation
4. **Keep only essential settings** - max iterations, timeouts, UI preferences

## 📋 Immediate Tasks Required

### Task 1: Fix Auto-Popup Issue ⚠️ HIGH PRIORITY
- [ ] Investigate why agent settings modal appears on app load
- [ ] Ensure modal only opens when explicitly requested
- [ ] Test that app loads without any popups

### Task 2: Simplify Agent Configuration ⚠️ HIGH PRIORITY
- [ ] Remove multi-agent options from UI and types
- [ ] Remove workflow complexity radio buttons (Simple/Standard/Comprehensive)
- [ ] Remove analysis feature checkboxes (Risk Assessment, Market Structure, ML Analysis)
- [ ] Keep only essential settings:
  - Max iterations (default: 5)
  - Tool timeout (default: 30s)
  - Show workflow steps (default: false)
  - Show tool calls (default: false)
  - Debug mode (default: false)

### Task 3: Update Default Configuration
- [ ] Set sensible defaults that work out of the box
- [ ] Ensure agent works well without any configuration
- [ ] Remove dependency on user configuration for basic functionality

### Task 4: Move Agent Settings to Main Settings
- [ ] Integrate simplified agent settings into main settings modal
- [ ] Remove standalone agent settings modal
- [ ] Add agent toggle to main settings (Agent Mode vs Legacy Mode)

### Task 5: Update Agent Service Logic
- [ ] Remove multi-agent workflow code
- [ ] Simplify agent initialization (single mode only)
- [ ] Remove feature toggle logic - agent should use all available tools
- [ ] Ensure agent works with minimal configuration

## 🎯 Desired End State

### Simple Configuration
```typescript
interface SimplifiedAgentConfig {
  // Essential settings only
  maxIterations: number;        // default: 5
  toolTimeout: number;          // default: 30000ms

  // UI preferences
  showWorkflowSteps: boolean;   // default: false
  showToolCalls: boolean;       // default: false
  enableDebugMode: boolean;     // default: false
  streamingEnabled: boolean;    // default: true
}
```

### User Experience
1. **App loads cleanly** - no popups or forced configuration
2. **Agent works immediately** - sensible defaults, no setup required
3. **Optional configuration** - accessible via main settings if user wants to customize
4. **Simple choices** - only essential options, no confusing complexity levels

### Agent Behaviour
- **Single-agent mode only** - one agent handles all tasks
- **Tool selection by conversation** - agent decides what tools to use based on user query
- **Configurable iterations** - user can set max reasoning steps (default: 5)
- **Clean UI** - minimal workflow visibility by default, can be enabled if desired

## Browser Compatibility Issue

### Problem
LlamaIndex packages include Node.js-specific dependencies (fs, path, child_process, etc.) that cannot run in browser environments. The build fails with errors like:
```
"errorMonitor" is not exported by "__vite-browser-external"
Module "node:fs" has been externalized for browser compatibility
```

### Alternative Approaches

#### Option 1: Custom Agent Implementation (Recommended)
- Build a lightweight custom agent system inspired by LlamaIndex patterns
- Use existing MCP integration and AI client
- Implement multi-step workflows with manual orchestration
- Benefits: Full browser compatibility, smaller bundle size, tailored to our needs

#### Option 2: Server-Side Agent Service
- Move LlamaIndex agent to a separate Node.js service
- WebUI communicates with agent service via HTTP/WebSocket
- Benefits: Full LlamaIndex functionality, separation of concerns
- Drawbacks: Additional infrastructure complexity

### Recommended Path Forward
Implement **Option 1** - Custom Agent Implementation with the following features:
- Multi-step tool execution loops
- Configurable workflow complexity
- Real-time streaming and events
- Agent specialization patterns
- Fallback to legacy single-step mode

#### 1.1 Package Installation and Setup
- [ ] Install LlamaIndex dependencies
  ```bash
  pnpm add llamaindex @llamaindex/workflow @llamaindex/openai @llamaindex/tools
  ```
- [ ] Update TypeScript configuration for LlamaIndex compatibility
- [ ] Add LlamaIndex types to project

#### 1.2 Create New Agent Service
- [ ] Create `src/services/llamaIndexAgent.ts`
- [ ] Implement `LlamaIndexAgentService` class
- [ ] Add MCP tool integration using `@llamaindex/tools/mcp`
- [ ] Implement configuration management for agent settings

#### 1.3 Configuration System
- [ ] Extend `configService.ts` with agent-specific settings:
  - Agent type selection (single vs multi-agent)
  - Workflow complexity levels
  - Tool execution timeouts
  - Max iterations for multi-step workflows
  - Debug/verbose logging options

### Phase 2: Agent Implementation (3-4 days)

#### 2.1 Single Agent Implementation
- [ ] Create basic trading analysis agent
- [ ] Integrate all existing MCP tools
- [ ] Implement streaming response handling
- [ ] Add tool call event monitoring
- [ ] Create fallback mechanisms for tool failures

#### 2.2 Multi-Agent Architecture
- [ ] Design agent specialisations:
  - **Technical Analysis Agent**: Price action, indicators, chart patterns
  - **Market Structure Agent**: Order blocks, liquidity zones, market regime
  - **Risk Management Agent**: Position sizing, risk assessment
  - **News/Sentiment Agent**: Market sentiment analysis (future extension)
- [ ] Implement agent handoff logic
- [ ] Create agent coordination workflows

#### 2.3 Workflow Orchestration
- [ ] Design workflow events for complex analysis:
  - `MarketAnalysisRequest`
  - `TechnicalDataGathered`
  - `StructureAnalysisComplete`
  - `RiskAssessmentDone`
  - `FinalRecommendation`
- [ ] Implement conditional workflow paths
- [ ] Add workflow state management

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
- [ ] Implement learning from user feedback

#### 4.3 Performance Optimisation
- [ ] Implement tool call caching
- [ ] Add parallel tool execution where possible
- [ ] Optimise workflow execution paths
- [ ] Add performance monitoring

## LlamaIndex Features to Leverage

### 1. Native MCP Integration
```typescript
import { mcp } from "@llamaindex/tools";

const mcpServer = mcp({
  url: "http://localhost:8080/mcp",
  verbose: true,
});
const tools = await mcpServer.tools();
```

### 2. Agent Workflows
```typescript
import { agent } from "@llamaindex/workflow";

const tradingAgent = agent({
  name: "TradingAnalyst",
  description: "Comprehensive cryptocurrency trading analysis",
  tools: mcpTools,
  llm: openai({ model: "gpt-4o" }),
  systemPrompt: "You are an expert crypto trader..."
});
```

### 3. Multi-Agent Orchestration
```typescript
import { multiAgent } from "@llamaindex/workflow";

const analysisWorkflow = multiAgent({
  agents: [technicalAgent, structureAgent, riskAgent],
  rootAgent: technicalAgent,
});
```

### 4. Streaming Events
```typescript
import { agentToolCallEvent, agentStreamEvent } from "@llamaindex/workflow";

const events = agent.runStream(query);
for await (const event of events) {
  if (agentToolCallEvent.include(event)) {
    // Show tool being called
  }
  if (agentStreamEvent.include(event)) {
    // Stream response text
  }
}
```

### 5. Workflow State Management
```typescript
const { withState, getContext } = createStatefulMiddleware(() => ({
  analysisDepth: 'standard',
  toolsUsed: [],
  marketConditions: null,
}));
```

## Configuration Options

### Agent Configuration
```typescript
interface AgentConfig {
  // Agent behaviour
  agentType: 'single' | 'multi';
  workflowComplexity: 'simple' | 'standard' | 'comprehensive';
  maxIterations: number;
  toolTimeout: number;

  // Analysis preferences
  defaultAnalysisDepth: 'quick' | 'standard' | 'deep';
  enableRiskAssessment: boolean;
  enableMarketStructure: boolean;

  // UI preferences
  showWorkflowSteps: boolean;
  showToolCalls: boolean;
  enableDebugMode: boolean;
  streamingEnabled: boolean;
}
```

### Workflow Presets
```typescript
const WORKFLOW_PRESETS = {
  quick: {
    maxIterations: 2,
    tools: ['get_ticker', 'get_kline'],
    complexity: 'simple'
  },
  standard: {
    maxIterations: 5,
    tools: ['get_ticker', 'get_kline', 'get_ml_rsi'],
    complexity: 'standard'
  },
  comprehensive: {
    maxIterations: 10,
    tools: 'all',
    complexity: 'comprehensive'
  }
};
```

## File Structure Changes

```
webui/src/
├── services/
│   ├── llamaIndexAgent.ts      # New: LlamaIndex agent service
│   ├── agentWorkflows.ts       # New: Workflow definitions
│   ├── agentConfig.ts          # New: Agent configuration
│   └── aiClient.ts             # Keep for fallback
├── components/
│   ├── AgentWorkflowView.ts    # New: Workflow visualisation
│   ├── AgentSettings.ts        # New: Agent configuration UI
│   └── ChatApp.ts              # Updated: Use new agent service
├── types/
│   ├── agent.ts                # New: Agent-specific types
│   └── workflow.ts             # New: Workflow event types
└── utils/
    └── workflowHelpers.ts      # New: Workflow utilities
```

## Testing Strategy

### Unit Tests
- [ ] Test agent service initialisation
- [ ] Test tool integration
- [ ] Test workflow execution
- [ ] Test configuration management

### Integration Tests
- [ ] Test MCP server integration
- [ ] Test multi-step workflows
- [ ] Test agent handoffs
- [ ] Test streaming events

### User Acceptance Tests
- [ ] Test workflow presets
- [ ] Test configuration changes
- [ ] Test error handling
- [ ] Test performance with complex queries

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

## Success Metrics

- [ ] Multi-step analysis workflows working correctly
- [ ] Improved analysis quality and depth
- [ ] Faster complex analysis completion
- [ ] Better user experience with workflow visibility
- [ ] Configurable complexity levels working as expected

## Timeline

- **Week 1**: Core infrastructure and basic agent implementation
- **Week 2**: Multi-agent architecture and workflow orchestration
- **Week 3**: UI integration and advanced features
- **Week 4**: Testing, optimisation, and documentation

## Next Steps

1. Begin with Phase 1.1 - package installation
2. Create basic agent service structure
3. Test MCP integration with LlamaIndex
4. Implement single-agent workflow
5. Gradually add multi-agent capabilities
