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

  constructor(baseUrl: string = '', timeout: number = 30000) {
    // Determine the correct base URL based on environment
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' && window.location.port === '3000') {
        // Development mode with Vite dev server
        this.baseUrl = '/api/mcp'; // Use Vite proxy in development
      } else if (baseUrl && baseUrl !== '' && baseUrl !== 'auto') {
        // Explicit base URL provided (not empty or 'auto')
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
      } else {
        // Production mode or Docker - use current origin
        this.baseUrl = window.location.origin;
      }
    } else {
      // Server-side or fallback
      this.baseUrl = baseUrl || 'http://localhost:8080';
      this.baseUrl = this.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    this.timeout = timeout;

    console.log('🔧 MCP Client initialised with baseUrl:', this.baseUrl);
    console.log('🔧 Environment check:', {
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'server-side',
      port: typeof window !== 'undefined' ? window.location.port : 'server-side',
      origin: typeof window !== 'undefined' ? window.location.origin : 'server-side',
      providedBaseUrl: baseUrl,
      finalBaseUrl: this.baseUrl
    });
  }

  /**
   * Initialize the client and connect to the MCP server
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔌 Initialising MCP client...');
      console.log('🔗 MCP endpoint:', this.baseUrl);

      // For now, skip the complex MCP client setup and just load tools
      // This allows the WebUI to work while we debug the MCP protocol issues
      console.log('🔄 Loading tools via HTTP...');
      await this.listTools();

      // Mark as connected if we successfully loaded tools
      this.connected = this.tools.length > 0;

      if (this.connected) {
        console.log('✅ MCP client initialised via HTTP');
      } else {
        console.warn('⚠️ No tools loaded, but continuing...');
      }
    } catch (error) {
      console.error('❌ Failed to initialise MCP client:', error);
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

      // Process tool response for citation storage
      console.log(`🔍 About to process tool response for citations...`);
      citationStore.processToolResponse(result);

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
    // Handle empty string or 'auto' to use current origin
    if (!url || url === '' || url === 'auto') {
      if (typeof window !== 'undefined') {
        this.baseUrl = window.location.origin;
        console.log('🔧 setBaseUrl: Using current origin:', this.baseUrl);
      } else {
        this.baseUrl = 'http://localhost:8080';
        console.log('🔧 setBaseUrl: Using server-side fallback:', this.baseUrl);
      }
    } else {
      this.baseUrl = url.replace(/\/$/, '');
      console.log('🔧 setBaseUrl: Using explicit URL:', this.baseUrl);
    }

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

// Create a singleton instance with environment-aware defaults
const getDefaultMCPUrl = (): string => {
  // Check for build-time injected environment variable
  const envEndpoint = (typeof window !== 'undefined' && (window as any).__MCP_ENDPOINT__) || '';

  console.log('🔧 MCP URL Detection:', {
    envEndpoint,
    isWindow: typeof window !== 'undefined',
    windowMcpEndpoint: typeof window !== 'undefined' ? (window as any).__MCP_ENDPOINT__ : 'N/A',
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
    origin: typeof window !== 'undefined' ? window.location.origin : 'N/A'
  });

  // If we have an explicit endpoint from build-time injection, use it
  if (envEndpoint && envEndpoint !== '' && envEndpoint !== 'auto') {
    console.log('🔧 Using explicit MCP endpoint:', envEndpoint);
    return envEndpoint;
  }

  // In browser, always use empty string to trigger current origin logic
  if (typeof window !== 'undefined') {
    console.log('🔧 Using current origin for MCP endpoint (empty string)');
    return ''; // Empty string means use current origin
  }

  // Server-side fallback
  console.log('🔧 Using server-side fallback for MCP endpoint');
  return 'http://localhost:8080';
};

export const mcpClient = new MCPClient(getDefaultMCPUrl());

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
