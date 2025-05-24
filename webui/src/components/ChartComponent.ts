/**
 * Chart component using Lightweight Charts
 */

import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  ColorType,
  CandlestickSeries,
  HistogramSeries
} from 'lightweight-charts';
import type { CandlestickData as AppCandlestickData, ChartTheme } from '@/types/charts';
import { configService } from '@/services/configService';

export class ChartComponent {
  private chart: IChartApi;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private volumeSeries?: ISeriesApi<'Histogram'>;
  private container: HTMLElement;
  private theme: ChartTheme;

  constructor(container: HTMLElement, width: number = 800, height: number = 400) {
    this.container = container;
    this.theme = this.getTheme();

    // Create chart
    this.chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: this.theme.background },
        textColor: this.theme.textColor,
      },
      grid: {
        vertLines: { color: this.theme.gridColor },
        horzLines: { color: this.theme.gridColor },
      },
      crosshair: {
        mode: 1, // Normal crosshair mode
      },
      rightPriceScale: {
        borderColor: this.theme.gridColor,
      },
      timeScale: {
        borderColor: this.theme.gridColor,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: this.theme.candlestick.upColor,
      downColor: this.theme.candlestick.downColor,
      borderDownColor: this.theme.candlestick.borderDownColor,
      borderUpColor: this.theme.candlestick.borderUpColor,
      wickDownColor: this.theme.candlestick.wickDownColor,
      wickUpColor: this.theme.candlestick.wickUpColor,
    });

    // Listen for theme changes
    configService.subscribe(() => {
      this.updateTheme();
    });

    // Handle resize
    this.setupResizeObserver();
  }

  /**
   * Update chart data
   */
  public updateData(data: AppCandlestickData[]): void {
    const chartData: CandlestickData[] = data.map(item => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));

    this.candlestickSeries.setData(chartData);

    // Update volume if available
    if (data.some(item => item.volume !== undefined)) {
      this.updateVolumeData(data);
    }
  }

  /**
   * Add volume series
   */
  private updateVolumeData(data: AppCandlestickData[]): void {
    if (!this.volumeSeries) {
      this.volumeSeries = this.chart.addSeries(HistogramSeries, {
        color: this.theme.volume.upColor,
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });
    }

    const volumeData = data
      .filter(item => item.volume !== undefined)
      .map(item => ({
        time: item.time,
        value: item.volume!,
        color: item.close >= item.open ? this.theme.volume.upColor : this.theme.volume.downColor,
      }));

    this.volumeSeries.setData(volumeData);
  }

  /**
   * Add order blocks overlay
   */
  public addOrderBlocks(blocks: Array<{
    time: Time;
    top: number;
    bottom: number;
    type: 'bullish' | 'bearish';
    mitigated: boolean;
  }>): void {
    // Create rectangles for order blocks
    blocks.forEach(block => {
      const color = block.mitigated
        ? this.theme.orderBlocks.mitigated
        : block.type === 'bullish'
          ? this.theme.orderBlocks.bullish
          : this.theme.orderBlocks.bearish;

      // Note: Lightweight Charts doesn't have built-in rectangle support
      // This would need to be implemented with custom drawings or markers
      console.log('Order block:', block, 'Color:', color);
    });
  }

  /**
   * Fit chart content
   */
  public fitContent(): void {
    this.chart.timeScale().fitContent();
  }

  /**
   * Resize chart
   */
  public resize(width: number, height: number): void {
    this.chart.applyOptions({ width, height });
  }

  /**
   * Update theme
   */
  private updateTheme(): void {
    this.theme = this.getTheme();

    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: this.theme.background },
        textColor: this.theme.textColor,
      },
      grid: {
        vertLines: { color: this.theme.gridColor },
        horzLines: { color: this.theme.gridColor },
      },
      rightPriceScale: {
        borderColor: this.theme.gridColor,
      },
      timeScale: {
        borderColor: this.theme.gridColor,
      },
    });

    // Update series colors
    this.candlestickSeries.applyOptions({
      upColor: this.theme.candlestick.upColor,
      downColor: this.theme.candlestick.downColor,
      borderDownColor: this.theme.candlestick.borderDownColor,
      borderUpColor: this.theme.candlestick.borderUpColor,
      wickDownColor: this.theme.candlestick.wickDownColor,
      wickUpColor: this.theme.candlestick.wickUpColor,
    });

    if (this.volumeSeries) {
      this.volumeSeries.applyOptions({
        color: this.theme.volume.upColor,
      });
    }
  }

  /**
   * Get current theme
   */
  private getTheme(): ChartTheme {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    return {
      name: isDark ? 'dark' : 'light',
      background: isDark ? '#1e293b' : '#ffffff',
      textColor: isDark ? '#f8fafc' : '#0f172a',
      gridColor: isDark ? '#374151' : '#e5e7eb',
      candlestick: {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      },
      volume: {
        upColor: '#10b98180',
        downColor: '#ef444480',
      },
      indicators: {
        rsi: '#6366f1',
        mlRsi: '#8b5cf6',
        overbought: '#ef4444',
        oversold: '#10b981',
      },
      orderBlocks: {
        bullish: '#10b98140',
        bearish: '#ef444440',
        mitigated: '#6b728040',
      },
    };
  }

  /**
   * Setup resize observer
   */
  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          this.resize(width, height);
        }
      });

      resizeObserver.observe(this.container);
    }
  }

  /**
   * Destroy chart
   */
  public destroy(): void {
    this.chart.remove();
  }

  /**
   * Get chart instance (for advanced usage)
   */
  public getChart(): IChartApi {
    return this.chart;
  }

  /**
   * Get candlestick series (for advanced usage)
   */
  public getCandlestickSeries(): ISeriesApi<'Candlestick'> {
    return this.candlestickSeries;
  }

  /**
   * Get volume series (for advanced usage)
   */
  public getVolumeSeries(): ISeriesApi<'Histogram'> | undefined {
    return this.volumeSeries;
  }
}

// Utility function to convert MCP kline data to chart format
export function convertKlineToChartData(klineData: any[]): AppCandlestickData[] {
  if (!Array.isArray(klineData)) {
    console.warn('Invalid kline data format:', klineData);
    return [];
  }

  return klineData.map(item => {
    // Handle different possible data formats from Bybit API
    const startTime = item.timestamp || item.startTime || item.start || item.time;
    const openPrice = item.open || item.openPrice || item.o;
    const highPrice = item.high || item.highPrice || item.h;
    const lowPrice = item.low || item.lowPrice || item.l;
    const closePrice = item.close || item.closePrice || item.c;
    const volume = item.volume || item.vol || item.v || 0;

    return {
      time: (parseInt(startTime) / 1000) as Time, // Convert to seconds
      open: parseFloat(openPrice),
      high: parseFloat(highPrice),
      low: parseFloat(lowPrice),
      close: parseFloat(closePrice),
      volume: parseFloat(volume),
    };
  }).filter(item =>
    // Filter out invalid data points
    !isNaN(item.time as number) &&
    !isNaN(item.open) &&
    !isNaN(item.high) &&
    !isNaN(item.low) &&
    !isNaN(item.close)
  ).sort((a, b) => (a.time as number) - (b.time as number)); // Sort by time
}

// Utility function to create a chart in a container
export function createChartInContainer(containerId: string, width?: number, height?: number): ChartComponent | null {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Chart container with id "${containerId}" not found`);
    return null;
  }

  return new ChartComponent(container, width, height);
}
