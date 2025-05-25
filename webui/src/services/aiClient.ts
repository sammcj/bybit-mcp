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
import { systemPromptService } from './systemPrompt';

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
      console.log('🔧 Available MCP tools:', tools.length);
      console.log('🔧 Tool definitions:', tools);
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

    console.log('🚀 Sending request to AI:', {
      model: request.model,
      toolsCount: tools.length,
      hasTools: !!request.tools,
      toolChoice: request.tool_choice
    });

    try {
      console.log('🌐 Making request to:', `${this.config.endpoint}/v1/chat/completions`);
      console.log('📤 Request body:', JSON.stringify(request, null, 2));

      const response = await fetch(`${this.config.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response body:', errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw this.createError(
          'API_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          errorData
        );
      }

      const data = await response.json();
      console.log('📥 AI Response:', {
        choices: data.choices?.length,
        hasToolCalls: !!data.choices?.[0]?.message?.tool_calls,
        toolCallsCount: data.choices?.[0]?.message?.tool_calls?.length || 0,
        content: data.choices?.[0]?.message?.content?.substring(0, 100) + '...'
      });
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
    console.log('🔧 Executing tool calls:', toolCalls.length);
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        console.log('🔧 Processing tool call:', toolCall);
        const { function: func } = toolCall;

        // Parse arguments if they're a string (from Ollama format)
        const args = typeof func.arguments === 'string'
          ? JSON.parse(func.arguments)
          : func.arguments;

        console.log(`🔧 Calling tool ${func.name} with args:`, args);
        const result = await mcpClient.callTool(func.name, args);
        console.log(`✅ Tool ${func.name} result:`, result);

        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result, null, 2),
        });
      } catch (error) {
        console.error(`❌ Tool execution failed for ${toolCall.function?.name}:`, error);
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    console.log('🔧 Tool execution results:', results);
    return results;
  }

  /**
   * Parse tool calls from text content (fallback for models that don't support function calling)
   */
  private parseToolCallsFromText(content: string): { toolCalls: any[], cleanContent: string } {
    // Match both single and triple backticks
    const toolCallPattern = /(`{1,3})tool_code\s*\n?([^`]+)\1/g;
    const toolCalls: any[] = [];
    let cleanContent = content;

    let match;
    while ((match = toolCallPattern.exec(content)) !== null) {
      const toolCallText = match[2].trim(); // match[2] is the content, match[1] is the backticks

      // Parse function call like: get_ticker(symbol="BTCUSDT")
      const functionCallPattern = /(\w+)\s*\(\s*([^)]*)\s*\)/;
      const funcMatch = functionCallPattern.exec(toolCallText);

      if (funcMatch) {
        const functionName = funcMatch[1];
        const argsString = funcMatch[2];

        // Parse arguments (simple key=value parsing)
        const args: Record<string, any> = {};
        if (argsString) {
          const argPattern = /(\w+)\s*=\s*"([^"]+)"/g;
          let argMatch;
          while ((argMatch = argPattern.exec(argsString)) !== null) {
            args[argMatch[1]] = argMatch[2];
          }
        }

        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          type: 'function',
          function: {
            name: functionName,
            arguments: JSON.stringify(args)
          }
        });

        // Remove the tool call from content
        cleanContent = cleanContent.replace(match[0], '').trim();
      }
    }

    return { toolCalls, cleanContent };
  }

  /**
   * Send a chat completion with automatic tool calling
   */
  async chatWithTools(messages: ChatMessage[]): Promise<ChatMessage[]> {
    const conversationMessages = [...messages];
    let response = await this.chat(conversationMessages);

    // Check if the response contains tool calls
    const choice = response.choices[0];
    let toolCalls = choice?.message?.tool_calls;
    let content = choice?.message?.content || '';

    // If no native tool calls, try to parse from text content
    if (!toolCalls && content) {
      const parsed = this.parseToolCallsFromText(content);
      if (parsed.toolCalls.length > 0) {
        toolCalls = parsed.toolCalls;
        content = parsed.cleanContent;
        console.log('🔍 Parsed tool calls from text:', toolCalls);
      }
    }

    if (toolCalls && toolCalls.length > 0) {
      // Add the assistant's message with tool calls
      conversationMessages.push({
        role: 'assistant',
        content: content,
        tool_calls: toolCalls,
      });

      // Execute tool calls
      const toolResults = await this.executeToolCalls(toolCalls);

      // Add tool results to conversation
      conversationMessages.push(...toolResults);

      // Get final response with tool results - reuse the same conversation context
      console.log('🔄 Getting final response with tool results (system prompt already included)');
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
   * Create a standardised error object
   */
  private createError(code: string, message: string, details?: unknown): AIError {
    const error = new Error(message) as Error & AIError;
    error.code = code;
    error.message = message;
    error.details = details;
    return error;
  }
}

// Function to generate system prompt with current timestamp
export function generateSystemPrompt(): string {
  // Use the centralized system prompt service for legacy compatibility
  return systemPromptService.generateLegacySystemPrompt();
}

// Async function to generate system prompt with dynamic tools
export async function generateDynamicSystemPrompt(): Promise<string> {
  return await systemPromptService.generateSystemPrompt({
    includeTimestamp: true,
    includeTools: true,
    includeMemoryContext: false
  });
}

// Default system prompt for Bybit MCP integration (for backward compatibility)
export const DEFAULT_SYSTEM_PROMPT = generateSystemPrompt();

// Create default AI client instance
export function createAIClient(config?: Partial<AIConfig>): AIClient {
  const defaultConfig: AIConfig = {
    endpoint: 'http://localhost:11434',
    model: 'qwen3-30b-a3b-ud-128k-nothink:q4_k_xl',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    ...config,
  };

  return new AIClient(defaultConfig);
}

// Singleton instance
export const aiClient = createAIClient();
