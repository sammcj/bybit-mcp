/**
 * Tools Manager - Handles the MCP Tools tab functionality
 * Displays available tools, allows manual testing, and shows execution history
 */

import { mcpClient } from '@/services/mcpClient';
import type { MCPTool } from '@/types/mcp';
import { DataCard, type DataCardConfig } from './chat/DataCard';
import { detectDataType } from '../utils/dataDetection';

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
  private dataCards: Map<string, DataCard> = new Map(); // Track DataCards by tool name

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

    const html = `
      <div class="tool-card" data-tool="${tool.name}">
        <div class="tool-header">
          <h4>${tool.name}</h4>
          <button class="test-tool-btn" data-tool="${tool.name}">Test</button>
        </div>
        <p class="tool-description">${tool.description}</p>
        <div class="tool-params">
          <h5>Parameters:</h5>
          ${Object.entries(properties).map(([key, param]: [string, any]) => {
            // Determine default value
            let defaultValue = '';
            if (key === 'symbol') {
              defaultValue = 'XRPUSDT';
            } else if (key === 'category') {
              defaultValue = 'spot';
            } else if (key === 'interval') {
              defaultValue = '15';
            } else if (key === 'limit') {
              defaultValue = '100';
            }

            // Check if this field has enum options
            if (param.enum && Array.isArray(param.enum)) {
              // Use dropdown for enum fields
              return `
                <div class="param-item">
                  <label for="${tool.name}-${key}">
                    ${key}${requiredParams.includes(key) ? ' *' : ''}
                  </label>
                  <select id="${tool.name}-${key}" class="param-select">
                    ${param.enum.map((value: string) => `
                      <option value="${value}" ${value === defaultValue ? 'selected' : ''}>
                        ${value}
                      </option>
                    `).join('')}
                  </select>
                  ${param.description ? `<small class="param-description">${param.description}</small>` : ''}
                </div>
              `;
            } else {
              // Use input for non-enum fields
              return `
                <div class="param-item">
                  <label for="${tool.name}-${key}">
                    ${key}${requiredParams.includes(key) ? ' *' : ''}
                  </label>
                  <input
                    type="text"
                    id="${tool.name}-${key}"
                    placeholder="${param.description || ''}"
                    value="${defaultValue}"
                    class="param-input"
                  />
                  ${param.description ? `<small class="param-description">${param.description}</small>` : ''}
                </div>
              `;
            }
          }).join('')}
        </div>
        <div class="tool-result" id="result-${tool.name}" style="display: none;">
          <div class="result-header">
            <h5>Result</h5>
            <button class="result-close" data-tool="${tool.name}" title="Close result">&times;</button>
          </div>
          <div class="result-content" id="result-content-${tool.name}"></div>
        </div>
      </div>
    `;

    return html;
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

    // Result close buttons
    document.querySelectorAll('.result-close').forEach(btn => {
      btn.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const toolName = target.dataset.tool;
        if (toolName) {
          this.hideToolResult(toolName);
        }
      });
    });
  }

  /**
   * Test a specific tool
   */
  private async testTool(toolName: string): Promise<void> {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) return;

    // Collect parameters from form
    const params: any = {};
    const properties = tool.inputSchema?.properties || {};

    for (const [key] of Object.entries(properties)) {
      const element = document.getElementById(`${toolName}-${key}`) as HTMLInputElement | HTMLSelectElement;
      if (element && element.value) {
        params[key] = element.value;
      }
    }

    try {
      console.log(`🔧 Testing tool ${toolName} with params:`, params);

      // Show loading state
      this.showToolLoading(toolName);

      // Execute tool
      const result = await mcpClient.callTool(toolName as any, params);

      // Record execution
      this.recordExecution(toolName, params, result, true);

      // Show result in tool card
      this.showToolResult(toolName, result, true);

      // Update UI
      this.hideToolLoading(toolName);
      this.updateHistoryDisplay();

      console.log(`✅ Tool ${toolName} executed successfully:`, result);

    } catch (error) {
      console.error(`❌ Tool ${toolName} execution failed:`, error);

      // Record failed execution
      this.recordExecution(toolName, params, error, false);

      // Show error in tool card
      this.showToolResult(toolName, error, false);

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
    const btn = document.querySelector(`.test-tool-btn[data-tool="${toolName}"]`) as HTMLElement;
    if (btn) {
      btn.textContent = 'Testing...';
      btn.setAttribute('disabled', 'true');
    }
  }

  /**
   * Hide tool loading state
   */
  private hideToolLoading(toolName: string): void {
    const btn = document.querySelector(`.test-tool-btn[data-tool="${toolName}"]`) as HTMLElement;
    if (btn) {
      btn.textContent = 'Test';
      btn.removeAttribute('disabled');
    }
  }

  /**
   * Show tool result in the tool card
   */
  private showToolResult(toolName: string, result: any, success: boolean): void {
    const resultContainer = document.getElementById(`result-${toolName}`);
    const resultContent = document.getElementById(`result-content-${toolName}`);

    if (!resultContainer || !resultContent) {
      console.error(`❌ Could not find result DOM elements for ${toolName}`);
      return;
    }

    this.displayResult(resultContainer, resultContent, result, success);
  }

  private displayResult(resultContainer: HTMLElement, resultContent: HTMLElement, result: any, success: boolean): void {
    if (!success) {
      // Handle error case with existing logic
      this.displayErrorResult(resultContent, result);
      resultContainer.style.display = 'block';
      return;
    }

    // Extract actual data from MCP content structure
    let actualData = this.extractActualData(result);

    // Try to create a DataCard for visualisable data
    const dataCardCreated = this.tryCreateDataCard(resultContainer, resultContent, actualData);

    if (!dataCardCreated) {
      // Fall back to traditional JSON display
      this.displayTraditionalResult(resultContent, actualData);
    }

    // Show the result container
    resultContainer.style.display = 'block';

    // Scroll result into view
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Extract actual data from MCP content structure
   */
  private extractActualData(result: any): any {
    let actualData = result;

    // Check if this is an MCP content response
    if (result && result.content && Array.isArray(result.content) && result.content.length > 0) {
      const firstContent = result.content[0];
      if (firstContent.type === 'text' && firstContent.text) {
        try {
          // Try to parse the text as JSON
          actualData = JSON.parse(firstContent.text);
        } catch {
          // If parsing fails, use the text as-is
          actualData = firstContent.text;
        }
      }
    }

    return actualData;
  }

  /**
   * Try to create a DataCard for visualisable data
   */
  private tryCreateDataCard(resultContainer: HTMLElement, resultContent: HTMLElement, actualData: any): boolean {
    try {
      // Detect if the data is visualisable
      const detection = detectDataType(actualData);

      if (!detection.visualisable || detection.confidence < 0.6) {
        return false;
      }

      // Get tool name from container
      const toolName = this.getToolNameFromContainer(resultContainer);
      if (!toolName) {
        return false;
      }

      // Clean up any existing DataCard for this tool
      const existingCard = this.dataCards.get(toolName);
      if (existingCard) {
        existingCard.destroy();
        this.dataCards.delete(toolName);
      }

      // Create DataCard configuration
      const cardConfig: DataCardConfig = {
        title: this.generateToolCardTitle(toolName, detection),
        summary: detection.summary,
        data: actualData,
        dataType: detection.dataType,
        expanded: true, // Start expanded in tools tab for immediate visibility
        showChart: true
      };

      // Create container for DataCard
      const cardContainer = document.createElement('div');
      cardContainer.className = 'tool-result-datacard';

      // Create and store the DataCard
      const dataCard = new DataCard(cardContainer, cardConfig);
      this.dataCards.set(toolName, dataCard);

      // Add status and actions above the card
      resultContent.innerHTML = `
        <div class="result-status result-success">
          ✅ Success - Data Visualisation Available
        </div>
        <div class="result-actions">
          <button class="copy-result-btn" data-result="${encodeURIComponent(JSON.stringify(actualData, null, 2))}">
            📋 Copy Raw Data
          </button>
          <button class="toggle-raw-btn">
            📊 Show Raw JSON
          </button>
        </div>
      `;

      // Append the DataCard
      resultContent.appendChild(cardContainer);

      // Add toggle functionality for raw data
      this.setupDataCardActions(resultContent, actualData);

      return true;
    } catch (error) {
      console.warn('Failed to create DataCard for tool result:', error);
      return false;
    }
  }

  /**
   * Set up actions for DataCard (copy, toggle raw data)
   */
  private setupDataCardActions(resultContent: HTMLElement, actualData: any): void {
    const copyBtn = resultContent.querySelector('.copy-result-btn') as HTMLElement;
    const toggleBtn = resultContent.querySelector('.toggle-raw-btn') as HTMLElement;

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const resultData = decodeURIComponent(copyBtn.dataset.result || '');
        navigator.clipboard.writeText(resultData).then(() => {
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy Raw Data';
          }, 2000);
        }).catch(() => {
          copyBtn.textContent = '❌ Failed';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy Raw Data';
          }, 2000);
        });
      });
    }

    if (toggleBtn) {
      let showingRaw = false;
      toggleBtn.addEventListener('click', () => {
        const cardContainer = resultContent.querySelector('.tool-result-datacard') as HTMLElement;
        if (!cardContainer) return;

        if (showingRaw) {
          // Show DataCard
          cardContainer.style.display = 'block';
          const rawDataDiv = resultContent.querySelector('.raw-data-display');
          if (rawDataDiv) rawDataDiv.remove();
          toggleBtn.textContent = '📊 Show Raw JSON';
          showingRaw = false;
        } else {
          // Show raw JSON
          cardContainer.style.display = 'none';
          const rawDataDiv = document.createElement('div');
          rawDataDiv.className = 'raw-data-display';
          rawDataDiv.innerHTML = `<pre class="result-data">${JSON.stringify(actualData, null, 2)}</pre>`;
          resultContent.appendChild(rawDataDiv);
          toggleBtn.textContent = '🎴 Show DataCard';
          showingRaw = true;
        }
      });
    }
  }

  /**
   * Display traditional JSON result (fallback)
   */
  private displayTraditionalResult(resultContent: HTMLElement, actualData: any): void {
    let formattedResult: string;

    if (typeof actualData === 'object') {
      formattedResult = JSON.stringify(actualData, null, 2);
    } else {
      formattedResult = String(actualData);
    }

    resultContent.innerHTML = `
      <div class="result-status result-success">
        ✅ Success
      </div>
      <pre class="result-data">${formattedResult}</pre>
      <div class="result-actions">
        <button class="copy-result-btn" data-result="${encodeURIComponent(formattedResult)}">
          📋 Copy
        </button>
      </div>
    `;

    // Add copy functionality
    const copyBtn = resultContent.querySelector('.copy-result-btn') as HTMLElement;
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const resultData = decodeURIComponent(copyBtn.dataset.result || '');
        navigator.clipboard.writeText(resultData).then(() => {
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy';
          }, 2000);
        }).catch(() => {
          copyBtn.textContent = '❌ Failed';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy';
          }, 2000);
        });
      });
    }
  }

  /**
   * Display error result
   */
  private displayErrorResult(resultContent: HTMLElement, result: any): void {
    let formattedResult: string;

    if (result instanceof Error) {
      formattedResult = `Error: ${result.message}`;
    } else {
      formattedResult = `Error: ${String(result)}`;
    }

    resultContent.innerHTML = `
      <div class="result-status result-error">
        ❌ Error
      </div>
      <pre class="result-data">${formattedResult}</pre>
    `;
  }

  /**
   * Get tool name from result container
   */
  private getToolNameFromContainer(resultContainer: HTMLElement): string | null {
    const id = resultContainer.id;
    if (id && id.startsWith('result-')) {
      return id.substring(7); // Remove 'result-' prefix
    }
    return null;
  }

  /**
   * Generate appropriate title for tool DataCard
   */
  private generateToolCardTitle(toolName: string, _detection: any): string {
    const toolDisplayNames: Record<string, string> = {
      'get_ticker': 'Ticker Data',
      'get_kline_data': 'Kline Data',
      'get_ml_rsi': 'ML-RSI Analysis',
      'get_order_blocks': 'Order Blocks',
      'get_market_structure': 'Market Structure'
    };

    return toolDisplayNames[toolName] || toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Hide tool result
   */
  private hideToolResult(toolName: string): void {
    const resultContainer = document.getElementById(`result-${toolName}`);
    if (resultContainer) {
      resultContainer.style.display = 'none';
    }

    // Clean up associated DataCard
    const dataCard = this.dataCards.get(toolName);
    if (dataCard) {
      dataCard.destroy();
      this.dataCards.delete(toolName);
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
    // Clean up all DataCards
    this.dataCards.forEach(card => card.destroy());
    this.dataCards.clear();

    this.isInitialized = false;
    console.log('🗑️ Tools Manager destroyed');
  }
}

// Create singleton instance
export const toolsManager = new ToolsManager();
