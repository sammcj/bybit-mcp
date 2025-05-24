/**
 * Chart Manager - Handles the Charts tab functionality
 * Manages price charts, volume charts, and real-time updates
 */

import { ChartComponent, convertKlineToChartData } from './ChartComponent';
import { getKlineData } from '@/services/mcpClient';
import type { ChartState } from '@/types/charts';

export class ChartManager {
  private priceChart: ChartComponent | null = null;
  private volumeChart: ChartComponent | null = null;
  private state: ChartState;
  private refreshTimer: number | null = null;
  private isInitialized = false;

  constructor() {
    this.state = {
      symbol: 'BTCUSDT',
      interval: '15',
      priceData: [],
      volumeData: [],
      indicators: {},
      orderBlocks: [],
      isLoading: false,
      lastUpdate: 0,
    };
  }

  /**
   * Initialize the chart manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('📈 Initializing Chart Manager...');

      // Set up event listeners
      this.setupEventListeners();

      // Initialize charts
      this.initializeCharts();

      // Load initial data
      await this.loadChartData();

      // Start auto-refresh (every 30 seconds for real-time updates)
      this.startAutoRefresh(30000);

      this.isInitialized = true;
      console.log('✅ Chart Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Chart Manager:', error);
      this.showError('Failed to initialize charts');
    }
  }

  /**
   * Set up event listeners for chart controls
   */
  private setupEventListeners(): void {
    // Symbol selection
    const symbolSelect = document.getElementById('symbol-select') as HTMLSelectElement;
    if (symbolSelect) {
      symbolSelect.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        this.updateSymbol(target.value);
      });
      symbolSelect.value = this.state.symbol;
    }

    // Interval selection
    const intervalSelect = document.getElementById('interval-select') as HTMLSelectElement;
    if (intervalSelect) {
      intervalSelect.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        this.updateTimeInterval(target.value);
      });
      intervalSelect.value = this.state.interval;
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-chart') as HTMLButtonElement;
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshCharts();
      });
    }
  }

  /**
   * Initialize chart components
   */
  private initializeCharts(): void {
    // Initialize price chart
    const priceContainer = document.getElementById('price-chart');
    if (priceContainer) {
      // Clear any existing content
      priceContainer.innerHTML = '';

      // Calculate dimensions
      const containerRect = priceContainer.getBoundingClientRect();
      const width = Math.max(containerRect.width || 600, 400);
      const height = Math.max(containerRect.height || 400, 300);

      this.priceChart = new ChartComponent(priceContainer, width, height);
      console.log('📊 Price chart initialized');
    }

    // Initialize volume chart (separate container)
    const volumeContainer = document.getElementById('volume-chart');
    if (volumeContainer) {
      // Clear any existing content
      volumeContainer.innerHTML = '';

      // Calculate dimensions
      const containerRect = volumeContainer.getBoundingClientRect();
      const width = Math.max(containerRect.width || 600, 400);
      const height = Math.max(containerRect.height || 200, 150);

      this.volumeChart = new ChartComponent(volumeContainer, width, height);
      console.log('📊 Volume chart initialized');
    }
  }

  /**
   * Load chart data from MCP server
   */
  async loadChartData(): Promise<void> {
    if (this.state.isLoading) return;

    try {
      this.setState({ isLoading: true });
      this.showLoading();

      console.log(`📈 Loading chart data for ${this.state.symbol} (${this.state.interval})`);

      // Fetch kline data
      const klineResponse = await getKlineData(
        this.state.symbol,
        this.state.interval,
        200 // Get last 200 candles
      );

      console.log('📊 Kline response:', klineResponse);

      // Extract data from response
      let klineData = [];

      // Handle MCP response format
      if (klineResponse && (klineResponse as any).content && Array.isArray((klineResponse as any).content)) {
        const content = (klineResponse as any).content[0];
        if (content && content.text) {
          try {
            klineData = JSON.parse(content.text);
          } catch (error) {
            console.error('Failed to parse kline data:', error);
            throw new Error('Invalid kline data format');
          }
        }
      } else if (klineResponse && (klineResponse as any).list) {
        klineData = (klineResponse as any).list;
      } else if (klineResponse && Array.isArray(klineResponse)) {
        klineData = klineResponse;
      } else if (klineResponse && (klineResponse as any).result && (klineResponse as any).result.list) {
        klineData = (klineResponse as any).result.list;
      }

      if (!Array.isArray(klineData) || klineData.length === 0) {
        throw new Error('No chart data received');
      }

      // Convert to chart format
      const chartData = convertKlineToChartData(klineData);

      if (chartData.length === 0) {
        throw new Error('Failed to convert chart data');
      }

      console.log(`✅ Loaded ${chartData.length} data points`);

      // Update state
      this.setState({
        priceData: chartData,
        volumeData: chartData.map(item => ({
          time: item.time,
          value: item.volume || 0,
          color: item.close >= item.open ? '#10b981' : '#ef4444',
        })),
        lastUpdate: Date.now(),
      });

      // Update charts
      this.updateCharts();
      this.hideLoading();

    } catch (error) {
      console.error('❌ Failed to load chart data:', error);
      this.showError(`Failed to load chart data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Update chart displays with current data
   */
  private updateCharts(): void {
    if (this.priceChart && this.state.priceData.length > 0) {
      this.priceChart.updateData(this.state.priceData);
      this.priceChart.fitContent();
    }

    if (this.volumeChart && this.state.volumeData.length > 0) {
      // For volume chart, we'll create a simple volume display
      const volumeData = this.state.priceData.map(item => ({
        time: item.time,
        open: 0,
        high: item.volume || 0,
        low: 0,
        close: item.volume || 0,
        volume: item.volume,
      }));

      this.volumeChart.updateData(volumeData);
      this.volumeChart.fitContent();
    }
  }

  /**
   * Update symbol and reload data
   */
  async updateSymbol(symbol: string): Promise<void> {
    if (symbol === this.state.symbol) return;

    console.log(`📈 Switching to symbol: ${symbol}`);
    this.setState({ symbol });
    await this.loadChartData();
  }

  /**
   * Update time interval and reload data
   */
  async updateTimeInterval(interval: string): Promise<void> {
    if (interval === this.state.interval) return;

    console.log(`📈 Switching to interval: ${interval}`);
    this.setState({ interval });
    await this.loadChartData();
  }

  /**
   * Refresh charts manually
   */
  async refreshCharts(): Promise<void> {
    console.log('🔄 Refreshing charts...');
    await this.loadChartData();
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(intervalMs: number): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = window.setInterval(() => {
      if (!this.state.isLoading) {
        this.loadChartData().catch(console.error);
      }
    }, intervalMs);

    console.log(`🔄 Auto-refresh started (${intervalMs / 1000}s interval)`);
  }

  /**
   * Stop auto-refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('⏹️ Auto-refresh stopped');
    }
  }

  /**
   * Update internal state
   */
  private setState(updates: Partial<ChartState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Show loading indicator
   */
  private showLoading(): void {
    const containers = ['price-chart', 'volume-chart'];
    containers.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        const existing = container.querySelector('.chart-loading');
        if (!existing) {
          const loading = document.createElement('div');
          loading.className = 'chart-loading';
          loading.innerHTML = '<div class="loading-spinner"></div><p>Loading chart data...</p>';
          container.appendChild(loading);
        }
      }
    });
  }

  /**
   * Hide loading indicator
   */
  private hideLoading(): void {
    const containers = ['price-chart', 'volume-chart'];
    containers.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        const loading = container.querySelector('.chart-loading');
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
    const containers = ['price-chart', 'volume-chart'];
    containers.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        const existing = container.querySelector('.chart-error');
        if (!existing) {
          const error = document.createElement('div');
          error.className = 'chart-error';
          error.innerHTML = `<p>❌ ${message}</p><button onclick="location.reload()">Retry</button>`;
          container.appendChild(error);
        }
      }
    });
  }

  /**
   * Get current state
   */
  getState(): ChartState {
    return { ...this.state };
  }

  /**
   * Destroy chart manager and clean up resources
   */
  destroy(): void {
    this.stopAutoRefresh();

    if (this.priceChart) {
      this.priceChart.destroy();
      this.priceChart = null;
    }

    if (this.volumeChart) {
      this.volumeChart.destroy();
      this.volumeChart = null;
    }

    this.isInitialized = false;
    console.log('🗑️ Chart Manager destroyed');
  }
}

// Create singleton instance
export const chartManager = new ChartManager();
