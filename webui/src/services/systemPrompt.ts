/**
 * Centralised system prompt service for consistent AI agent behavior
 */

import { mcpClient } from './mcpClient';
import type { MCPTool } from '@/types/mcp';

export interface SystemPromptConfig {
  includeTimestamp?: boolean;
  includeTools?: boolean;
  includeMemoryContext?: boolean;
  customInstructions?: string;
}

export class SystemPromptService {
  private static instance: SystemPromptService;
  private cachedTools: MCPTool[] = [];
  private lastToolsUpdate: number = 0;
  private readonly TOOLS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): SystemPromptService {
    if (!SystemPromptService.instance) {
      SystemPromptService.instance = new SystemPromptService();
    }
    return SystemPromptService.instance;
  }

  /**
   * Generate the complete system prompt with all components
   */
  public async generateSystemPrompt(config: SystemPromptConfig = {}): Promise<string> {
    const {
      includeTimestamp = true,
      includeTools = true,
      includeMemoryContext = false, // Reserved for future use
      customInstructions
    } = config;

    let prompt = this.getBasePrompt();

    // Add current timestamp
    if (includeTimestamp) {
      prompt += `\n\nCurrent date and time: ${this.getCurrentTimestamp()}`;
    }

    // Add dynamic tools list
    if (includeTools) {
      const toolsSection = await this.generateToolsSection();
      if (toolsSection) {
        prompt += `\n\n${toolsSection}`;
      }
    }

    // Add guidelines and instructions
    prompt += `\n\n${this.getGuidelines()}`;

    // Add custom instructions if provided
    if (customInstructions) {
      prompt += `\n\nAdditional Instructions:\n${customInstructions}`;
    }

    // Note: includeMemoryContext is reserved for future memory integration
    if (includeMemoryContext) {
      // Future: Add memory context here
      console.log('Memory context integration is planned for future releases');
    }

    return prompt;
  }

  /**
   * Get the base system prompt without dynamic content
   */
  private getBasePrompt(): string {
    return `You are an expert cryptocurrency trading assistant with access to real-time market data and advanced analysis tools through the Bybit MCP server.

You specialise in:
- Real-time market analysis and price monitoring
- Technical analysis using advanced indicators (RSI, MACD, Order Blocks, ML-RSI)
- Risk assessment and trading recommendations
- Market structure analysis and trend identification
- Portfolio analysis and position management

Your responses should be:
- Data-driven and based on current market conditions
- Clear and actionable with proper risk warnings
- Professional yet accessible to traders of all levels
- Comprehensive when needed, concise when appropriate
- Formatted in markdown for better readability`;
  }

  /**
   * Generate the tools section with dynamic tool discovery
   */
  private async generateToolsSection(): Promise<string> {
    try {
      const tools = await this.getAvailableTools();

      if (tools.length === 0) {
        return 'No tools are currently available.';
      }

      let toolsSection = 'Available tools:\n\n';

      for (const tool of tools) {
        toolsSection += `**${tool.name}**\n`;
        toolsSection += `${tool.description || 'No description available'}\n`;

        // Add parameter information if available
        if (tool.inputSchema?.properties) {
          const params = Object.entries(tool.inputSchema.properties);
          if (params.length > 0) {
            toolsSection += 'Parameters:\n';
            for (const [paramName, paramDef] of params) {
              const isRequired = tool.inputSchema.required?.includes(paramName) || false;
              const description = (paramDef as any)?.description || 'No description';
              toolsSection += `- ${paramName}${isRequired ? ' (required)' : ''}: ${description}\n`;
            }
          }
        }

        toolsSection += '\n';
      }

      return toolsSection.trim();
    } catch (error) {
      console.warn('Failed to generate tools section:', error);
      return 'Tools are currently unavailable due to connection issues.';
    }
  }

  /**
   * Get available tools with caching
   */
  private async getAvailableTools(): Promise<MCPTool[]> {
    const now = Date.now();

    // Return cached tools if still fresh
    if (this.cachedTools.length > 0 && (now - this.lastToolsUpdate) < this.TOOLS_CACHE_DURATION) {
      return this.cachedTools;
    }

    try {
      // Fetch fresh tools from MCP client
      const tools = await mcpClient.listTools();
      this.cachedTools = tools;
      this.lastToolsUpdate = now;
      return tools;
    } catch (error) {
      console.warn('Failed to fetch tools, using cached version:', error);
      return this.cachedTools;
    }
  }

  /**
   * Get current timestamp in consistent format
   */
  private getCurrentTimestamp(): string {
    const now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0') + ' UTC';
  }

  /**
   * Get standard guidelines and instructions
   */
  private getGuidelines(): string {
    return `Guidelines:
1. **Always use relevant tools** to gather current data before making recommendations
2. **Include reference IDs** - For all Bybit tool calls, always include the parameter "includeReferenceId": true to enable data verification
3. **Cite your sources** - When citing specific data from tool responses, include the reference ID in square brackets like [REF001]
4. **Provide clear insights** with proper risk warnings and confidence levels
5. **Explain your reasoning** and methodology behind analysis
6. **Consider multiple timeframes** when relevant for comprehensive analysis
7. **Use tools intelligently** - Don't call unnecessary tools, focus on what's needed for the user's question
8. **Be comprehensive when appropriate** but concise when a simple answer suffices
9. **Include confidence levels** in your analysis and recommendations
10. **Always include risk warnings** for trading recommendations and emphasize that this is not financial advice

Remember: You are providing analysis and insights, not financial advice. Users should always do their own research, consider their risk tolerance, and consult with qualified financial advisors before making trading decisions.`;
  }

  /**
   * Generate a simplified system prompt for legacy compatibility
   */
  public generateLegacySystemPrompt(): string {
    const timestamp = this.getCurrentTimestamp();

    return `You are an AI assistant specialised in cryptocurrency trading and market analysis. You have access to the Bybit MCP server which provides real-time market data and advanced technical analysis tools.

Current date and time: ${timestamp}

Available tools include:
- get_ticker: Get current price and 24h statistics for any trading pair
- get_orderbook: View current buy/sell orders and market depth
- get_kline: Retrieve historical price data (candlestick charts)
- get_trades: See recent trade history and market activity
- get_ml_rsi: Advanced ML-enhanced RSI indicator for trend analysis
- get_order_blocks: Detect institutional order blocks and liquidity zones
- get_market_structure: Comprehensive market structure analysis

Guidelines:
- Always use relevant tools to gather current data before making recommendations
- Provide clear, actionable insights with proper risk warnings
- Explain your reasoning and methodology
- Include confidence levels in your analysis
- Consider multiple timeframes when relevant
- Use tools intelligently based on the user's question - don't call unnecessary tools
- Provide comprehensive analysis when appropriate, but be concise when a simple answer suffices
- IMPORTANT: For all Bybit tool calls, always include the parameter "includeReferenceId": true to enable data verification. When citing specific data from tool responses, include the reference ID in square brackets like [REF001].

Be helpful, accurate, and focused on providing valuable trading insights.`;
  }

  /**
   * Clear the tools cache to force refresh
   */
  public clearToolsCache(): void {
    this.cachedTools = [];
    this.lastToolsUpdate = 0;
  }

  /**
   * Get tools cache status
   */
  public getToolsCacheStatus(): { count: number; lastUpdate: number; isStale: boolean } {
    const now = Date.now();
    const isStale = (now - this.lastToolsUpdate) > this.TOOLS_CACHE_DURATION;

    return {
      count: this.cachedTools.length,
      lastUpdate: this.lastToolsUpdate,
      isStale
    };
  }
}

// Export singleton instance
export const systemPromptService = SystemPromptService.getInstance();
