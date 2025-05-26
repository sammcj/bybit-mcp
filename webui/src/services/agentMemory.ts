/**
 * Agent Memory Service - Manages conversation memory, market context, and analysis history
 */

import type { ChatMessage } from '@/types/ai';

export interface ConversationMemory {
  id: string;
  timestamp: number;
  messages: ChatMessage[];
  summary?: string;
  topics: string[];
  symbols: string[];
  analysisType?: 'quick' | 'standard' | 'comprehensive';
}

export interface MarketContext {
  symbol: string;
  lastPrice?: number;
  priceChange24h?: number;
  volume24h?: number;
  lastUpdated: number;
  technicalIndicators?: {
    rsi?: number;
    macd?: any;
    orderBlocks?: any[];
  };
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  keyLevels?: {
    support: number[];
    resistance: number[];
  };
}

export interface AnalysisHistory {
  id: string;
  timestamp: number;
  symbol: string;
  analysisType: 'quick' | 'standard' | 'comprehensive';
  query: string;
  response: string;
  toolsUsed: string[];
  duration: number;
  accuracy?: number; // User feedback on accuracy
  relevance?: number; // User feedback on relevance
}

export class AgentMemoryService {
  private static readonly CONVERSATION_STORAGE_KEY = 'bybit-mcp-conversations';
  private static readonly MARKET_CONTEXT_STORAGE_KEY = 'bybit-mcp-market-context';
  private static readonly ANALYSIS_HISTORY_STORAGE_KEY = 'bybit-mcp-analysis-history';

  private static readonly MAX_CONVERSATIONS = 50;
  private static readonly MAX_ANALYSIS_HISTORY = 100;
  private static readonly CONTEXT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  private conversations: ConversationMemory[] = [];
  private marketContexts: Map<string, MarketContext> = new Map();
  private analysisHistory: AnalysisHistory[] = [];

  constructor() {
    this.loadFromStorage();
    this.cleanupExpiredData();
  }

  // Conversation Memory Management

  /**
   * Start a new conversation
   */
  startConversation(initialMessage?: ChatMessage): string {
    const conversationId = this.generateId();
    const conversation: ConversationMemory = {
      id: conversationId,
      timestamp: Date.now(),
      messages: initialMessage ? [initialMessage] : [],
      topics: [],
      symbols: []
    };

    this.conversations.unshift(conversation);
    this.trimConversations();
    this.saveConversations();

    return conversationId;
  }

  /**
   * Add message to current conversation
   */
  addMessage(conversationId: string, message: ChatMessage): void {
    const conversation = this.conversations.find(c => c.id === conversationId);
    if (!conversation) {
      console.warn(`Conversation ${conversationId} not found`);
      return;
    }

    conversation.messages.push(message);

    // Extract symbols and topics from message content
    if (message.content) {
      this.extractSymbolsAndTopics(message.content, conversation);
    }

    this.saveConversations();
  }

  /**
   * Get conversation by ID
   */
  getConversation(conversationId: string): ConversationMemory | undefined {
    return this.conversations.find(c => c.id === conversationId);
  }

  /**
   * Get recent conversations
   */
  getRecentConversations(limit: number = 10): ConversationMemory[] {
    return this.conversations.slice(0, limit);
  }

  /**
   * Get conversation context for a symbol
   */
  getSymbolContext(symbol: string, limit: number = 5): ChatMessage[] {
    const relevantMessages: ChatMessage[] = [];

    for (const conversation of this.conversations) {
      if (conversation.symbols.includes(symbol.toUpperCase())) {
        relevantMessages.push(...conversation.messages);
        if (relevantMessages.length >= limit * 2) break; // Get more than needed to filter
      }
    }

    // Filter for most relevant messages
    return relevantMessages
      .filter(msg => msg.content?.toLowerCase().includes(symbol.toLowerCase()))
      .slice(0, limit);
  }

  // Market Context Management

  /**
   * Update market context for a symbol
   */
  updateMarketContext(symbol: string, context: Partial<MarketContext>): void {
    const existing = this.marketContexts.get(symbol.toUpperCase()) || {
      symbol: symbol.toUpperCase(),
      lastUpdated: Date.now()
    };

    const updated: MarketContext = {
      ...existing,
      ...context,
      lastUpdated: Date.now()
    };

    this.marketContexts.set(symbol.toUpperCase(), updated);
    this.saveMarketContexts();
  }

  /**
   * Get market context for a symbol
   */
  getMarketContext(symbol: string): MarketContext | undefined {
    const context = this.marketContexts.get(symbol.toUpperCase());

    // Check if context is still fresh
    if (context && Date.now() - context.lastUpdated < AgentMemoryService.CONTEXT_EXPIRY_MS) {
      return context;
    }

    return undefined;
  }

  /**
   * Get all market contexts
   */
  getAllMarketContexts(): MarketContext[] {
    const now = Date.now();
    return Array.from(this.marketContexts.values())
      .filter(context => now - context.lastUpdated < AgentMemoryService.CONTEXT_EXPIRY_MS);
  }

  // Analysis History Management

  /**
   * Record an analysis
   */
  recordAnalysis(analysis: Omit<AnalysisHistory, 'id' | 'timestamp'>): string {
    const analysisId = this.generateId();
    const record: AnalysisHistory = {
      id: analysisId,
      timestamp: Date.now(),
      ...analysis
    };

    this.analysisHistory.unshift(record);
    this.trimAnalysisHistory();
    this.saveAnalysisHistory();

    return analysisId;
  }

  /**
   * Get analysis history for a symbol
   */
  getSymbolAnalysisHistory(symbol: string, limit: number = 10): AnalysisHistory[] {
    return this.analysisHistory
      .filter(analysis => analysis.symbol.toUpperCase() === symbol.toUpperCase())
      .slice(0, limit);
  }

  /**
   * Get recent analysis history
   */
  getRecentAnalysisHistory(limit: number = 20): AnalysisHistory[] {
    return this.analysisHistory.slice(0, limit);
  }

  /**
   * Update analysis feedback
   */
  updateAnalysisFeedback(analysisId: string, accuracy?: number, relevance?: number): void {
    const analysis = this.analysisHistory.find(a => a.id === analysisId);
    if (analysis) {
      if (accuracy !== undefined) analysis.accuracy = accuracy;
      if (relevance !== undefined) analysis.relevance = relevance;
      this.saveAnalysisHistory();
    }
  }

  // Context Building for AI

  /**
   * Build context summary for AI prompt
   */
  buildContextSummary(symbol?: string): string {
    const contextParts: string[] = [];

    // Add market context if available
    if (symbol) {
      const marketContext = this.getMarketContext(symbol);
      if (marketContext) {
        contextParts.push(`Recent ${symbol} context: Price $${marketContext.lastPrice}, 24h change ${marketContext.priceChange24h}%`);

        if (marketContext.sentiment) {
          contextParts.push(`Market sentiment: ${marketContext.sentiment}`);
        }

        if (marketContext.technicalIndicators?.rsi) {
          contextParts.push(`RSI: ${marketContext.technicalIndicators.rsi}`);
        }
      }

      // Add recent analysis patterns
      const recentAnalyses = this.getSymbolAnalysisHistory(symbol, 3);
      if (recentAnalyses.length > 0) {
        const avgAccuracy = recentAnalyses
          .filter(a => a.accuracy !== undefined)
          .reduce((sum, a) => sum + (a.accuracy || 0), 0) / recentAnalyses.length;

        if (avgAccuracy > 0) {
          contextParts.push(`Recent analysis accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
        }
      }
    }

    return contextParts.length > 0 ? `\nContext: ${contextParts.join('. ')}` : '';
  }

  // Utility Methods

  /**
   * Extract symbols and topics from message content
   */
  private extractSymbolsAndTopics(content: string, conversation: ConversationMemory): void {
    // Extract crypto symbols (BTC, ETH, etc.)
    const symbolMatches = content.match(/\b[A-Z]{2,5}(?:USD|USDT|BTC|ETH)?\b/g);
    if (symbolMatches) {
      symbolMatches.forEach(symbol => {
        const cleanSymbol = symbol.replace(/(USD|USDT|BTC|ETH)$/, '');
        if (cleanSymbol.length >= 2 && !conversation.symbols.includes(cleanSymbol)) {
          conversation.symbols.push(cleanSymbol);
        }
      });
    }

    // Extract topics (price, analysis, technical, etc.)
    const topicKeywords = ['price', 'analysis', 'technical', 'support', 'resistance', 'trend', 'volume', 'rsi', 'macd'];
    topicKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword) && !conversation.topics.includes(keyword)) {
        conversation.topics.push(keyword);
      }
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Trim conversations to max limit
   */
  private trimConversations(): void {
    if (this.conversations.length > AgentMemoryService.MAX_CONVERSATIONS) {
      this.conversations = this.conversations.slice(0, AgentMemoryService.MAX_CONVERSATIONS);
    }
  }

  /**
   * Trim analysis history to max limit
   */
  private trimAnalysisHistory(): void {
    if (this.analysisHistory.length > AgentMemoryService.MAX_ANALYSIS_HISTORY) {
      this.analysisHistory = this.analysisHistory.slice(0, AgentMemoryService.MAX_ANALYSIS_HISTORY);
    }
  }

  /**
   * Clean up expired data
   */
  private cleanupExpiredData(): void {
    const now = Date.now();

    // Remove expired market contexts
    for (const [symbol, context] of this.marketContexts.entries()) {
      if (now - context.lastUpdated > AgentMemoryService.CONTEXT_EXPIRY_MS) {
        this.marketContexts.delete(symbol);
      }
    }

    // Remove old conversations (older than 7 days)
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    this.conversations = this.conversations.filter(c => c.timestamp > weekAgo);

    // Remove old analysis history (older than 30 days)
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    this.analysisHistory = this.analysisHistory.filter(a => a.timestamp > monthAgo);
  }

  // Storage Methods

  private loadFromStorage(): void {
    try {
      const conversationsData = localStorage.getItem(AgentMemoryService.CONVERSATION_STORAGE_KEY);
      if (conversationsData) {
        this.conversations = JSON.parse(conversationsData);
      }

      const marketContextData = localStorage.getItem(AgentMemoryService.MARKET_CONTEXT_STORAGE_KEY);
      if (marketContextData) {
        const contexts = JSON.parse(marketContextData);
        this.marketContexts = new Map(Object.entries(contexts));
      }

      const analysisHistoryData = localStorage.getItem(AgentMemoryService.ANALYSIS_HISTORY_STORAGE_KEY);
      if (analysisHistoryData) {
        this.analysisHistory = JSON.parse(analysisHistoryData);
      }
    } catch (error) {
      console.warn('Failed to load memory data from storage:', error);
    }
  }

  private saveConversations(): void {
    try {
      localStorage.setItem(AgentMemoryService.CONVERSATION_STORAGE_KEY, JSON.stringify(this.conversations));
    } catch (error) {
      console.warn('Failed to save conversations to storage:', error);
    }
  }

  private saveMarketContexts(): void {
    try {
      const contextsObj = Object.fromEntries(this.marketContexts);
      localStorage.setItem(AgentMemoryService.MARKET_CONTEXT_STORAGE_KEY, JSON.stringify(contextsObj));
    } catch (error) {
      console.warn('Failed to save market contexts to storage:', error);
    }
  }

  private saveAnalysisHistory(): void {
    try {
      localStorage.setItem(AgentMemoryService.ANALYSIS_HISTORY_STORAGE_KEY, JSON.stringify(this.analysisHistory));
    } catch (error) {
      console.warn('Failed to save analysis history to storage:', error);
    }
  }

  /**
   * Clear all memory data
   */
  clearAllMemory(): void {
    this.conversations = [];
    this.marketContexts.clear();
    this.analysisHistory = [];

    localStorage.removeItem(AgentMemoryService.CONVERSATION_STORAGE_KEY);
    localStorage.removeItem(AgentMemoryService.MARKET_CONTEXT_STORAGE_KEY);
    localStorage.removeItem(AgentMemoryService.ANALYSIS_HISTORY_STORAGE_KEY);
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return {
      conversations: this.conversations.length,
      marketContexts: this.marketContexts.size,
      analysisHistory: this.analysisHistory.length,
      totalSymbols: new Set([
        ...Array.from(this.marketContexts.keys()),
        ...this.conversations.flatMap(c => c.symbols)
      ]).size
    };
  }
}

// Singleton instance
export const agentMemory = new AgentMemoryService();
