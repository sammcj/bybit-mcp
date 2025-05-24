/**
 * MCP (Model Context Protocol) client for communicating with the Bybit MCP server
 * Uses the official MCP SDK with StreamableHTTPClientTransport for browser compatibility
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
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
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private tools: MCPTool[] = [];
  private connected: boolean = false;

  constructor(baseUrl: string = 'http://localhost:8080', timeout: number = 30000) {
    // Use proxy in development, direct URL in production
    if (import.meta.env.DEV) {
      this.baseUrl = '/api/mcp'; // Use Vite proxy
    } else {
      this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    this.timeout = timeout;
  }

  /**
   * Initialize the client and connect to the MCP server
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔌 Initializing MCP client...');
      console.log('🔗 MCP endpoint:', `${this.baseUrl}/mcp`);

      // Create client
      this.client = new Client({
        name: 'bybit-mcp-webui',
        version: '1.0.0'
      });
      console.log('✅ MCP client created');

      // Create transport
      this.transport = new StreamableHTTPClientTransport(
        new URL(`${this.baseUrl}/mcp`)
      );
      console.log('✅ Transport created');

      // Connect to server
      console.log('🔄 Connecting to MCP server...');
      await this.client.connect(this.transport);
      this.connected = true;
      console.log('✅ Connected to MCP server');

      // Load available tools
      console.log('🔄 Loading tools...');
      await this.listTools();
      console.log('✅ MCP client fully initialized');
    } catch (error) {
      console.error('❌ Failed to initialize MCP client:', error);
      console.error('❌ MCP Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      this.connected = false;
      throw new Error('Failed to connect to MCP server');
    }
  }

  /**
   * Check if the MCP server is reachable
   */
  async isConnected(): Promise<boolean> {
    try {
      // Simple health check to the HTTP server
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.warn('🔍 MCP health check failed:', error);
      return false;
    }
  }

  /**
   * List all available tools from the MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const response = await this.client.listTools();
      this.tools = response.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema,
      }));
      return this.tools;
    } catch (error) {
      console.error('Failed to list tools:', error);
      throw error;
    }
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
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const result = await this.client.callTool({
        name: name as string,
        arguments: params as Record<string, unknown>,
      });

      return result as MCPToolResponse<T>;
    } catch (error) {
      console.error(`Failed to call tool ${name}:`, error);
      throw error;
    }
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
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.transport) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error disconnecting from MCP server:', error);
      }
    }

    this.client = null;
    this.transport = null;
    this.connected = false;
    this.tools = [];
  }

  /**
   * Update the base URL for the MCP server
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
    // If connected, disconnect and reconnect with new URL
    if (this.connected) {
      this.disconnect().then(() => {
        this.initialize().catch(console.error);
      });
    }
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
  getConfig(): { baseUrl: string; timeout: number; isConnected: boolean } {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      isConnected: this.connected,
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
