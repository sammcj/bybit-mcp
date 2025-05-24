/**
 * Agent-specific types for LlamaIndex integration
 */

// Simplified agent configuration - removed complex options
export interface AgentConfig {
  // Essential settings only
  maxIterations: number;        // default: 5
  toolTimeout: number;          // default: 30000ms

  // UI preferences
  showWorkflowSteps: boolean;   // default: false
  showToolCalls: boolean;       // default: false
  enableDebugMode: boolean;     // default: false
  streamingEnabled: boolean;    // default: true
}

export interface AgentState {
  isProcessing: boolean;
  lastQuery?: string;
  lastResponse?: string;
  queryCount: number;
  averageResponseTime: number;
  successRate: number;
}

// Workflow event types
export interface WorkflowEvent {
  id: string;
  type: 'tool_call' | 'agent_thinking' | 'workflow_step' | 'error' | 'complete';
  timestamp: number;
  data: any;
  agentName?: string;
}

export interface ToolCallEvent extends WorkflowEvent {
  type: 'tool_call';
  data: {
    toolName: string;
    parameters: Record<string, any>;
    status: 'started' | 'completed' | 'failed';
    duration?: number;
    result?: any;
    error?: string;
  };
}

export interface AgentThinkingEvent extends WorkflowEvent {
  type: 'agent_thinking';
  data: {
    reasoning: string;
    nextAction: string;
    confidence: number;
  };
}

export interface WorkflowStepEvent extends WorkflowEvent {
  type: 'workflow_step';
  data: {
    stepName: string;
    stepDescription: string;
    progress: number;
    totalSteps: number;
  };
}

// Removed complex multi-agent and workflow preset configurations
// Agent now uses single-agent mode with simplified configuration

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  // Essential settings with sensible defaults
  maxIterations: 5,
  toolTimeout: 30000,

  // UI preferences - minimal by default
  showWorkflowSteps: false,
  showToolCalls: false,
  enableDebugMode: false,
  streamingEnabled: true,
};
