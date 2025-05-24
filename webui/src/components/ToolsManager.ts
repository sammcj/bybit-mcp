/**
 * Tools Manager - Handles the MCP Tools tab functionality
 * Displays available tools, allows manual testing, and shows execution history
 */

import { mcpClient } from '@/services/mcpClient';
import type { MCPTool } from '@/types/mcp';

export class ToolsManager {
  private tools: MCPTool[] = [];
  private isInitialized = false;
  private executionHistory: Array<{
    id: string;
    tool: string;
    params: any;
    result: any;
    timestamp: number;
    success: boolean;
  }> = [];

  constructor() {}

  /**
   * Initialize the tools manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔧 Initializing Tools Manager...');
      
      // Load available tools
      await this.loadTools();
      
      // Render tools interface
      this.renderToolsInterface();
      
      this.isInitialized = true;
      console.log('✅ Tools Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Tools Manager:', error);
      this.showError('Failed to initialize tools');
    }
  }

  /**
   * Load available tools from MCP server
   */
  private async loadTools(): Promise<void> {
    try {
      this.tools = await mcpClient.listTools();
      console.log(`🔧 Loaded ${this.tools.length} tools`);
    } catch (error) {
      console.error('Failed to load tools:', error);
      this.tools = [];
    }
  }

  /**
   * Render the tools interface
   */
  private renderToolsInterface(): void {
    const container = document.getElementById('tools-grid');
    if (!container) return;

    if (this.tools.length === 0) {
      container.innerHTML = `
        <div class="tools-empty">
          <h3>No Tools Available</h3>
          <p>Unable to load MCP tools. Please check your connection.</p>
          <button onclick="location.reload()" class="retry-btn">Retry</button>
        </div>
      `;
      return;
    }

    // Create tools grid
    container.innerHTML = `
      <div class="tools-header">
        <h3>Available MCP Tools (${this.tools.length})</h3>
        <div class="tools-actions">
          <button id="refresh-tools" class="refresh-btn">Refresh</button>
          <button id="clear-history" class="clear-btn">Clear History</button>
        </div>
      </div>
      <div class="tools-list">
        ${this.tools.map(tool => this.renderToolCard(tool)).join('')}
      </div>
      <div class="execution-history">
        <h3>Execution History</h3>
        <div id="history-list" class="history-list">
          ${this.renderExecutionHistory()}
        </div>
      </div>
    `;

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Render a single tool card
   */
  private renderToolCard(tool: MCPTool): string {
    const requiredParams = tool.inputSchema?.required || [];
    const properties = tool.inputSchema?.properties || {};
    
    return `
      <div class="tool-card" data-tool="${tool.name}">
        <div class="tool-header">
          <h4>${tool.name}</h4>
          <button class="test-tool-btn" data-tool="${tool.name}">Test</button>
        </div>
        <p class="tool-description">${tool.description}</p>
        <div class="tool-params">
          <h5>Parameters:</h5>
          ${Object.entries(properties).map(([key, param]: [string, any]) => `
            <div class="param-item">
              <label for="${tool.name}-${key}">
                ${key}${requiredParams.includes(key) ? ' *' : ''}
              </label>
              <input 
                type="text" 
                id="${tool.name}-${key}" 
                placeholder="${param.description || ''}"
                ${param.enum ? `list="${tool.name}-${key}-list"` : ''}
              />
              ${param.enum ? `
                <datalist id="${tool.name}-${key}-list">
                  ${param.enum.map((value: string) => `<option value="${value}">`).join('')}
                </datalist>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render execution history
   */
  private renderExecutionHistory(): string {
    if (this.executionHistory.length === 0) {
      return '<p class="history-empty">No executions yet</p>';
    }

    return this.executionHistory
      .slice(-10) // Show last 10 executions
      .reverse()
      .map(execution => `
        <div class="history-item ${execution.success ? 'success' : 'error'}">
          <div class="history-header">
            <span class="tool-name">${execution.tool}</span>
            <span class="timestamp">${new Date(execution.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="history-params">
            <strong>Params:</strong> ${JSON.stringify(execution.params, null, 2)}
          </div>
          <div class="history-result">
            <strong>Result:</strong>
            <pre>${JSON.stringify(execution.result, null, 2)}</pre>
          </div>
        </div>
      `).join('');
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Refresh tools button
    const refreshBtn = document.getElementById('refresh-tools');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshTools();
      });
    }

    // Clear history button
    const clearBtn = document.getElementById('clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearHistory();
      });
    }

    // Test tool buttons
    document.querySelectorAll('.test-tool-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const toolName = target.dataset.tool;
        if (toolName) {
          this.testTool(toolName);
        }
      });
    });
  }

  /**
   * Test a specific tool
   */
  private async testTool(toolName: string): Promise<void> {
    try {
      const tool = this.tools.find(t => t.name === toolName);
      if (!tool) return;

      // Collect parameters from form
      const params: any = {};
      const properties = tool.inputSchema?.properties || {};
      
      for (const [key] of Object.entries(properties)) {
        const input = document.getElementById(`${toolName}-${key}`) as HTMLInputElement;
        if (input && input.value) {
          params[key] = input.value;
        }
      }

      console.log(`🔧 Testing tool ${toolName} with params:`, params);

      // Show loading state
      this.showToolLoading(toolName);

      // Execute tool
      const result = await mcpClient.callTool(toolName as any, params);

      // Record execution
      this.recordExecution(toolName, params, result, true);

      // Update UI
      this.hideToolLoading(toolName);
      this.updateHistoryDisplay();

      console.log(`✅ Tool ${toolName} executed successfully:`, result);

    } catch (error) {
      console.error(`❌ Tool ${toolName} execution failed:`, error);
      
      // Record failed execution
      this.recordExecution(toolName, {}, error, false);
      
      this.hideToolLoading(toolName);
      this.updateHistoryDisplay();
    }
  }

  /**
   * Record tool execution
   */
  private recordExecution(tool: string, params: any, result: any, success: boolean): void {
    this.executionHistory.push({
      id: Date.now().toString(),
      tool,
      params,
      result,
      timestamp: Date.now(),
      success,
    });

    // Keep only last 50 executions
    if (this.executionHistory.length > 50) {
      this.executionHistory = this.executionHistory.slice(-50);
    }
  }

  /**
   * Update history display
   */
  private updateHistoryDisplay(): void {
    const historyContainer = document.getElementById('history-list');
    if (historyContainer) {
      historyContainer.innerHTML = this.renderExecutionHistory();
    }
  }

  /**
   * Show tool loading state
   */
  private showToolLoading(toolName: string): void {
    const btn = document.querySelector(`[data-tool="${toolName}"]`) as HTMLElement;
    if (btn) {
      btn.textContent = 'Testing...';
      btn.setAttribute('disabled', 'true');
    }
  }

  /**
   * Hide tool loading state
   */
  private hideToolLoading(toolName: string): void {
    const btn = document.querySelector(`[data-tool="${toolName}"]`) as HTMLElement;
    if (btn) {
      btn.textContent = 'Test';
      btn.removeAttribute('disabled');
    }
  }

  /**
   * Refresh tools
   */
  private async refreshTools(): Promise<void> {
    console.log('🔄 Refreshing tools...');
    await this.loadTools();
    this.renderToolsInterface();
  }

  /**
   * Clear execution history
   */
  private clearHistory(): void {
    this.executionHistory = [];
    this.updateHistoryDisplay();
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const container = document.getElementById('tools-grid');
    if (container) {
      container.innerHTML = `
        <div class="tools-error">
          <h3>❌ Error</h3>
          <p>${message}</p>
          <button onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  /**
   * Get current state
   */
  getState(): { tools: MCPTool[]; history: any[] } {
    return {
      tools: [...this.tools],
      history: [...this.executionHistory],
    };
  }

  /**
   * Destroy tools manager
   */
  destroy(): void {
    this.isInitialized = false;
    console.log('🗑️ Tools Manager destroyed');
  }
}

// Create singleton instance
export const toolsManager = new ToolsManager();
