/**
 * Workflow event types and utilities for LlamaIndex agent workflows
 */

// Base workflow event interface
export interface BaseWorkflowEvent {
  id: string;
  timestamp: number;
  source: 'agent' | 'tool' | 'workflow' | 'user';
}

// Market analysis workflow events
export interface MarketAnalysisRequestEvent extends BaseWorkflowEvent {
  type: 'market_analysis_request';
  data: {
    symbol: string;
    analysisType: 'quick' | 'standard' | 'comprehensive';
    userQuery: string;
    preferences: {
      includeTechnical: boolean;
      includeStructure: boolean;
      includeRisk: boolean;
    };
  };
}

export interface TechnicalDataGatheredEvent extends BaseWorkflowEvent {
  type: 'technical_data_gathered';
  data: {
    symbol: string;
    priceData: any;
    indicators: any;
    volume: any;
    confidence: number;
  };
}

export interface StructureAnalysisCompleteEvent extends BaseWorkflowEvent {
  type: 'structure_analysis_complete';
  data: {
    symbol: string;
    orderBlocks: any;
    marketStructure: any;
    liquidityZones: any;
    confidence: number;
  };
}

export interface RiskAssessmentDoneEvent extends BaseWorkflowEvent {
  type: 'risk_assessment_done';
  data: {
    symbol: string;
    riskLevel: 'low' | 'medium' | 'high';
    positionSizing: any;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
  };
}

export interface FinalRecommendationEvent extends BaseWorkflowEvent {
  type: 'final_recommendation';
  data: {
    symbol: string;
    action: 'buy' | 'sell' | 'hold' | 'wait';
    confidence: number;
    reasoning: string;
    technicalAnalysis?: any;
    structureAnalysis?: any;
    riskAssessment?: any;
    timeframe: string;
  };
}

// Agent communication events
export interface AgentHandoffEvent extends BaseWorkflowEvent {
  type: 'agent_handoff';
  data: {
    fromAgent: string;
    toAgent: string;
    context: any;
    reason: string;
  };
}

export interface AgentCollaborationEvent extends BaseWorkflowEvent {
  type: 'agent_collaboration';
  data: {
    participants: string[];
    topic: string;
    consensus?: any;
    disagreements?: any;
  };
}

// Tool execution events
export interface ToolExecutionStartEvent extends BaseWorkflowEvent {
  type: 'tool_execution_start';
  data: {
    toolName: string;
    parameters: Record<string, any>;
    expectedDuration?: number;
    agent: string;
  };
}

export interface ToolExecutionCompleteEvent extends BaseWorkflowEvent {
  type: 'tool_execution_complete';
  data: {
    toolName: string;
    parameters: Record<string, any>;
    result: any;
    duration: number;
    success: boolean;
    agent: string;
  };
}

export interface ToolExecutionErrorEvent extends BaseWorkflowEvent {
  type: 'tool_execution_error';
  data: {
    toolName: string;
    parameters: Record<string, any>;
    error: string;
    duration: number;
    agent: string;
    retryable: boolean;
  };
}

// Workflow control events
export interface WorkflowStartEvent extends BaseWorkflowEvent {
  type: 'workflow_start';
  data: {
    workflowName: string;
    initialQuery: string;
    configuration: any;
  };
}

export interface WorkflowStepEvent extends BaseWorkflowEvent {
  type: 'workflow_step';
  data: {
    stepName: string;
    stepDescription: string;
    progress: number;
    totalSteps: number;
    currentAgent?: string;
  };
}

export interface WorkflowCompleteEvent extends BaseWorkflowEvent {
  type: 'workflow_complete';
  data: {
    workflowName: string;
    result: any;
    duration: number;
    stepsCompleted: number;
    success: boolean;
  };
}

export interface WorkflowErrorEvent extends BaseWorkflowEvent {
  type: 'workflow_error';
  data: {
    workflowName: string;
    error: string;
    step?: string;
    agent?: string;
    recoverable: boolean;
  };
}

// Agent thinking and reasoning events
export interface AgentReasoningEvent extends BaseWorkflowEvent {
  type: 'agent_reasoning';
  data: {
    agent: string;
    thought: string;
    nextAction: string;
    confidence: number;
    context: any;
  };
}

export interface AgentDecisionEvent extends BaseWorkflowEvent {
  type: 'agent_decision';
  data: {
    agent: string;
    decision: string;
    reasoning: string;
    alternatives: string[];
    confidence: number;
  };
}

// Union type for all workflow events
export type WorkflowEvent = 
  | MarketAnalysisRequestEvent
  | TechnicalDataGatheredEvent
  | StructureAnalysisCompleteEvent
  | RiskAssessmentDoneEvent
  | FinalRecommendationEvent
  | AgentHandoffEvent
  | AgentCollaborationEvent
  | ToolExecutionStartEvent
  | ToolExecutionCompleteEvent
  | ToolExecutionErrorEvent
  | WorkflowStartEvent
  | WorkflowStepEvent
  | WorkflowCompleteEvent
  | WorkflowErrorEvent
  | AgentReasoningEvent
  | AgentDecisionEvent;

// Event utilities
export class WorkflowEventEmitter {
  private listeners: Map<string, ((event: WorkflowEvent) => void)[]> = new Map();

  on(eventType: string, listener: (event: WorkflowEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  off(eventType: string, listener: (event: WorkflowEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: WorkflowEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
    
    // Also emit to 'all' listeners
    const allListeners = this.listeners.get('all');
    if (allListeners) {
      allListeners.forEach(listener => listener(event));
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

// Event factory functions
export function createWorkflowEvent<T extends WorkflowEvent>(
  type: T['type'],
  data: T['data'],
  source: BaseWorkflowEvent['source'] = 'workflow'
): T {
  return {
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    source,
    type,
    data
  } as T;
}

// Event type guards
export function isToolEvent(event: WorkflowEvent): event is ToolExecutionStartEvent | ToolExecutionCompleteEvent | ToolExecutionErrorEvent {
  return event.type.startsWith('tool_execution');
}

export function isAgentEvent(event: WorkflowEvent): event is AgentHandoffEvent | AgentCollaborationEvent | AgentReasoningEvent | AgentDecisionEvent {
  return event.type.startsWith('agent_');
}

export function isWorkflowControlEvent(event: WorkflowEvent): event is WorkflowStartEvent | WorkflowStepEvent | WorkflowCompleteEvent | WorkflowErrorEvent {
  return event.type.startsWith('workflow_');
}

export function isAnalysisEvent(event: WorkflowEvent): event is MarketAnalysisRequestEvent | TechnicalDataGatheredEvent | StructureAnalysisCompleteEvent | RiskAssessmentDoneEvent | FinalRecommendationEvent {
  return ['market_analysis_request', 'technical_data_gathered', 'structure_analysis_complete', 'risk_assessment_done', 'final_recommendation'].includes(event.type);
}
