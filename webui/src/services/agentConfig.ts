/**
 * Agent configuration service for managing LlamaIndex agent settings
 */

import type {
  AgentConfig,
  AgentState
} from '@/types/agent';
import { DEFAULT_AGENT_CONFIG } from '@/types/agent';

export class AgentConfigService {
  private static readonly STORAGE_KEY = 'bybit-mcp-agent-config';
  private static readonly STATE_KEY = 'bybit-mcp-agent-state';

  private config: AgentConfig;
  private state: AgentState;
  private listeners: Set<(config: AgentConfig) => void> = new Set();

  constructor() {
    this.config = this.loadConfig();
    this.state = this.loadState();
  }

  /**
   * Get current agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Update agent configuration
   */
  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.notifyListeners();
  }

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    this.config = { ...DEFAULT_AGENT_CONFIG };
    this.saveConfig();
    this.notifyListeners();
  }

  /**
   * Apply a simple preset configuration
   */
  applyPreset(presetName: 'quick' | 'standard' | 'comprehensive'): void {
    const updates: Partial<AgentConfig> = {};

    switch (presetName) {
      case 'quick':
        updates.maxIterations = 2;
        updates.showWorkflowSteps = false;
        updates.showToolCalls = false;
        break;
      case 'standard':
        updates.maxIterations = 5;
        updates.showWorkflowSteps = false;
        updates.showToolCalls = false;
        break;
      case 'comprehensive':
        updates.maxIterations = 8;
        updates.showWorkflowSteps = true;
        updates.showToolCalls = true;
        break;
    }

    this.updateConfig(updates);
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Update agent state
   */
  updateState(updates: Partial<AgentState>): void {
    this.state = { ...this.state, ...updates };
    this.saveState();
  }

  /**
   * Record a successful query
   */
  recordQuery(responseTime: number, toolCallsCount: number): void {
    const currentState = this.getState();
    const queryCount = currentState.queryCount + 1;
    const averageResponseTime =
      (currentState.averageResponseTime * currentState.queryCount + responseTime) / queryCount;

    this.updateState({
      queryCount,
      averageResponseTime,
      successRate: (currentState.successRate * currentState.queryCount + 1) / queryCount,
      lastQuery: undefined,
      lastResponse: undefined
    });
  }

  /**
   * Record a failed query
   */
  recordFailure(): void {
    const currentState = this.getState();
    const queryCount = currentState.queryCount + 1;

    this.updateState({
      queryCount,
      successRate: (currentState.successRate * currentState.queryCount) / queryCount
    });
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: AgentConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get configuration for specific analysis type
   */
  getConfigForAnalysis(analysisType: 'quick' | 'standard' | 'comprehensive'): AgentConfig {
    const baseConfig = this.getConfig();

    switch (analysisType) {
      case 'quick':
        return {
          ...baseConfig,
          maxIterations: 2,
          showWorkflowSteps: false,
          showToolCalls: false
        };

      case 'standard':
        return {
          ...baseConfig,
          maxIterations: 5,
          showWorkflowSteps: false,
          showToolCalls: false
        };

      case 'comprehensive':
        return {
          ...baseConfig,
          maxIterations: 8,
          showWorkflowSteps: true,
          showToolCalls: true
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Partial<AgentConfig>): string[] {
    const errors: string[] = [];

    if (config.maxIterations !== undefined) {
      if (config.maxIterations < 1 || config.maxIterations > 20) {
        errors.push('Max iterations must be between 1 and 20');
      }
    }

    if (config.toolTimeout !== undefined) {
      if (config.toolTimeout < 5000 || config.toolTimeout > 120000) {
        errors.push('Tool timeout must be between 5 and 120 seconds');
      }
    }

    return errors;
  }

  /**
   * Export configuration
   */
  exportConfig(): string {
    return JSON.stringify({
      config: this.config,
      state: this.state,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import configuration
   */
  importConfig(configJson: string): void {
    try {
      const imported = JSON.parse(configJson);
      if (imported.config) {
        const errors = this.validateConfig(imported.config);
        if (errors.length > 0) {
          throw new Error(`Invalid configuration: ${errors.join(', ')}`);
        }
        this.config = { ...DEFAULT_AGENT_CONFIG, ...imported.config };
        this.saveConfig();
        this.notifyListeners();
      }
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private methods
  private loadConfig(): AgentConfig {
    try {
      const stored = localStorage.getItem(AgentConfigService.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_AGENT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load agent config from localStorage:', error);
    }
    return { ...DEFAULT_AGENT_CONFIG };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(AgentConfigService.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save agent config to localStorage:', error);
    }
  }

  private loadState(): AgentState {
    try {
      const stored = localStorage.getItem(AgentConfigService.STATE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load agent state from localStorage:', error);
    }
    return {
      isProcessing: false,
      queryCount: 0,
      averageResponseTime: 0,
      successRate: 0
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem(AgentConfigService.STATE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn('Failed to save agent state to localStorage:', error);
    }
  }

  // Removed metrics-related methods - now using simplified state tracking

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.config));
  }
}

// Singleton instance
export const agentConfigService = new AgentConfigService();
