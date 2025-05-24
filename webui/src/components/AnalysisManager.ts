/**
 * Analysis Manager - Handles the Analysis tab functionality
 * Provides ML-enhanced RSI, Order Blocks, and Market Structure analysis
 */

import { ChartComponent, convertKlineToChartData } from './ChartComponent';
import { getMLRSI, getOrderBlocks, getMarketStructure } from '@/services/mcpClient';

export class AnalysisManager {
  private mlRsiChart: ChartComponent | null = null;
  private orderBlocksChart: ChartComponent | null = null;
  private state: {
    symbol: string;
    interval: string;
    category: 'spot' | 'linear' | 'inverse';
    isLoading: boolean;
    lastUpdate: number;
    mlRsiData: any;
    orderBlocksData: any;
    marketStructureData: any;
  };
  private isInitialized = false;

  constructor() {
    this.state = {
      symbol: 'BTCUSDT',
      interval: '15',
      category: 'spot',
      isLoading: false,
      lastUpdate: 0,
      mlRsiData: null,
      orderBlocksData: null,
      marketStructureData: null,
    };
  }

  /**
   * Initialize the analysis manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🧠 Initializing Analysis Manager...');

      // Set up event listeners
      this.setupEventListeners();

      // Initialize charts
      this.initializeCharts();

      // Load initial analysis data
      await this.loadAnalysisData();

      this.isInitialized = true;
      console.log('✅ Analysis Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Analysis Manager:', error);
      this.showError('Failed to initialize analysis');
    }
  }

  /**
   * Set up event listeners for analysis controls
   */
  private setupEventListeners(): void {
    // Add symbol and interval selectors to analysis view
    this.addAnalysisControls();

    // Symbol selection
    const symbolSelect = document.getElementById('analysis-symbol-select') as HTMLSelectElement;
    if (symbolSelect) {
      symbolSelect.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        this.updateSymbol(target.value);
      });
    }

    // Interval selection
    const intervalSelect = document.getElementById('analysis-interval-select') as HTMLSelectElement;
    if (intervalSelect) {
      intervalSelect.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        this.updateInterval(target.value);
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-analysis') as HTMLButtonElement;
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshAnalysis();
      });
    }
  }

  /**
   * Add analysis controls to the view
   */
  private addAnalysisControls(): void {
    const container = document.querySelector('.analysis-container');
    if (!container) return;

    // Check if controls already exist
    if (container.querySelector('.analysis-controls')) return;

    const controlsHtml = `
      <div class="analysis-controls">
        <select id="analysis-symbol-select" class="symbol-select">
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
          <option value="SOLUSDT">SOL/USDT</option>
          <option value="XRPUSDT">XRP/USDT</option>
          <option value="ADAUSDT">ADA/USDT</option>
        </select>
        <select id="analysis-interval-select" class="interval-select">
          <option value="1">1m</option>
          <option value="5">5m</option>
          <option value="15">15m</option>
          <option value="60">1h</option>
          <option value="240">4h</option>
          <option value="D">1D</option>
        </select>
        <button id="refresh-analysis" class="refresh-btn">Refresh Analysis</button>
      </div>
    `;

    container.insertAdjacentHTML('afterbegin', controlsHtml);
  }

  /**
   * Initialize analysis charts
   */
  private initializeCharts(): void {
    // Initialize ML-RSI chart
    const mlRsiContainer = document.getElementById('ml-rsi-chart');
    if (mlRsiContainer) {
      mlRsiContainer.innerHTML = '';
      const containerRect = mlRsiContainer.getBoundingClientRect();
      const width = Math.max(containerRect.width || 600, 400);
      const height = Math.max(containerRect.height || 300, 200);

      this.mlRsiChart = new ChartComponent(mlRsiContainer, width, height);
      console.log('📊 ML-RSI chart initialized');
    }

    // Initialize Order Blocks chart
    const orderBlocksContainer = document.getElementById('order-blocks-chart');
    if (orderBlocksContainer) {
      orderBlocksContainer.innerHTML = '';
      const containerRect = orderBlocksContainer.getBoundingClientRect();
      const width = Math.max(containerRect.width || 600, 400);
      const height = Math.max(containerRect.height || 300, 200);

      this.orderBlocksChart = new ChartComponent(orderBlocksContainer, width, height);
      console.log('📊 Order Blocks chart initialized');
    }
  }

  /**
   * Load analysis data from MCP server
   */
  async loadAnalysisData(): Promise<void> {
    if (this.state.isLoading) return;

    try {
      this.setState({ isLoading: true });
      this.showLoading();

      console.log(`🧠 Loading analysis data for ${this.state.symbol} (${this.state.interval})`);

      // Load all analysis data in parallel
      const [mlRsiResponse, orderBlocksResponse, marketStructureResponse] = await Promise.allSettled([
        getMLRSI(this.state.symbol, this.state.category, this.state.interval, {
          rsiLength: 14,
          knnNeighbors: 5,
          limit: 200
        }),
        getOrderBlocks(this.state.symbol, this.state.category, this.state.interval, {
          volumePivotLength: 5,
          bullishBlocks: 3,
          bearishBlocks: 3,
          limit: 200
        }),
        getMarketStructure(this.state.symbol, this.state.category, this.state.interval, {
          analysisDepth: 200,
          includeOrderBlocks: true,
          includeMLRSI: true,
          includeLiquidityZones: true
        })
      ]);

      // Process ML-RSI data
      if (mlRsiResponse.status === 'fulfilled') {
        this.state.mlRsiData = this.extractAnalysisData(mlRsiResponse.value);
        this.updateMLRSIChart();
      } else {
        console.warn('ML-RSI analysis failed:', mlRsiResponse.reason);
      }

      // Process Order Blocks data
      if (orderBlocksResponse.status === 'fulfilled') {
        this.state.orderBlocksData = this.extractAnalysisData(orderBlocksResponse.value);
        this.updateOrderBlocksChart();
      } else {
        console.warn('Order Blocks analysis failed:', orderBlocksResponse.reason);
      }

      // Process Market Structure data
      if (marketStructureResponse.status === 'fulfilled') {
        this.state.marketStructureData = this.extractAnalysisData(marketStructureResponse.value);
        this.updateMarketStructureDisplay();
      } else {
        console.warn('Market Structure analysis failed:', marketStructureResponse.reason);
      }

      this.setState({ lastUpdate: Date.now() });
      this.hideLoading();

      console.log('✅ Analysis data loaded successfully');

    } catch (error) {
      console.error('❌ Failed to load analysis data:', error);
      this.showError(`Failed to load analysis data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Extract analysis data from MCP response
   */
  private extractAnalysisData(response: any): any {
    if (response && (response as any).content && Array.isArray((response as any).content)) {
      const content = (response as any).content[0];
      if (content && content.text) {
        try {
          return JSON.parse(content.text);
        } catch (error) {
          console.error('Failed to parse analysis data:', error);
          return null;
        }
      }
    }
    return response;
  }

  /**
   * Update ML-RSI chart
   */
  private updateMLRSIChart(): void {
    if (!this.mlRsiChart || !this.state.mlRsiData) return;

    try {
      // Convert ML-RSI data to chart format
      const rsiData = this.state.mlRsiData.rsiData || [];
      const chartData = rsiData.map((item: any) => ({
        time: (parseInt(item.timestamp) / 1000),
        open: 50, // RSI baseline
        high: Math.max(item.standardRsi, item.mlRsi),
        low: Math.min(item.standardRsi, item.mlRsi),
        close: item.mlRsi,
        volume: Math.abs(item.mlRsi - item.standardRsi), // Difference as volume
      }));

      this.mlRsiChart.updateData(chartData);
      this.mlRsiChart.fitContent();

      console.log('📊 ML-RSI chart updated');
    } catch (error) {
      console.error('Failed to update ML-RSI chart:', error);
    }
  }

  /**
   * Update Order Blocks chart
   */
  private updateOrderBlocksChart(): void {
    if (!this.orderBlocksChart || !this.state.orderBlocksData) return;

    try {
      // Convert order blocks data to chart format
      const priceData = this.state.orderBlocksData.priceData || [];
      const chartData = convertKlineToChartData(priceData);

      this.orderBlocksChart.updateData(chartData);

      // Add order blocks as overlays
      const orderBlocks = this.state.orderBlocksData.orderBlocks || [];
      this.orderBlocksChart.addOrderBlocks(orderBlocks);

      this.orderBlocksChart.fitContent();

      console.log('📊 Order Blocks chart updated');
    } catch (error) {
      console.error('Failed to update Order Blocks chart:', error);
    }
  }

  /**
   * Update Market Structure display
   */
  private updateMarketStructureDisplay(): void {
    const container = document.getElementById('market-structure-display');
    if (!container || !this.state.marketStructureData) return;

    const data = this.state.marketStructureData;

    container.innerHTML = `
      <div class="market-structure-summary">
        <div class="structure-item">
          <h4>Market Regime</h4>
          <span class="regime ${data.marketRegime?.toLowerCase()}">${data.marketRegime || 'Unknown'}</span>
        </div>
        <div class="structure-item">
          <h4>Trend Direction</h4>
          <span class="trend ${data.trendDirection?.toLowerCase()}">${data.trendDirection || 'Neutral'}</span>
        </div>
        <div class="structure-item">
          <h4>Volatility</h4>
          <span class="volatility">${data.volatility || 'N/A'}</span>
        </div>
        <div class="structure-item">
          <h4>Support Level</h4>
          <span class="support">${data.supportLevel || 'N/A'}</span>
        </div>
        <div class="structure-item">
          <h4>Resistance Level</h4>
          <span class="resistance">${data.resistanceLevel || 'N/A'}</span>
        </div>
      </div>
      <div class="trading-recommendations">
        <h4>Trading Recommendations</h4>
        <ul>
          ${(data.recommendations || []).map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Update symbol and reload data
   */
  async updateSymbol(symbol: string): Promise<void> {
    if (symbol === this.state.symbol) return;

    console.log(`🧠 Switching analysis to symbol: ${symbol}`);
    this.setState({ symbol });
    await this.loadAnalysisData();
  }

  /**
   * Update interval and reload data
   */
  async updateInterval(interval: string): Promise<void> {
    if (interval === this.state.interval) return;

    console.log(`🧠 Switching analysis to interval: ${interval}`);
    this.setState({ interval });
    await this.loadAnalysisData();
  }

  /**
   * Refresh analysis manually
   */
  async refreshAnalysis(): Promise<void> {
    console.log('🔄 Refreshing analysis...');
    await this.loadAnalysisData();
  }

  /**
   * Update internal state
   */
  private setState(updates: Partial<typeof this.state>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Show loading indicator
   */
  private showLoading(): void {
    const containers = ['ml-rsi-chart', 'order-blocks-chart', 'market-structure-display'];
    containers.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        const existing = container.querySelector('.analysis-loading');
        if (!existing) {
          const loading = document.createElement('div');
          loading.className = 'analysis-loading';
          loading.innerHTML = '<div class="loading-spinner"></div><p>Loading analysis...</p>';
          container.appendChild(loading);
        }
      }
    });
  }

  /**
   * Hide loading indicator
   */
  private hideLoading(): void {
    const containers = ['ml-rsi-chart', 'order-blocks-chart', 'market-structure-display'];
    containers.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        const loading = container.querySelector('.analysis-loading');
        if (loading) {
          loading.remove();
        }
      }
    });
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const containers = ['ml-rsi-chart', 'order-blocks-chart', 'market-structure-display'];
    containers.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        const existing = container.querySelector('.analysis-error');
        if (!existing) {
          const error = document.createElement('div');
          error.className = 'analysis-error';
          error.innerHTML = `<p>❌ ${message}</p><button onclick="location.reload()">Retry</button>`;
          container.appendChild(error);
        }
      }
    });
  }

  /**
   * Get current state
   */
  getState(): typeof this.state {
    return { ...this.state };
  }

  /**
   * Destroy analysis manager and clean up resources
   */
  destroy(): void {
    if (this.mlRsiChart) {
      this.mlRsiChart.destroy();
      this.mlRsiChart = null;
    }

    if (this.orderBlocksChart) {
      this.orderBlocksChart.destroy();
      this.orderBlocksChart = null;
    }

    this.isInitialized = false;
    console.log('🗑️ Analysis Manager destroyed');
  }
}

// Create singleton instance
export const analysisManager = new AnalysisManager();
