/**
 * AI client for OpenAI-compatible API integration (Ollama, etc.)
 */

import type {
  AIService,
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  AIConfig,
  AIError,
  ModelInfo,
} from '@/types/ai';
import { mcpClient } from './mcpClient';

export class AIClient implements AIService {
  private config: AIConfig;
  private controller?: AbortController;

  constructor(config: AIConfig) {
    this.config = { ...config };
  }

  /**
   * Send a chat completion request with tool calling support
   */
  async chat(
    messages: ChatMessage[],
    options?: Partial<ChatCompletionRequest>
  ): Promise<ChatCompletionResponse> {
    // First, try to get available tools from MCP
    let tools: any[] = [];
    try {
      const mcpTools = await mcpClient.getTools();
      tools = mcpTools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
    } catch (error) {
      console.warn('Failed to get MCP tools:', error);
    }

    const request: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      ...options,
    };

    try {
      const response = await fetch(`${this.config.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createError(
          'API_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          errorData
        );
      }

      const data = await response.json();
      return data as ChatCompletionResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('REQUEST_CANCELLED', 'Request was cancelled');
      }

      if (error instanceof Error) {
        throw error;
      }

      throw this.createError('UNKNOWN_ERROR', 'An unknown error occurred');
    }
  }

  /**
   * Execute tool calls and return results
   */
  async executeToolCalls(toolCalls: any[]): Promise<any[]> {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const { function: func } = toolCall;
        const result = await mcpClient.callTool(func.name, func.arguments);

        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result, null, 2),
        });
      } catch (error) {
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return results;
  }

  /**
   * Send a chat completion with automatic tool calling
   */
  async chatWithTools(messages: ChatMessage[]): Promise<ChatMessage[]> {
    const conversationMessages = [...messages];
    let response = await this.chat(conversationMessages);

    // Check if the response contains tool calls
    const choice = response.choices[0];
    if (choice?.message?.tool_calls) {
      // Add the assistant's message with tool calls
      conversationMessages.push({
        role: 'assistant',
        content: choice.message.content || '',
        tool_calls: choice.message.tool_calls,
      });

      // Execute tool calls
      const toolResults = await this.executeToolCalls(choice.message.tool_calls);

      // Add tool results to conversation
      conversationMessages.push(...toolResults);

      // Get final response with tool results
      response = await this.chat(conversationMessages);
    }

    return conversationMessages.concat({
      role: 'assistant',
      content: response.choices[0]?.message?.content || '',
    });
  }

  /**
   * Send a streaming chat completion request
   */
  async streamChat(
    messages: ChatMessage[],
    onChunk: (chunk: ChatCompletionStreamResponse) => void,
    options?: Partial<ChatCompletionRequest>
  ): Promise<void> {
    // Cancel any existing stream
    this.cancelStream();

    this.controller = new AbortController();

    const request: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
      ...options,
    };

    try {
      const response = await fetch(`${this.config.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: this.controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createError(
          'API_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          errorData
        );
      }

      if (!response.body) {
        throw this.createError('STREAM_ERROR', 'No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                return;
              }

              try {
                const parsed = JSON.parse(data) as ChatCompletionStreamResponse;
                onChunk(parsed);
              } catch (parseError) {
                console.warn('Failed to parse streaming chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('REQUEST_CANCELLED', 'Stream was cancelled');
      }

      if (error instanceof Error) {
        throw error;
      }

      throw this.createError('STREAM_ERROR', 'Streaming failed');
    } finally {
      this.controller = undefined;
    }
  }

  /**
   * Cancel the current streaming request
   */
  cancelStream(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = undefined;
    }
  }

  /**
   * Check if the AI service is connected and available
   */
  async isConnected(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available models from the AI service
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/models`);

      if (!response.ok) {
        throw this.createError('API_ERROR', 'Failed to fetch models');
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        return data.data.map((model: any) => ({
          id: model.id,
          name: model.id,
          description: model.description,
          contextLength: model.context_length,
          capabilities: model.capabilities,
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  /**
   * Update the AI configuration
   */
  updateConfig(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }



  /**
   * Create a standardized error object
   */
  private createError(code: string, message: string, details?: unknown): AIError {
    const error = new Error(message) as Error & AIError;
    error.code = code;
    error.message = message;
    error.details = details;
    return error;
  }
}

// Default system prompt for Bybit MCP integration
export const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant specialized in cryptocurrency trading and market analysis. You have access to the Bybit MCP server which provides real-time market data and advanced technical analysis tools.

Available tools include:
- get_ticker: Get real-time price data for trading pairs
- get_kline: Get candlestick/OHLCV data for charts
- get_orderbook: Get market depth data
- get_ml_rsi: Get ML-enhanced RSI analysis with adaptive thresholds
- get_order_blocks: Detect institutional order accumulation zones
- get_market_structure: Comprehensive market analysis with regime detection

When users ask about market data or analysis:
1. Use the appropriate MCP tools to fetch current data
2. Provide clear, actionable insights
3. Explain technical concepts in an accessible way
4. Include relevant charts and visualizations when possible
5. Always mention the timestamp of data and any limitations

Be helpful, accurate, and focused on providing valuable trading insights while emphasizing risk management.`;

// Create default AI client instance
export function createAIClient(config?: Partial<AIConfig>): AIClient {
  const defaultConfig: AIConfig = {
    endpoint: 'http://localhost:11434',
    model: 'gemma-3-27b-ud-it:q6_k_xl',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    ...config,
  };

  return new AIClient(defaultConfig);
}

// Singleton instance
export const aiClient = createAIClient();
