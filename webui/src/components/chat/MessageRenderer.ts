/**
 * Enhanced Message Renderer
 *
 * Extends the existing chat message rendering to detect and visualise
 * structured data from MCP tool responses using DataCards.
 */

import { DataCard, type DataCardConfig } from './DataCard';
import { detectDataType, type DetectionResult } from '../../utils/dataDetection';
import { citationProcessor } from '../../services/citationProcessor';

export interface MessageData {
  content: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  timestamp?: number;
  toolCall?: {
    name: string;
    result: any;
  };
  citations?: any[];
}

export class MessageRenderer {
  private container: HTMLElement;
  private dataCards: DataCard[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render a message with enhanced data visualisation support
   */
  public renderMessage(message: MessageData): HTMLElement {
    console.log('[MessageRenderer] renderMessage called with:', JSON.parse(JSON.stringify(message))); // DEV_PLAN 1.23
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.role}`;

    // Add timestamp if available
    if (message.timestamp) {
      messageElement.setAttribute('data-timestamp', message.timestamp.toString());
    }

    // Create message content
    const contentElement = this.createContentElement(message);
    messageElement.appendChild(contentElement);

    // Check for visualisable data in tool responses
    if (message.toolCall && message.toolCall.result) {
      console.log('[MessageRenderer] Message has toolCall, attempting to create DataCard directly from toolCall.result'); // DEV_PLAN 1.23
      const dataCardElement = this.createDataCardIfApplicable(message.toolCall.name, message.toolCall.result);
      if (dataCardElement) {
        messageElement.appendChild(dataCardElement);
      }
    }

    // Handle citations if present
    // DEV_PLAN 1.22 & 1.23: This is where logic for DataCards from citations should be.
    // Currently, it only creates simple citation links.
    if (message.citations && message.citations.length > 0) {
      console.log('[MessageRenderer] Message has citations:', JSON.parse(JSON.stringify(message.citations))); // DEV_PLAN 1.22
      // TODO: Iterate through citations and attempt to create DataCards if they contain raw tool results.
      // For now, just render the basic citation links.
      const citationsElement = this.createCitationsElement(message.citations);
      messageElement.appendChild(citationsElement);

      // Placeholder for new logic: Attempt to create DataCards from citations
      message.citations.forEach(citation => {
        // Assuming citation object might have a 'rawData' or similar field holding the tool result
        // This structure needs to be confirmed by inspecting the logs.
        const toolResult = citation.rawData || citation.data || citation.result; // Guessing potential fields
        const toolName = citation.toolName || 'unknown_tool_from_citation'; // Guessing potential fields

        if (toolResult) {
          console.log(`[MessageRenderer] Attempting to create DataCard from citation: ${citation.id || 'unknown_id'}`, JSON.parse(JSON.stringify(toolResult)));
          const dataCardElement = this.createDataCardIfApplicable(toolName, toolResult);
          if (dataCardElement) {
            console.log(`[MessageRenderer] Successfully created DataCard from citation: ${citation.id || 'unknown_id'}`);
            // Decide where to append this. For now, append after main message content.
            // This might need a more sophisticated layout strategy.
            messageElement.appendChild(dataCardElement);
          } else {
            console.log(`[MessageRenderer] Did not create DataCard from citation: ${citation.id || 'unknown_id'} (either not visualisable or low confidence)`);
          }
        } else {
          console.log(`[MessageRenderer] Citation ${citation.id || 'unknown_id'} does not seem to contain tool result data for DataCard.`);
        }
      });
    } else {
      console.log('[MessageRenderer] Message has no citations or toolCall.result for DataCard processing.');
    }

    return messageElement;
  }

  /**
   * Create the main content element for the message
   */
  private createContentElement(message: MessageData): HTMLElement {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Add role indicator
    const roleSpan = document.createElement('span');
    roleSpan.className = 'message-role';
    roleSpan.textContent = this.getRoleDisplayName(message.role);
    contentDiv.appendChild(roleSpan);

    // Add message text
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';

    // Process content for markdown or special formatting
    textDiv.innerHTML = this.processMessageContent(message.content);
    contentDiv.appendChild(textDiv);

    // Add tool call info if present
    if (message.toolCall) {
      const toolInfoDiv = document.createElement('div');
      toolInfoDiv.className = 'tool-call-info';
      toolInfoDiv.innerHTML = `
        <small class="tool-name">🔧 ${message.toolCall.name}</small>
      `;
      contentDiv.appendChild(toolInfoDiv);
    }

    return contentDiv;
  }

  /**
   * Create a DataCard if the tool result contains visualisable data
   */
  private createDataCardIfApplicable(toolName: string, toolResult: any): HTMLElement | null { // Modified signature
    console.log('[MessageRenderer] createDataCardIfApplicable called with toolName:', toolName, 'and toolResult:', JSON.parse(JSON.stringify(toolResult))); // DEV_PLAN 1.25
    try {
      // Detect if the result contains visualisable data
      const detection = detectDataType(toolResult);
      console.log('[MessageRenderer] Data detection result:', JSON.parse(JSON.stringify(detection))); // DEV_PLAN 1.24

      if (!detection.visualisable || detection.confidence < 0.6) {
        console.log('[MessageRenderer] Data not visualisable or confidence too low. Visualisable:', detection.visualisable, 'Confidence:', detection.confidence);
        return null;
      }

      // Create container for the data card
      const cardContainer = document.createElement('div');
      cardContainer.className = 'message-data-card';

      // Configure the data card
      const cardConfig: DataCardConfig = {
        title: this.generateCardTitle(toolName, detection), // Use passed toolName
        summary: detection.summary,
        data: toolResult, // Use passed toolResult
        dataType: detection.dataType,
        expanded: true, // Start expanded to show charts immediately
        showChart: true
      };
      console.log('[MessageRenderer] DataCard config:', JSON.parse(JSON.stringify(cardConfig)));

      // Create and store the data card
      const dataCard = new DataCard(cardContainer, cardConfig);
      this.dataCards.push(dataCard);
      console.log('[MessageRenderer] DataCard created successfully.'); // DEV_PLAN 1.25

      return cardContainer;
    } catch (error) {
      console.error('Failed to create data card:', error); // Changed to console.error for better visibility // DEV_PLAN 1.25
      return null;
    }
  }

  /**
   * Generate appropriate title for data card based on tool and data type
   */
  private generateCardTitle(toolName: string, detection: DetectionResult): string {
    const toolDisplayNames: Record<string, string> = {
      'get_kline_data': 'Price Chart Data',
      'get_ml_rsi': 'ML-Enhanced RSI',
      'get_order_blocks': 'Order Blocks Analysis',
      'get_market_structure': 'Market Structure',
      'get_ticker_info': 'Ticker Information'
    };

    const baseTitle = toolDisplayNames[toolName] || toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Add data type context if it adds value
    const dataTypeLabels: Record<string, string> = {
      'kline': 'Candlestick Data',
      'rsi': 'RSI Analysis',
      'orderBlocks': 'Order Blocks',
      'price': 'Price Data',
      'volume': 'Volume Analysis'
    };

    const dataTypeLabel = dataTypeLabels[detection.dataType];
    if (dataTypeLabel && !baseTitle.toLowerCase().includes(dataTypeLabel.toLowerCase())) {
      return `${baseTitle} - ${dataTypeLabel}`;
    }

    return baseTitle;
  }

  /**
   * Create citations element
   */
  private createCitationsElement(citations: any[]): HTMLElement {
    const citationsDiv = document.createElement('div');
    citationsDiv.className = 'message-citations';

    citations.forEach((citation, index) => {
      const citationSpan = document.createElement('span');
      citationSpan.className = 'citation';
      citationSpan.textContent = `[${index + 1}]`;
      citationSpan.title = citation.source || citation.url || 'Citation';
      citationsDiv.appendChild(citationSpan);
    });

    return citationsDiv;
  }

  /**
   * Get display name for message role
   */
  private getRoleDisplayName(role: string): string {
    switch (role) {
      case 'user': return 'You';
      case 'assistant': return 'AI';
      case 'tool': return 'Tool';
      default: return role;
    }
  }

  /**
   * Process message content for basic formatting and citations
   */
  private processMessageContent(content: string): string {
    // Process citations first to convert [REF001] patterns to interactive elements
    const processedMessage = citationProcessor.processMessage(content);
    let processed = processedMessage.processedContent;

    // Basic markdown-like processing
    // Bold text
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic text
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Code blocks
    processed = processed.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code
    processed = processed.replace(/`(.*?)`/g, '<code>$1</code>');

    // Line breaks
    processed = processed.replace(/\n/g, '<br>');

    return processed;
  }

  /**
   * Clear all rendered content and data cards
   */
  public clear(): void {
    // Destroy all data cards
    this.dataCards.forEach(card => card.destroy());
    this.dataCards = [];

    // Clear container
    this.container.innerHTML = '';
  }

  /**
   * Get all active data cards
   */
  public getDataCards(): DataCard[] {
    return [...this.dataCards];
  }

  /**
   * Expand all data cards
   */
  public expandAllCards(): void {
    this.dataCards.forEach(card => card.expand());
  }

  /**
   * Collapse all data cards
   */
  public collapseAllCards(): void {
    this.dataCards.forEach(card => card.collapse());
  }

  /**
   * Remove a specific message element
   */
  public removeMessage(messageElement: HTMLElement): void {
    // Find and destroy associated data cards
    const cardContainers = messageElement.querySelectorAll('.message-data-card');
    cardContainers.forEach(container => {
      const cardIndex = this.dataCards.findIndex(card =>
        container.contains(card['container']) // Access private container property
      );
      if (cardIndex >= 0) {
        this.dataCards[cardIndex].destroy();
        this.dataCards.splice(cardIndex, 1);
      }
    });

    // Remove the message element
    if (messageElement.parentNode) {
      messageElement.parentNode.removeChild(messageElement);
    }
  }

  /**
   * Update container reference
   */
  public setContainer(container: HTMLElement): void {
    this.container = container;
  }
}
