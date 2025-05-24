/**
 * TypeScript types for AI integration (OpenAI-compatible API)
 */

// Chat message types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  id?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionStreamResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
}

// AI configuration
export interface AIConfig {
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

// Chat UI types
export interface ChatUIMessage extends ChatMessage {
  id: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
}

export interface ChatState {
  messages: ChatUIMessage[];
  isLoading: boolean;
  isConnected: boolean;
  currentStreamingId?: string;
}

// Tool calling types (for function calling)
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallMessage extends Omit<ChatMessage, 'content'> {
  content: null;
  tool_calls: ToolCall[];
}

export interface ToolResponseMessage extends ChatMessage {
  tool_call_id: string;
  name: string;
}

// AI service interface
export interface AIService {
  chat(messages: ChatMessage[], options?: Partial<ChatCompletionRequest>): Promise<ChatCompletionResponse>;
  streamChat(
    messages: ChatMessage[], 
    onChunk: (chunk: ChatCompletionStreamResponse) => void,
    options?: Partial<ChatCompletionRequest>
  ): Promise<void>;
  isConnected(): Promise<boolean>;
}

// Error types
export interface AIError {
  code: string;
  message: string;
  details?: unknown;
}

// Model information
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  capabilities?: string[];
}

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  messages: ChatUIMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessage?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

// Settings types
export interface ChatSettings {
  ai: AIConfig;
  mcp: {
    endpoint: string;
    timeout: number;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    showTimestamps: boolean;
    enableSounds: boolean;
  };
}

// Event types for real-time updates
export type ChatEvent = 
  | { type: 'message_start'; messageId: string }
  | { type: 'message_chunk'; messageId: string; content: string }
  | { type: 'message_complete'; messageId: string }
  | { type: 'message_error'; messageId: string; error: string }
  | { type: 'connection_status'; connected: boolean }
  | { type: 'typing_start' }
  | { type: 'typing_stop' };

// Utility types
export type MessageRole = ChatMessage['role'];
export type StreamingState = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';
