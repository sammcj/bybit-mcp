/**
 * Custom agent service for enhanced agentic capabilities
 * Implements multi-step tool calling and workflow orchestration
 */

import type { AgentConfig, AgentState } from '@/types/agent';
import type { WorkflowEvent } from '@/types/workflow';
import { WorkflowEventEmitter, createWorkflowEvent } from '@/types/workflow';
import { agentConfigService } from './agentConfig';
import { aiClient } from './aiClient';
import { mcpClient } from './mcpClient';
import type { ChatMessage } from '@/types/ai';

export class CustomAgentService {
  private availableTools: any[] = [];
  private isInitialized = false;
  private eventEmitter: WorkflowEventEmitter;
  private currentConfig: AgentConfig;
  private conversationHistory: ChatMessage[] = [];

  constructor() {
    this.eventEmitter = new WorkflowEventEmitter();
    this.currentConfig = agentConfigService.getConfig();

    // Subscribe to config changes
    agentConfigService.subscribe((config) => {
      this.currentConfig = config;
      this.reinitializeAgents();
    });
  }

  /**
   * Initialize the agent service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🤖 Initializing LlamaIndex Agent Service...');

      // Load MCP tools
      await this.loadMCPTools();

      // Initialize agents based on configuration
      await this.initializeAgents();

      // Update state
      agentConfigService.updateState({
        isProcessing: false
      });

      this.isInitialized = true;
      console.log('✅ LlamaIndex Agent Service initialized successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('❌ Failed to initialize LlamaIndex Agent Service:', error);

      agentConfigService.updateState({
        isProcessing: false
      });

      throw error;
    }
  }

  /**
   * Load MCP tools from the server
   */
  private async loadMCPTools(): Promise<void> {
    try {
      console.log('🔧 Loading MCP tools...');

      // Get available tools from MCP client
      const tools = await mcpClient.listTools();
      this.availableTools = tools;

      console.log(`🔧 Loaded ${this.availableTools.length} MCP tools:`, this.availableTools.map(t => t.name));

    } catch (error) {
      console.error('❌ Failed to load MCP tools:', error);
      // Continue with empty tools array for now
      this.availableTools = [];
    }
  }

  /**
   * Initialize agent system
   */
  private async initializeAgents(): Promise<void> {
    console.log('🤖 Initializing custom agent system...');

    // Agent system is ready - we'll use the existing AI client with multi-step logic
    console.log('✅ Custom agent system initialized');
  }

  /**
   * Build system prompt based on configuration
   */
  private buildSystemPrompt(): string {
    const basePrompt = `You are an expert cryptocurrency trading assistant with access to real-time market data and advanced analysis tools.

Your capabilities include:
- Real-time price and market data analysis
- Technical indicator analysis including ML-enhanced RSI
- Market structure analysis with order blocks and liquidity zones
- Risk assessment and position sizing recommendations

Available tools: ${this.availableTools.map((t: any) => t.name).join(', ')}

Guidelines:
1. Always use relevant tools to gather current data before making recommendations
2. Provide clear, actionable insights with proper risk warnings
3. Explain your reasoning and methodology
4. Include confidence levels in your analysis
5. Consider multiple timeframes when relevant
6. Use tools intelligently based on the user's question - don't call unnecessary tools
7. Provide comprehensive analysis when appropriate, but be concise when a simple answer suffices`;

    return basePrompt;
  }

  /**
   * Process a chat message with the agent using multi-step reasoning
   */
  async chat(message: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let toolCallsCount = 0;

    try {
      agentConfigService.updateState({ isProcessing: true });

      console.log('💬 Processing chat message with multi-step agent...');

      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: message
      });

      // Run multi-step agent loop
      const result = await this.runAgentLoop();

      // Record successful query
      const duration = Date.now() - startTime;
      agentConfigService.recordQuery(duration, toolCallsCount);

      return result;

    } catch (error) {
      console.error('❌ Agent chat failed:', error);
      agentConfigService.recordFailure();

      agentConfigService.updateState({
        isProcessing: false
      });

      throw error;

    } finally {
      agentConfigService.updateState({ isProcessing: false });
    }
  }

  /**
   * Run the multi-step agent reasoning loop
   */
  private async runAgentLoop(): Promise<string> {
    const maxIterations = this.currentConfig.maxIterations;
    let iteration = 0;

    // Prepare messages with system prompt and tools
    const systemPrompt = this.buildSystemPrompt();
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory
    ];

    while (iteration < maxIterations) {
      iteration++;
      console.log(`🔄 Agent iteration ${iteration}/${maxIterations}`);

      // Emit workflow step event
      this.emitEvent(createWorkflowEvent('workflow_step', {
        stepName: `Iteration ${iteration}`,
        stepDescription: 'Agent reasoning and tool execution',
        progress: iteration,
        totalSteps: maxIterations
      }));

      // Get AI response with tool calling
      const response = await aiClient.chatWithTools(messages);

      // Find the latest assistant message
      const assistantMessages = response.filter(msg => msg.role === 'assistant');
      const latestAssistant = assistantMessages[assistantMessages.length - 1];

      if (!latestAssistant) {
        throw new Error('No assistant response received');
      }

      // Check if there are tool calls
      if (latestAssistant.tool_calls && latestAssistant.tool_calls.length > 0) {
        console.log(`🔧 Processing ${latestAssistant.tool_calls.length} tool calls`);

        // Update conversation history with the complete response
        this.conversationHistory = response.slice(1); // Remove system message

        // Continue the loop for next iteration
        messages.length = 1; // Keep only system message
        messages.push(...this.conversationHistory);

        continue;
      }

      // No more tool calls - we have the final response
      if (latestAssistant.content) {
        // Check if content is meaningful (not just placeholder text)
        const trimmedContent = latestAssistant.content.trim();
        const isPlaceholder = trimmedContent === '...' ||
                             trimmedContent === '' ||
                             trimmedContent.length < 3;

        if (!isPlaceholder) {
          // Add final response to conversation history
          this.conversationHistory.push({
            role: 'assistant',
            content: latestAssistant.content
          });

          console.log(`✅ Agent completed in ${iteration} iterations`);
          return latestAssistant.content;
        } else {
          console.log(`⚠️ Received placeholder content: "${trimmedContent}", continuing iteration...`);
          // Continue to next iteration - treat as if no meaningful response
        }
      }

      // If we get here and it's not the last iteration, continue
      if (iteration < maxIterations) {
        console.log(`🔄 No meaningful response in iteration ${iteration}, continuing...`);
        continue;
      }

      // If we get here on the last iteration, something went wrong
      throw new Error('Assistant response has no meaningful content and no tool calls');
    }

    // Max iterations reached
    const fallbackResponse = 'I apologize, but I reached the maximum number of reasoning steps. Let me provide what I can based on the analysis so far.';

    this.conversationHistory.push({
      role: 'assistant',
      content: fallbackResponse
    });

    return fallbackResponse;
  }

  /**
   * Stream chat with real-time events
   */
  async streamChat(
    message: string,
    onChunk: (chunk: string) => void,
    onEvent?: (event: WorkflowEvent) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let toolCallsCount = 0;

    try {
      agentConfigService.updateState({ isProcessing: true });

      console.log('💬 Streaming chat with multi-step agent...');

      // Subscribe to events if callback provided
      let unsubscribe: (() => void) | undefined;
      if (onEvent) {
        unsubscribe = this.onEvent(onEvent);
      }

      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: message
      });

      // Run multi-step agent loop and stream the final response
      const result = await this.runAgentLoop();

      // Stream the final result
      const words = result.split(' ');
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? '' : ' ') + words[i];
        onChunk(chunk);

        // Small delay for streaming effect
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Clean up event subscription
      if (unsubscribe) {
        unsubscribe();
      }

      // Record successful query
      const duration = Date.now() - startTime;
      agentConfigService.recordQuery(duration, toolCallsCount);

    } catch (error) {
      console.error('❌ Agent stream chat failed:', error);
      agentConfigService.recordFailure();

      agentConfigService.updateState({
        isProcessing: false
      });

      throw error;

    } finally {
      agentConfigService.updateState({ isProcessing: false });
    }
  }

  /**
   * Emit a workflow event
   */
  private emitEvent(event: WorkflowEvent): void {
    this.eventEmitter.emit(event);
  }

  /**
   * Check if the service is connected and ready
   */
  async isConnected(): Promise<boolean> {
    return this.isInitialized && this.availableTools.length > 0;
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return agentConfigService.getState();
  }

  /**
   * Subscribe to workflow events
   */
  onEvent(listener: (event: WorkflowEvent) => void): () => void {
    this.eventEmitter.on('all', listener);
    return () => this.eventEmitter.off('all', listener);
  }

  /**
   * Reinitialize agents when configuration changes
   */
  private async reinitializeAgents(): Promise<void> {
    if (!this.isInitialized) return;

    console.log('🔄 Reinitializing agents due to configuration change...');

    try {
      await this.initializeAgents();
      console.log('✅ Agents reinitialized successfully');
    } catch (error) {
      console.error('❌ Failed to reinitialize agents:', error);
    }
  }
}

// Singleton instance
export const llamaIndexAgent = new CustomAgentService();
