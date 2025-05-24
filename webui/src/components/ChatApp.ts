/**
 * Main chat application component
 */

import type { ChatUIMessage, ChatState, ChatMessage } from '@/types/ai';
import { aiClient, generateSystemPrompt } from '@/services/aiClient';
import { llamaIndexAgent } from '@/services/llamaIndexAgent';
import { agentConfigService } from '@/services/agentConfig';
import { mcpClient } from '@/services/mcpClient';
import { configService } from '@/services/configService';
import type { WorkflowEvent } from '@/types/workflow';

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
  private fullConversationHistory: ChatMessage[] = []; // Track complete conversation including tool calls
  private workflowEventsContainer: HTMLElement | null = null;
  private useAgent: boolean = true; // Toggle between agent and legacy client

  constructor() {
    // Get DOM elements
    this.chatMessages = document.getElementById('chat-messages')!;
    this.chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
    this.sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    this.connectionStatus = document.getElementById('connection-status')!;
    this.typingIndicator = document.getElementById('typing-indicator')!;
    this.workflowEventsContainer = document.getElementById('workflow-events');

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
      const [aiConnected, mcpConnected, agentConnected] = await Promise.all([
        aiClient.isConnected(),
        mcpClient.isConnected(),
        llamaIndexAgent.isConnected(),
      ]);

      if (this.useAgent) {
        this.state.isConnected = agentConnected;

        if (agentConnected) {
          this.connectionStatus.innerHTML = '🤖 Agent Ready';
          this.connectionStatus.className = 'connection-status text-success';
        } else {
          this.connectionStatus.innerHTML = '🔴 Agent Offline';
          this.connectionStatus.className = 'connection-status text-danger';
        }
      } else {
        // Legacy mode
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
      console.log('💬 Starting chat request...');

      if (this.useAgent) {
        // Use LlamaIndex agent with streaming
        await this.handleAgentChat(messageContent);
      } else {
        // Use legacy AI client
        await this.handleLegacyChat(messageContent);
      }

    } catch (error) {
      console.error('❌ Failed to send message:', error);
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        details: (error as any)?.details
      });

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

  /**
   * Handle chat using LlamaIndex agent with streaming and workflow events
   */
  private async handleAgentChat(messageContent: string): Promise<void> {
    console.log('🤖 Using LlamaIndex agent...');

    // Create assistant message for streaming
    const assistantMessage: ChatUIMessage = {
      id: this.generateMessageId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    this.addMessage(assistantMessage);

    // Get the message element for updating
    const messageElement = this.chatMessages.querySelector(`[data-message-id="${assistantMessage.id}"]`);
    const contentElement = messageElement?.querySelector('[data-content]') as HTMLElement;

    if (!contentElement) {
      throw new Error('Could not find message content element');
    }

    try {
      // Stream chat with the agent
      await llamaIndexAgent.streamChat(
        messageContent,
        (chunk: string) => {
          // Update the streaming message content
          assistantMessage.content += chunk;
          contentElement.innerHTML = this.formatMessageContent(assistantMessage.content || '') + '<span class="cursor">|</span>';
          this.scrollToBottom();
        },
        (event: WorkflowEvent) => {
          // Handle workflow events
          this.handleWorkflowEvent(event);
        }
      );

      // Remove streaming cursor
      assistantMessage.isStreaming = false;
      contentElement.innerHTML = this.formatMessageContent(assistantMessage.content || '');

    } catch (error) {
      // Update message with error
      assistantMessage.content = `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      assistantMessage.error = error instanceof Error ? error.message : 'Unknown error';
      assistantMessage.isStreaming = false;

      contentElement.innerHTML = this.formatMessageContent(assistantMessage.content);
      throw error;
    }
  }

  /**
   * Handle chat using legacy AI client (fallback)
   */
  private async handleLegacyChat(messageContent: string): Promise<void> {
    console.log('🔄 Using legacy AI client...');

    // Use the full conversation history if available, otherwise prepare from UI messages
    let aiMessages: ChatMessage[];

    if (this.fullConversationHistory.length > 0) {
      // Use the complete conversation history (includes tool calls and responses)
      aiMessages = [...this.fullConversationHistory];
      // Add the new user message
      aiMessages.push({
        role: 'user',
        content: messageContent,
      });
    } else {
      // First message - prepare from UI messages
      const messages = this.state.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add dynamic system prompt with current timestamp
      const systemPrompt = generateSystemPrompt();
      aiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages,
      ];
    }

    console.log('📝 Prepared messages:', aiMessages);

    // Use tool calling
    console.log('🔄 Calling aiClient.chatWithTools...');
    const conversationMessages = await aiClient.chatWithTools(aiMessages);
    console.log('✅ Got conversation messages:', conversationMessages.length);

    // Update the full conversation history with the complete conversation
    this.fullConversationHistory = conversationMessages;
    console.log('📝 Updated full conversation history:', this.fullConversationHistory.length, 'messages');

    // Find new assistant messages to add to the UI
    const assistantMessages = conversationMessages.filter(msg => msg.role === 'assistant');
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];

    if (lastAssistantMessage && lastAssistantMessage.content) {
      // Add the final assistant response to the UI
      const assistantMessage: ChatUIMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: lastAssistantMessage.content,
        timestamp: Date.now(),
        tool_calls: lastAssistantMessage.tool_calls,
      };
      this.addMessage(assistantMessage);
    } else {
      // No content in the final response
      console.warn('⚠️ No content in final assistant message:', lastAssistantMessage);

      const errorMessage: ChatUIMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: 'I apologize, but I received an empty response. Please try your question again.',
        timestamp: Date.now(),
        error: 'Empty response from AI',
      };
      this.addMessage(errorMessage);
    }
  }

  /**
   * Handle workflow events from the agent
   */
  private handleWorkflowEvent(event: WorkflowEvent): void {
    if (!agentConfigService.getConfig().showWorkflowSteps) {
      return;
    }

    console.log('🔄 Workflow event:', event);

    // Display workflow events in the UI if container exists
    if (this.workflowEventsContainer) {
      const eventElement = document.createElement('div');
      eventElement.className = 'workflow-event';
      eventElement.innerHTML = `
        <div class="event-type">${event.type}</div>
        <div class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
        <div class="event-data">${JSON.stringify(event.data, null, 2)}</div>
      `;
      this.workflowEventsContainer.appendChild(eventElement);
      this.workflowEventsContainer.scrollTop = this.workflowEventsContainer.scrollHeight;
    }
  }

  private addMessage(message: ChatUIMessage): void {
    this.state.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
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
        ${this.formatMessageContent(message.content || '')}
        ${message.isStreaming ? '<span class="cursor">|</span>' : ''}
      </div>
    `;

    this.chatMessages.appendChild(messageElement);
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
    this.fullConversationHistory = [];
    this.chatMessages.innerHTML = '';
    this.loadWelcomeMessage();
  }

  public isLoading(): boolean {
    return this.state.isLoading;
  }

  public toggleAgentMode(useAgent: boolean): void {
    this.useAgent = useAgent;
    this.updateConnectionStatus();
    console.log(`🔄 Switched to ${useAgent ? 'agent' : 'legacy'} mode`);
  }

  public isUsingAgent(): boolean {
    return this.useAgent;
  }

  public isAgentModeEnabled(): boolean {
    return this.useAgent;
  }

  public getAgentState() {
    return llamaIndexAgent.getState();
  }
}
