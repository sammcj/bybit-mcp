/**
 * MCP (Model Context Protocol) client for communicating with the Bybit MCP server
 */

import type {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPToolName,
  MCPToolParams,
  MCPToolResponse,
} from '@/types/mcp';

export class MCPClient {
  private baseUrl: string;
  private timeout: number;
  private tools: MCPTool[] = [];

  constructor(baseUrl: string = 'http://localhost:3001', timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Initialize the client and fetch available tools
   */
  async initialize(): Promise<void> {
    try {
      await this.listTools();
    } catch (error) {
      console.error('Failed to initialize MCP client:', error);
      throw new Error('Failed to connect to MCP server');
    }
  }

  /**
   * Check if the MCP server is reachable
   */
  async isConnected(): Promise<boolean> {
    try {
      const response = await this.makeRequest('tools/list', {});
      return response.result !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * List all available tools from the MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    const response = await this.makeRequest('tools/list', {});
    this.tools = (response.result as any)?.tools || [];
    return this.tools;
  }

  /**
   * Get information about a specific tool
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.find(tool => tool.name === name);
  }

  /**
   * Get all available tools
   */
  getTools(): MCPTool[] {
    return [...this.tools];
  }

  /**
   * Call a specific MCP tool
   */
  async callTool<T extends MCPToolName>(
    name: T,
    params: MCPToolParams<T>
  ): Promise<MCPToolResponse<T>> {
    const toolCall: MCPToolCall = {
      name,
      arguments: params as Record<string, unknown>,
    };

    const response = await this.makeRequest('tools/call', {
      name: toolCall.name,
      arguments: toolCall.arguments,
    });

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result as MCPToolResponse<T>;
  }

  /**
   * Call multiple tools in sequence
   */
  async callTools(toolCalls: MCPToolCall[]): Promise<MCPToolResult[]> {
    const results: MCPToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.callTool(
          toolCall.name as MCPToolName,
          toolCall.arguments as any
        );

        results.push({
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
          isError: false,
        });
      } catch (error) {
        results.push({
          content: [{
            type: 'text',
            text: `Error calling ${toolCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        });
      }
    }

    return results;
  }

  /**
   * Make a raw request to the MCP server
   */
  private async makeRequest(method: string, params: Record<string, unknown>): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method,
      params,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!this.isValidMCPResponse(data)) {
        throw new Error('Invalid MCP response format');
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }

      throw new Error('Unknown error occurred');
    }
  }

  /**
   * Validate MCP response format
   */
  private isValidMCPResponse(data: any): data is MCPResponse {
    return (
      typeof data === 'object' &&
      data !== null &&
      data.jsonrpc === '2.0' &&
      (typeof data.id === 'string' || typeof data.id === 'number') &&
      (data.result !== undefined || data.error !== undefined)
    );
  }

  /**
   * Generate a unique request ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update the base URL for the MCP server
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  /**
   * Update the request timeout
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  /**
   * Get current configuration
   */
  getConfig(): { baseUrl: string; timeout: number } {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
    };
  }
}

// Create a singleton instance
export const mcpClient = new MCPClient();

// Convenience functions for common operations
export async function getTicker(symbol: string, category?: 'spot' | 'linear' | 'inverse' | 'option') {
  return mcpClient.callTool('get_ticker', { symbol, category });
}

export async function getKlineData(symbol: string, interval?: string, limit?: number) {
  return mcpClient.callTool('get_kline', { symbol, interval, limit });
}

export async function getOrderbook(symbol: string, category?: 'spot' | 'linear' | 'inverse' | 'option', limit?: number) {
  return mcpClient.callTool('get_orderbook', { symbol, category, limit });
}

export async function getMLRSI(symbol: string, category: 'spot' | 'linear' | 'inverse' | 'option', interval: string, options?: Partial<MCPToolParams<'get_ml_rsi'>>) {
  return mcpClient.callTool('get_ml_rsi', { symbol, category, interval, ...options });
}

export async function getOrderBlocks(symbol: string, category: 'spot' | 'linear' | 'inverse' | 'option', interval: string, options?: Partial<MCPToolParams<'get_order_blocks'>>) {
  return mcpClient.callTool('get_order_blocks', { symbol, category, interval, ...options });
}

export async function getMarketStructure(symbol: string, category: 'spot' | 'linear' | 'inverse' | 'option', interval: string, options?: Partial<MCPToolParams<'get_market_structure'>>) {
  return mcpClient.callTool('get_market_structure', { symbol, category, interval, ...options });
}
