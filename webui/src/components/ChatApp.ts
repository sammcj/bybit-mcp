/**
 * Main chat application component
 */

import type { ChatUIMessage, ChatState, ChatCompletionStreamResponse } from '@/types/ai';
import { aiClient } from '@/services/aiClient';
import { mcpClient } from '@/services/mcpClient';
import { configService } from '@/services/configService';

export class ChatApp {
  private state: ChatState = {
    messages: [],
    isLoading: false,
    isConnected: false,
    currentStreamingId: undefined,
  };

  private chatMessages: HTMLElement;
  private chatInput: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private connectionStatus: HTMLElement;
  private typingIndicator: HTMLElement;

  constructor() {
    // Get DOM elements
    this.chatMessages = document.getElementById('chat-messages')!;
    this.chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
    this.sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    this.connectionStatus = document.getElementById('connection-status')!;
    this.typingIndicator = document.getElementById('typing-indicator')!;

    this.initialize();
  }

  private initialize(): void {
    this.setupEventListeners();
    this.updateConnectionStatus();
    this.loadWelcomeMessage();
  }

  private setupEventListeners(): void {
    // Send button click
    this.sendBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    // Enter key to send (Shift+Enter for new line)
    this.chatInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.chatInput.addEventListener('input', () => {
      this.autoResizeTextarea();
      this.updateSendButton();
    });

    // Update send button state on input
    this.chatInput.addEventListener('input', () => {
      this.updateSendButton();
    });

    // Listen for configuration changes
    configService.subscribe(() => {
      this.updateConnectionStatus();
    });
  }

  private autoResizeTextarea(): void {
    this.chatInput.style.height = 'auto';
    this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 128) + 'px';
  }

  private updateSendButton(): void {
    const hasText = this.chatInput.value.trim().length > 0;
    this.sendBtn.disabled = !hasText || this.state.isLoading;
  }

  private async updateConnectionStatus(): Promise<void> {
    try {
      const [aiConnected, mcpConnected] = await Promise.all([
        aiClient.isConnected(),
        mcpClient.isConnected(),
      ]);

      this.state.isConnected = aiConnected && mcpConnected;

      if (this.state.isConnected) {
        this.connectionStatus.innerHTML = '🟢 Connected';
        this.connectionStatus.className = 'connection-status text-success';
      } else if (aiConnected && !mcpConnected) {
        this.connectionStatus.innerHTML = '🟡 AI Only';
        this.connectionStatus.className = 'connection-status text-warning';
      } else if (!aiConnected && mcpConnected) {
        this.connectionStatus.innerHTML = '🟡 MCP Only';
        this.connectionStatus.className = 'connection-status text-warning';
      } else {
        this.connectionStatus.innerHTML = '🔴 Disconnected';
        this.connectionStatus.className = 'connection-status text-danger';
      }
    } catch (error) {
      console.error('Failed to check connection status:', error);
      this.connectionStatus.innerHTML = '🔴 Error';
      this.connectionStatus.className = 'connection-status text-danger';
    }
  }

  private loadWelcomeMessage(): void {
    // Clear any existing messages
    this.state.messages = [];

    // The welcome message is already in the HTML, so we don't need to add it programmatically
    // Just ensure the chat messages container is ready for new messages
  }

  public async sendMessage(content?: string): Promise<void> {
    const messageContent = content || this.chatInput.value.trim();

    if (!messageContent || this.state.isLoading) {
      return;
    }

    // Clear input if using the input field
    if (!content) {
      this.chatInput.value = '';
      this.autoResizeTextarea();
      this.updateSendButton();
    }

    // Create user message
    const userMessage: ChatUIMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    // Add user message to state and UI
    this.addMessage(userMessage);

    // Set loading state
    this.state.isLoading = true;
    this.updateSendButton();
    this.showTypingIndicator();

    try {
      // Prepare messages for AI
      const messages = this.state.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add system prompt
      const systemPrompt = configService.getAIConfig().systemPrompt;
      const aiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages,
      ];

      // Create assistant message for streaming
      const assistantMessage: ChatUIMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };

      this.addMessage(assistantMessage);
      this.state.currentStreamingId = assistantMessage.id;

      // Stream response
      await aiClient.streamChat(
        aiMessages,
        (chunk: ChatCompletionStreamResponse) => {
          this.handleStreamChunk(chunk, assistantMessage.id);
        }
      );

      // Mark streaming as complete
      this.completeStreaming(assistantMessage.id);

    } catch (error) {
      console.error('Failed to send message:', error);

      // Add error message
      const errorMessage: ChatUIMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.addMessage(errorMessage);
    } finally {
      this.state.isLoading = false;
      this.state.currentStreamingId = undefined;
      this.updateSendButton();
      this.hideTypingIndicator();
    }
  }

  private handleStreamChunk(chunk: ChatCompletionStreamResponse, messageId: string): void {
    const choice = chunk.choices[0];
    if (choice?.delta?.content) {
      this.appendToMessage(messageId, choice.delta.content);
    }
  }

  private addMessage(message: ChatUIMessage): void {
    this.state.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
  }

  private appendToMessage(messageId: string, content: string): void {
    const message = this.state.messages.find(m => m.id === messageId);
    if (message) {
      message.content += content;
      this.updateMessageContent(messageId, message.content);
    }
  }

  private completeStreaming(messageId: string): void {
    const message = this.state.messages.find(m => m.id === messageId);
    if (message) {
      message.isStreaming = false;
      this.updateMessageStreamingState(messageId, false);
    }
  }

  private renderMessage(message: ChatUIMessage): void {
    // Remove welcome message if this is the first real message
    if (this.state.messages.length === 1) {
      const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
      if (welcomeMessage) {
        welcomeMessage.remove();
      }
    }

    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.dataset.messageId = message.id;

    const avatar = message.role === 'user' ? 'U' : 'AI';
    const avatarClass = message.role === 'user' ? 'user' : '';
    const contentClass = message.role === 'user' ? 'user' : '';
    const name = message.role === 'user' ? 'You' : 'Assistant';
    const time = new Date(message.timestamp).toLocaleTimeString();

    messageElement.innerHTML = `
      <div class="message-header">
        <div class="message-avatar ${avatarClass}">${avatar}</div>
        <span class="message-name">${name}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-content ${contentClass}" data-content>
        ${this.formatMessageContent(message.content)}
        ${message.isStreaming ? '<span class="cursor">|</span>' : ''}
      </div>
    `;

    this.chatMessages.appendChild(messageElement);
  }

  private updateMessageContent(messageId: string, content: string): void {
    const messageElement = this.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
    const contentElement = messageElement?.querySelector('[data-content]');

    if (contentElement) {
      contentElement.innerHTML = this.formatMessageContent(content) + '<span class="cursor">|</span>';
    }
  }

  private updateMessageStreamingState(messageId: string, isStreaming: boolean): void {
    const messageElement = this.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
    const contentElement = messageElement?.querySelector('[data-content]');

    if (contentElement && !isStreaming) {
      // Remove cursor
      const cursor = contentElement.querySelector('.cursor');
      if (cursor) {
        cursor.remove();
      }
    }
  }

  private formatMessageContent(content: string): string {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  private showTypingIndicator(): void {
    this.typingIndicator.classList.remove('hidden');
  }

  private hideTypingIndicator(): void {
    this.typingIndicator.classList.add('hidden');
  }

  private scrollToBottom(): void {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external use
  public getMessages(): ChatUIMessage[] {
    return [...this.state.messages];
  }

  public clearMessages(): void {
    this.state.messages = [];
    this.chatMessages.innerHTML = '';
    this.loadWelcomeMessage();
  }

  public isLoading(): boolean {
    return this.state.isLoading;
  }
}
