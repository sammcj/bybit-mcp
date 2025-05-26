/**
 * DataCard Component - Expandable cards for visualising tool response data
 *
 * Provides a clean, collapsible interface for displaying structured data
 * with embedded visualisations when expanded.
 */

export interface DataCardConfig {
  title: string;
  summary: string;
  data: any;
  dataType: 'kline' | 'rsi' | 'orderBlocks' | 'price' | 'volume' | 'unknown';
  expanded?: boolean;
  showChart?: boolean;
}

export class DataCard {
  private container: HTMLElement;
  private config: DataCardConfig;
  private isExpanded: boolean = false;
  private chartContainer?: HTMLElement;

  constructor(container: HTMLElement, config: DataCardConfig) {
    this.container = container;
    this.config = config;
    this.isExpanded = config.expanded || false;

    this.render();
    this.setupEventListeners();

    // If expanded by default, render chart after DOM is ready
    if (this.isExpanded) {
      setTimeout(() => {
        this.renderChart();
      }, 150);
    }
  }

  /**
   * Render the data card structure
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="data-card ${this.isExpanded ? 'expanded' : 'collapsed'}" data-type="${this.config.dataType}">
        <div class="data-card-header" role="button" tabindex="0" aria-expanded="${this.isExpanded}">
          <div class="data-card-title">
            <span class="data-card-icon">${this.getDataTypeIcon()}</span>
            <h4>${this.config.title}</h4>
          </div>
          <div class="data-card-controls">
            <span class="data-card-summary">${this.config.summary}</span>
            <button class="expand-toggle" aria-label="${this.isExpanded ? 'Collapse' : 'Expand'} data card">
              <span class="expand-icon">${this.isExpanded ? '▼' : '▶'}</span>
            </button>
          </div>
        </div>
        <div class="data-card-content" ${this.isExpanded ? '' : 'style="display: none;"'}>
          <div class="data-card-details">
            ${this.renderDataSummary()}
          </div>
          ${this.config.showChart !== false ? '<div class="data-card-chart" id="chart-' + this.generateId() + '"></div>' : ''}
        </div>
      </div>
    `;

    // Store reference to chart container if it exists
    const chartElement = this.container.querySelector('.data-card-chart') as HTMLElement;
    if (chartElement) {
      this.chartContainer = chartElement;
    }
  }

  /**
   * Set up event listeners for card interactions
   */
  private setupEventListeners(): void {
    const header = this.container.querySelector('.data-card-header') as HTMLElement;
    const toggleButton = this.container.querySelector('.expand-toggle') as HTMLElement;

    if (header) {
      header.addEventListener('click', () => this.toggle());
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggle();
        }
      });
    }

    if (toggleButton) {
      toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }
  }

  /**
   * Toggle card expanded/collapsed state
   */
  public toggle(): void {
    this.isExpanded = !this.isExpanded;
    this.updateExpandedState();
  }

  /**
   * Expand the card
   */
  public expand(): void {
    if (!this.isExpanded) {
      this.isExpanded = true;
      this.updateExpandedState();
    }
  }

  /**
   * Collapse the card
   */
  public collapse(): void {
    if (this.isExpanded) {
      this.isExpanded = false;
      this.updateExpandedState();
    }
  }

  /**
   * Update the visual state when expanded/collapsed
   */
  private updateExpandedState(): void {
    const card = this.container.querySelector('.data-card') as HTMLElement;
    const content = this.container.querySelector('.data-card-content') as HTMLElement;
    const header = this.container.querySelector('.data-card-header') as HTMLElement;
    const expandIcon = this.container.querySelector('.expand-icon') as HTMLElement;

    if (card && content && header && expandIcon) {
      // Update classes
      card.classList.toggle('expanded', this.isExpanded);
      card.classList.toggle('collapsed', !this.isExpanded);

      // Update ARIA attributes
      header.setAttribute('aria-expanded', this.isExpanded.toString());

      // Update expand icon
      expandIcon.textContent = this.isExpanded ? '▼' : '▶';

      // Update button label
      const toggleButton = this.container.querySelector('.expand-toggle') as HTMLElement;
      if (toggleButton) {
        toggleButton.setAttribute('aria-label', `${this.isExpanded ? 'Collapse' : 'Expand'} data card`);
      }

      // Animate content visibility
      if (this.isExpanded) {
        content.style.display = 'block';
        // Trigger chart rendering with a small delay to ensure DOM is ready
        setTimeout(() => {
          this.renderChart();
        }, 100);
      } else {
        // Add a small delay to allow animation
        setTimeout(() => {
          if (!this.isExpanded) {
            content.style.display = 'none';
          }
        }, 250);
      }
    }
  }

  /**
   * Get appropriate icon for data type
   */
  private getDataTypeIcon(): string {
    switch (this.config.dataType) {
      case 'kline': return '📈';
      case 'rsi': return '📊';
      case 'orderBlocks': return '🧱';
      case 'price': return '💰';
      case 'volume': return '📊';
      default: return '📋';
    }
  }

  /**
   * Render data summary in the expanded view
   */
  private renderDataSummary(): string {
    // This will be enhanced based on data type
    if (typeof this.config.data === 'object') {
      return `<pre class="data-preview">${JSON.stringify(this.config.data, null, 2)}</pre>`;
    }
    return `<div class="data-preview">${this.config.data}</div>`;
  }

  /**
   * Render chart when card is expanded
   */
  private renderChart(): void {
    if (!this.chartContainer || this.config.showChart === false) {
      return;
    }

    // Render different chart types based on data type
    switch (this.config.dataType) {
      case 'kline':
        this.renderCandlestickChart();
        break;
      case 'rsi':
        this.renderLineChart();
        break;
      case 'price':
        this.renderPriceChart();
        break;
      default:
        this.renderPlaceholder();
        break;
    }
  }

  /**
   * Render candlestick chart for kline data
   */
  private renderCandlestickChart(): void {
    if (!this.chartContainer) return;

    // Extract kline data
    let klineData = this.config.data;
    if (this.config.data.data && Array.isArray(this.config.data.data)) {
      klineData = this.config.data.data;
    }

    if (!Array.isArray(klineData) || klineData.length === 0) {
      this.renderPlaceholder();
      return;
    }

    // Create canvas element with responsive sizing
    const canvas = document.createElement('canvas');
    const maxWidth = Math.min(this.chartContainer.clientWidth || 600, 800); // Cap at 800px
    const containerWidth = Math.max(maxWidth - 40, 400); // Ensure minimum 400px with padding
    canvas.width = containerWidth;
    canvas.height = 300;
    canvas.style.width = '100%';
    canvas.style.maxWidth = `${containerWidth}px`;
    canvas.style.height = '300px';
    canvas.style.border = '1px solid #ddd';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';

    this.chartContainer.innerHTML = '';
    this.chartContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Parse and normalize data
    const candles = klineData.slice(-50).map((item: any) => {
      if (Array.isArray(item)) {
        return {
          timestamp: parseInt(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5] || 0)
        };
      } else if (typeof item === 'object') {
        return {
          timestamp: parseInt(item.timestamp || item.time || item.openTime || 0),
          open: parseFloat(item.open || 0),
          high: parseFloat(item.high || 0),
          low: parseFloat(item.low || 0),
          close: parseFloat(item.close || 0),
          volume: parseFloat(item.volume || 0)
        };
      }
      return null;
    }).filter(Boolean);

    if (candles.length === 0) {
      this.renderPlaceholder();
      return;
    }

    // Calculate price range
    const prices = candles.flatMap(c => c ? [c.high, c.low] : []);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1;

    // Chart dimensions
    const chartWidth = canvas.width - 80;
    const chartHeight = canvas.height - 60;
    const chartX = 60;
    const chartY = 20;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = chartY + (chartHeight * i) / 5;
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartWidth, y);
      ctx.stroke();
    }

    // Draw price labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const price = maxPrice + padding - ((maxPrice + padding - (minPrice - padding)) * i) / 5;
      const y = chartY + (chartHeight * i) / 5;
      ctx.fillText(price.toFixed(4), chartX - 10, y + 4);
    }

    // Draw candlesticks
    const candleWidth = Math.max(2, chartWidth / candles.length - 2);
    candles.forEach((candle, index) => {
      if (!candle) return;

      const x = chartX + (index * chartWidth) / candles.length + (chartWidth / candles.length - candleWidth) / 2;

      // Calculate y positions
      const highY = chartY + ((maxPrice + padding - candle.high) / (maxPrice + padding - (minPrice - padding))) * chartHeight;
      const lowY = chartY + ((maxPrice + padding - candle.low) / (maxPrice + padding - (minPrice - padding))) * chartHeight;
      const openY = chartY + ((maxPrice + padding - candle.open) / (maxPrice + padding - (minPrice - padding))) * chartHeight;
      const closeY = chartY + ((maxPrice + padding - candle.close) / (maxPrice + padding - (minPrice - padding))) * chartHeight;

      // Determine candle color
      const isGreen = candle.close >= candle.open;
      const bodyColor = isGreen ? '#22c55e' : '#ef4444';
      const wickColor = '#666';

      // Draw wick (high-low line)
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, highY);
      ctx.lineTo(x + candleWidth / 2, lowY);
      ctx.stroke();

      // Draw candle body
      ctx.fillStyle = bodyColor;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY) || 1;
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
    });

    // Add title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    const symbol = this.config.data.symbol || 'Symbol';
    const interval = this.config.data.interval || '';
    ctx.fillText(`${symbol} ${interval} Candlestick Chart`, chartX, 15);

    // Add current price info
    const lastCandle = candles[candles.length - 1];
    if (lastCandle) {
      ctx.font = '12px Arial';
      ctx.fillStyle = lastCandle.close >= lastCandle.open ? '#22c55e' : '#ef4444';
      ctx.textAlign = 'right';
      ctx.fillText(`Last: $${lastCandle.close.toFixed(4)}`, canvas.width - 10, 15);
    }
  }

  /**
   * Render line chart for RSI and other indicators
   */
  private renderLineChart(): void {
    if (!this.chartContainer) return;

    this.chartContainer.innerHTML = `
      <div class="chart-placeholder">
        <p>📊 Line chart for ${this.config.dataType} data</p>
        <small>Line chart implementation coming soon</small>
      </div>
    `;
  }

  /**
   * Render simple price chart
   */
  private renderPriceChart(): void {
    if (!this.chartContainer) return;

    this.chartContainer.innerHTML = `
      <div class="chart-placeholder">
        <p>💰 Price chart rendering</p>
        <small>Price chart implementation coming soon</small>
      </div>
    `;
  }

  /**
   * Render placeholder for unsupported chart types
   */
  private renderPlaceholder(): void {
    if (!this.chartContainer) return;

    this.chartContainer.innerHTML = `
      <div class="chart-placeholder">
        <p>Chart rendering for ${this.config.dataType} data</p>
        <small>Chart component will be implemented next</small>
      </div>
    `;
  }

  /**
   * Generate unique ID for chart container
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Update card configuration
   */
  public updateConfig(newConfig: Partial<DataCardConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.render();
    this.setupEventListeners();
  }

  /**
   * Get current card state
   */
  public getState(): { expanded: boolean; dataType: string } {
    return {
      expanded: this.isExpanded,
      dataType: this.config.dataType
    };
  }

  /**
   * Destroy the card and clean up event listeners
   */
  public destroy(): void {
    // Event listeners will be automatically removed when innerHTML is cleared
    this.container.innerHTML = '';
  }
}
