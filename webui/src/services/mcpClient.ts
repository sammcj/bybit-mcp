/**
 * MCP (Model Context Protocol) client for communicating with the Bybit MCP server
 * Uses the official MCP SDK with StreamableHTTPClientTransport for browser compatibility
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { citationStore } from './citationStore';
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
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      this.baseUrl = '/api/mcp'; // Use Vite proxy in development
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
      console.log('🔗 MCP endpoint:', this.baseUrl);

      // For now, skip the complex MCP client setup and just load tools
      // This allows the WebUI to work while we debug the MCP protocol issues
      console.log('🔄 Loading tools via HTTP...');
      await this.listTools();

      // Mark as connected if we successfully loaded tools
      this.connected = this.tools.length > 0;

      if (this.connected) {
        console.log('✅ MCP client initialized via HTTP');
      } else {
        console.warn('⚠️ No tools loaded, but continuing...');
      }
    } catch (error) {
      console.error('❌ Failed to initialize MCP client:', error);
      console.error('❌ MCP Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      this.connected = false;
      // Don't throw error, allow WebUI to continue
      console.log('💡 Continuing without MCP tools...');
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
   * List all available tools from the MCP server using direct HTTP
   */
  async listTools(): Promise<MCPTool[]> {
    try {
      // Use direct HTTP request to get tools
      const response = await fetch(`${this.baseUrl}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response formats
      let tools = [];
      if (Array.isArray(data)) {
        tools = data;
      } else if (data.tools && Array.isArray(data.tools)) {
        tools = data.tools;
      } else {
        console.warn('Unexpected tools response format:', data);
        return [];
      }

      this.tools = tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      }));

      console.log('🔧 Loaded tools via HTTP:', this.tools.length);
      return this.tools;
    } catch (error) {
      console.error('Failed to list tools via HTTP:', error);
      // Fallback: return empty array instead of throwing
      this.tools = [];
      return this.tools;
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
   * Validate and convert parameters based on tool schema
   */
  private validateAndConvertParams(toolName: string, params: Record<string, any>): Record<string, any> {
    const tool = this.getTool(toolName);
    if (!tool || !tool.inputSchema || !tool.inputSchema.properties) {
      return params;
    }

    const convertedParams: Record<string, any> = {};
    const schema = tool.inputSchema.properties;

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      const propertySchema = schema[key] as any;
      if (!propertySchema) {
        convertedParams[key] = value;
        continue;
      }

      // Convert based on schema type
      if (propertySchema.type === 'number') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (!isNaN(numValue)) {
          convertedParams[key] = numValue;
        } else {
          console.warn(`⚠️ Invalid number value for ${key}: ${value}`);
          convertedParams[key] = value; // Keep original value
        }
      } else if (propertySchema.type === 'integer') {
        const intValue = typeof value === 'string' ? parseInt(value, 10) : value;
        if (!isNaN(intValue)) {
          convertedParams[key] = intValue;
        } else {
          console.warn(`⚠️ Invalid integer value for ${key}: ${value}`);
          convertedParams[key] = value; // Keep original value
        }
      } else if (propertySchema.type === 'boolean') {
        if (typeof value === 'string') {
          convertedParams[key] = value.toLowerCase() === 'true';
        } else {
          convertedParams[key] = Boolean(value);
        }
      } else {
        // String or other types - keep as is
        convertedParams[key] = value;
      }
    }

    return convertedParams;
  }

  /**
   * Call a specific MCP tool using HTTP
   */
  async callTool<T extends MCPToolName>(
    name: T,
    params: MCPToolParams<T>
  ): Promise<MCPToolResponse<T>> {
    try {
      console.log(`🔧 Calling tool ${name} with params:`, params);

      // Validate and convert parameters
      const convertedParams = this.validateAndConvertParams(name as string, params as Record<string, any>);
      console.log(`🔧 Converted params:`, convertedParams);

      const response = await fetch(`${this.baseUrl}/call-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name as string,
          arguments: convertedParams,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Tool ${name} result:`, result);

      return result as MCPToolResponse<T>;
    } catch (error) {
      console.error(`❌ Failed to call tool ${name}:`, error);
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
