/**
 * Main chat application component
 */

import type { ChatUIMessage, ChatState, ChatMessage } from '@/types/ai';
import { aiClient, generateSystemPrompt } from '@/services/aiClient';
import { multiStepAgent } from '@/services/multiStepAgent';
import { agentConfigService } from '@/services/agentConfig';
import { mcpClient } from '@/services/mcpClient';
import { configService } from '@/services/configService';
import { citationProcessor } from '@/services/citationProcessor';
import { citationStore } from '@/services/citationStore';
import type { WorkflowEvent } from '@/types/workflow';
import { marked } from 'marked';
import { MessageRenderer, type MessageData } from './chat/MessageRenderer';

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
  private useAgent: boolean = false; // Toggle between agent and legacy client - temporarily disabled for testing
  private lastCitationAttachTime: number = 0;
  private citationAttachThrottle: number = 300; // Throttle to 300ms
  private messageRenderer: MessageRenderer;
  private retryCount: number = 0;
  private maxRetries: number = 2; // Maximum number of automatic retries
  private processingMessage: HTMLElement | null = null;

  constructor() {
    // Configure marked for safe HTML rendering
    marked.setOptions({
      breaks: true, // Convert line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    });
    // Get DOM elements
    this.chatMessages = document.getElementById('chat-messages')!;
    this.chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
    this.sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    this.connectionStatus = document.getElementById('connection-status')!;
    this.typingIndicator = document.getElementById('typing-indicator')!;
    this.workflowEventsContainer = document.getElementById('workflow-events');

    // Initialize the enhanced message renderer
    this.messageRenderer = new MessageRenderer(this.chatMessages);

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
        multiStepAgent.isConnected(),
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

  /**
   * Show processing indicator
   */
  private showProcessingIndicator(isRetry: boolean = false): void {
    this.hideProcessingIndicator(); // Remove any existing indicator

    this.processingMessage = document.createElement('div');
    this.processingMessage.className = 'processing-message';
    this.processingMessage.innerHTML = `
      <div class="message-header">
        <div class="message-avatar">AI</div>
        <span class="message-name">Assistant</span>
        <span class="message-time">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="message-content processing">
        <div class="processing-indicator">
          <div class="processing-dots">
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </div>
          <span class="processing-text">
            ${isRetry ? `🔄 Retrying... (attempt ${this.retryCount + 1}/${this.maxRetries + 1})` : '🤔 Processing your request...'}
          </span>
        </div>
      </div>
    `;

    this.chatMessages.appendChild(this.processingMessage);
    this.scrollToBottom();
  }

  /**
   * Hide processing indicator
   */
  private hideProcessingIndicator(): void {
    if (this.processingMessage) {
      this.processingMessage.remove();
      this.processingMessage = null;
    }
  }

  /**
   * Check if AI response is empty or invalid
   */
  private isEmptyResponse(content: string): boolean {
    if (!content) return true;

    const trimmed = content.trim();
    if (!trimmed) return true;

    // Remove the overly strict length check - valid responses can be short
    // Only check for truly empty or nonsensical patterns
    const emptyPatterns = [
      /^\.+$/,        // Only dots
      /^-+$/,         // Only dashes
      /^\*+$/,        // Only asterisks
      /^_+$/,         // Only underscores
      /^\?+$/,        // Only question marks
      /^!+$/          // Only exclamation marks
    ];

    return emptyPatterns.some(pattern => pattern.test(trimmed));
  }

  public async sendMessage(content?: string): Promise<void> {
    const messageContent = content || this.chatInput.value.trim();

    if (!messageContent || this.state.isLoading) {
      return;
    }

    // Reset retry count for new messages
    if (!content) {
      this.retryCount = 0;
    }

    // Clear input if using the input field
    if (!content) {
      this.chatInput.value = '';
      this.autoResizeTextarea();
      this.updateSendButton();
    }

    // Create user message (only for new messages, not retries)
    if (this.retryCount === 0) {
      const userMessage: ChatUIMessage = {
        id: this.generateMessageId(),
        role: 'user',
        content: messageContent,
        timestamp: Date.now(),
      };
      this.addMessage(userMessage);
    }

    // Set loading state
    this.state.isLoading = true;
    this.updateSendButton();
    this.showTypingIndicator();
    this.showProcessingIndicator(this.retryCount > 0);

    try {
      console.log('💬 Starting chat request...');

      if (this.useAgent) {
        // Use multi-step agent with streaming
        await this.handleAgentChat(messageContent);
      } else {
        // Use legacy AI client
        await this.handleLegacyChat(messageContent);
      }

      // Reset retry count on success
      this.retryCount = 0;

    } catch (error) {
      console.error('❌ Failed to send message:', error);
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        details: (error as any)?.details
      });

      // Check if we should retry
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`🔄 Retrying... attempt ${this.retryCount}/${this.maxRetries}`);

        // Hide current processing indicator and show retry indicator
        this.hideProcessingIndicator();

        // Wait a moment before retrying
        setTimeout(() => {
          this.sendMessage(messageContent);
        }, 1000);
        return;
      }

      // Max retries reached, show error
      const errorMessage: ChatUIMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: `Sorry, I encountered an error after ${this.maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.addMessage(errorMessage);
      this.retryCount = 0; // Reset for next message
    } finally {
      this.state.isLoading = false;
      this.state.currentStreamingId = undefined;
      this.updateSendButton();
      this.hideTypingIndicator();
      this.hideProcessingIndicator();
    }
  }

  /**
   * Handle chat using multi-step agent with streaming and workflow events
   */
  private async handleAgentChat(messageContent: string): Promise<void> {
    console.log('🤖 Using multi-step agent...');

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
      await multiStepAgent.streamChat(
        messageContent,
        (chunk: string) => {
          // Update the streaming message content
          assistantMessage.content += chunk;
          contentElement.innerHTML = this.formatMessageContent(assistantMessage.content || '') + '<span class="cursor">|</span>';

          // Only attach citation listeners if the content contains citation patterns
          // This avoids excessive listener attachment during streaming
          if (assistantMessage.content && assistantMessage.content.includes('[REF') && messageElement) {
            this.addCitationEventListenersThrottled(messageElement as HTMLElement);
          }

          this.scrollToBottom();
        },
        (event: WorkflowEvent) => {
          // Handle workflow events
          this.handleWorkflowEvent(event);
        }
      );

      // Check if response is empty
      if (this.isEmptyResponse(assistantMessage.content)) {
        throw new Error('Received empty response from agent');
      }

      // Remove streaming cursor and finalize
      assistantMessage.isStreaming = false;
      contentElement.innerHTML = this.formatMessageContent(assistantMessage.content || '');

      // Final citation event listener attachment - always do this at the end
      if (messageElement) {
        this.addCitationEventListeners(messageElement as HTMLElement);
      }

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
      // Check if response is empty
      if (this.isEmptyResponse(lastAssistantMessage.content)) {
        throw new Error('Received empty response from AI');
      }

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
      throw new Error('Received empty response from AI');
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
    console.log('[ChatApp] renderMessage called with message:', JSON.parse(JSON.stringify(message))); // DEV_PLAN debug

    // Remove welcome message if this is the first real message
    if (this.state.messages.length === 1) {
      const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
      if (welcomeMessage) {
        welcomeMessage.remove();
      }
    }

    // Check if this message has tool calls or citations and should use enhanced rendering
    const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
    const hasCitations = message.content && /\[REF\d+\]/.test(message.content);
    const shouldUseEnhancedRenderer = (hasToolCalls || hasCitations) && !message.isStreaming;

    console.log('[ChatApp] Rendering decision:', {
      hasToolCalls,
      hasCitations,
      isStreaming: message.isStreaming,
      shouldUseEnhancedRenderer
    }); // DEV_PLAN debug

    if (shouldUseEnhancedRenderer) {
      console.log('[ChatApp] Using enhanced renderer'); // DEV_PLAN debug
      // Use enhanced MessageRenderer for messages with tool results
      this.renderEnhancedMessage(message);
    } else {
      console.log('[ChatApp] Using simple renderer'); // DEV_PLAN debug
      // Use existing rendering for streaming messages and simple text
      this.renderSimpleMessage(message);
    }
  }

  /**
   * Render message using the enhanced MessageRenderer (for tool results)
   */
  private renderEnhancedMessage(message: ChatUIMessage): void {
    console.log('[ChatApp] renderEnhancedMessage called'); // DEV_PLAN debug
    // Extract tool result from citation data if available
    const toolResult = this.extractToolResultFromCitations(message);
    console.log('[ChatApp] Extracted tool result:', toolResult); // DEV_PLAN debug

    // Convert ChatUIMessage to MessageData format
    const messageData: MessageData = {
      content: message.content || '',
      role: message.role,
      timestamp: message.timestamp,
      toolCall: toolResult ? {
        name: toolResult.toolName,
        result: toolResult.data
      } : undefined
    };
    console.log('[ChatApp] Prepared MessageData for MessageRenderer:', JSON.parse(JSON.stringify(messageData))); // DEV_PLAN debug

    // Create a container for this message
    const messageContainer = document.createElement('div');
    messageContainer.className = 'enhanced-message-container';
    messageContainer.dataset.messageId = message.id;

    // Use MessageRenderer to render the enhanced message
    console.log('[ChatApp] Calling messageRenderer.renderMessage...'); // DEV_PLAN debug
    const renderedMessage = this.messageRenderer.renderMessage(messageData);
    messageContainer.appendChild(renderedMessage);

    this.chatMessages.appendChild(messageContainer);

    // Add citation event listeners if this is an assistant message
    if (message.role === 'assistant') {
      setTimeout(() => {
        this.addCitationEventListeners(messageContainer);
      }, 0);
    }
  }

  /**
   * Render message using the existing simple approach (for streaming and simple messages)
   */
  private renderSimpleMessage(message: ChatUIMessage): void {
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

    // Add citation event listeners if this is an assistant message
    if (message.role === 'assistant') {
      setTimeout(() => {
        this.addCitationEventListeners(messageElement);
      }, 0);
    }
  }

  /**
   * Extract tool result from citation data
   */
  private extractToolResultFromCitations(message: ChatUIMessage): { toolName: string; data: any } | null {
    console.log('[ChatApp] extractToolResultFromCitations called with message content:', message.content); // DEV_PLAN 1.22 debug
    const content = message.content || '';

    // Look for citation references in the message content
    const citationMatches = content.match(/\[REF\d+\]/g);
    console.log('[ChatApp] Found citation matches:', citationMatches); // DEV_PLAN 1.22 debug
    if (!citationMatches) {
      return null;
    }

    // Get the first citation reference
    const firstCitation = citationMatches[0];
    console.log('[ChatApp] Processing first citation:', firstCitation); // DEV_PLAN 1.22 debug

    // Remove brackets from citation reference for store lookup
    const referenceId = firstCitation.replace(/[\[\]]/g, ''); // Remove [ and ]
    console.log('[ChatApp] Looking up citation with ID:', referenceId); // DEV_PLAN 1.22 debug

    // Access the citation store to get the stored data
    try {
      const citationData = citationStore.getCitation(referenceId);
      console.log('[ChatApp] Retrieved citation data from store (type:', typeof citationData, '):', citationData); // DEV_PLAN 1.22 debug
      if (citationData && citationData.rawData) {
        const result = {
          toolName: citationData.toolName || 'unknown',
          data: citationData.rawData
        };
        console.log('[ChatApp] Returning tool result:', JSON.parse(JSON.stringify(result))); // DEV_PLAN 1.22 debug
        return result;
      } else {
        console.log('[ChatApp] No rawData found in citation data. Available keys:', citationData ? Object.keys(citationData) : 'null'); // DEV_PLAN 1.22 debug
      }
    } catch (error) {
      console.warn('[ChatApp] Failed to extract citation data:', error); // DEV_PLAN 1.22 debug
      console.warn('[ChatApp] Citation data that caused error:', citationStore.getCitation(firstCitation)); // DEV_PLAN 1.22 debug
    }

    return null;
  }

  private formatMessageContent(content: string): string {
    // Process citations first
    const processedMessage = citationProcessor.processMessage(content);

    try {
      // Use marked to render markdown to HTML (synchronous)
      const htmlContent = marked.parse(processedMessage.processedContent, { async: false }) as string;

      // Basic sanitization - remove potentially dangerous elements
      return this.sanitizeHtml(htmlContent);
    } catch (error) {
      console.warn('Failed to parse markdown, falling back to basic formatting:', error);

      // Fallback to basic formatting if marked fails
      return processedMessage.processedContent
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    }
  }

  /**
   * Basic HTML sanitization to remove potentially dangerous elements
   */
  private sanitizeHtml(html: string): string {
    // Remove script tags and event handlers
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  /**
   * Throttled version of addCitationEventListeners to reduce spam during streaming
   */
  private addCitationEventListenersThrottled(messageElement: HTMLElement): void {
    const now = Date.now();
    if (now - this.lastCitationAttachTime < this.citationAttachThrottle) {
      return; // Skip if called too recently
    }
    this.lastCitationAttachTime = now;
    this.addCitationEventListeners(messageElement);
  }

  /**
   * Add event listeners for citation interactions
   */
  private addCitationEventListeners(messageElement: HTMLElement): void {
    const citationRefs = messageElement.querySelectorAll('.citation-ref');

    // Reduce logging spam - only log once when citations are found
    if (citationRefs.length > 0) {
      console.log(`🎯 Attaching listeners to ${citationRefs.length} citation references`);
    }

    citationRefs.forEach((citationRef) => {
      const element = citationRef as HTMLElement;
      const referenceId = element.dataset.referenceId;

      if (!referenceId) {
        return;
      }

      // Remove default browser tooltip to avoid double tooltips
      element.removeAttribute('title');

      // Add click handler
      element.addEventListener('click', () => {
        console.log(`🖱️ Citation clicked: ${referenceId}`);
        this.handleCitationClick(referenceId);
      });

      // Add hover handlers for tooltip
      let tooltipTimeout: NodeJS.Timeout;
      let tooltip: HTMLElement | null = null;

      element.addEventListener('mouseenter', () => {
        tooltipTimeout = setTimeout(() => {
          tooltip = this.showCitationTooltip(element, referenceId);
        }, 500); // Show tooltip after 500ms hover
      });

      element.addEventListener('mouseleave', () => {
        clearTimeout(tooltipTimeout);
        if (tooltip) {
          tooltip.remove();
          tooltip = null;
        }
      });

      // Add keyboard support
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleCitationClick(referenceId);
        }
      });
    });
  }

  /**
   * Handle citation click to show full data
   */
  private handleCitationClick(referenceId: string): void {
    console.log(`🔍 Handling citation click for: ${referenceId}`);
    const tooltipData = citationProcessor.getCitationTooltipData(referenceId);

    console.log(`📊 Citation tooltip data:`, tooltipData);

    if (!tooltipData) {
      console.warn(`❌ No citation data found for ${referenceId}`);
      return;
    }

    // Create and show modal with full citation data
    this.showCitationModal(tooltipData);
  }

  /**
   * Show citation tooltip on hover
   */
  private showCitationTooltip(element: HTMLElement, referenceId: string): HTMLElement | null {
    const tooltipData = citationProcessor.getCitationTooltipData(referenceId);

    if (!tooltipData) {
      return null;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'citation-tooltip-container';
    tooltip.innerHTML = citationProcessor.createTooltipContent(tooltipData);

    // Add to DOM first to get dimensions
    document.body.appendChild(tooltip);

    // Position tooltip relative to the citation element
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Calculate position (prefer below, but above if no space)
    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    // Adjust if tooltip would go off screen
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - tooltipRect.height - 8;
    }

    tooltip.style.position = 'absolute';
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.zIndex = '1000';

    return tooltip;
  }

  /**
   * Show citation modal with full data
   */
  private showCitationModal(tooltipData: any): void {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'citation-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'citation-modal';

    modal.innerHTML = `
      <div class="citation-modal-header">
        <h3>Citation Data: ${tooltipData.referenceId}</h3>
        <button class="citation-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="citation-modal-content">
        <div class="citation-info">
          <p><strong>Tool:</strong> ${tooltipData.toolName}</p>
          <p><strong>Timestamp:</strong> ${citationProcessor.formatTimestamp(tooltipData.timestamp)}</p>
          ${tooltipData.endpoint ? `<p><strong>Endpoint:</strong> ${tooltipData.endpoint}</p>` : ''}
        </div>
        <div class="citation-raw-data">
          <h4>Raw Data:</h4>
          <pre><code>${JSON.stringify(tooltipData, null, 2)}</code></pre>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add event listeners
    const closeBtn = modal.querySelector('.citation-modal-close');
    const closeModal = () => overlay.remove();

    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Close on Escape key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
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
    this.retryCount = 0;
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
    return multiStepAgent.getState();
  }
}
