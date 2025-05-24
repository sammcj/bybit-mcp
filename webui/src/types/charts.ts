/**
 * TypeScript types for chart components and data visualization
 */

import type { Time } from 'lightweight-charts';

// Chart data types
export interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface VolumeData {
  time: Time;
  value: number;
  color?: string;
}

export interface LineData {
  time: Time;
  value: number;
}

export interface AreaData {
  time: Time;
  value: number;
}

// Chart configuration
export interface ChartConfig {
  width: number;
  height: number;
  layout: {
    background: {
      type: 'solid';
      color: string;
    };
    textColor: string;
  };
  grid: {
    vertLines: {
      color: string;
    };
    horzLines: {
      color: string;
    };
  };
  crosshair: {
    mode: number;
  };
  rightPriceScale: {
    borderColor: string;
  };
  timeScale: {
    borderColor: string;
    timeVisible: boolean;
    secondsVisible: boolean;
  };
}

// Chart series types
export interface CandlestickSeriesConfig {
  upColor: string;
  downColor: string;
  borderDownColor: string;
  borderUpColor: string;
  wickDownColor: string;
  wickUpColor: string;
}

export interface VolumeSeriesConfig {
  color: string;
  priceFormat: {
    type: 'volume';
  };
  priceScaleId: string;
  scaleMargins: {
    top: number;
    bottom: number;
  };
}

export interface LineSeriesConfig {
  color: string;
  lineWidth: number;
  lineType?: number;
  crosshairMarkerVisible?: boolean;
  crosshairMarkerRadius?: number;
}

// Technical indicator types
export interface RSIData extends LineData {
  overbought?: number;
  oversold?: number;
}

export interface MLRSIIndicatorData {
  time: Time;
  standardRsi: number;
  mlRsi: number;
  adaptiveOverbought: number;
  adaptiveOversold: number;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface OrderBlockData {
  id: string;
  time: Time;
  top: number;
  bottom: number;
  type: 'bullish' | 'bearish';
  mitigated: boolean;
  volume: number;
}

// Chart component props
export interface PriceChartProps {
  data: CandlestickData[];
  volumeData?: VolumeData[];
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  onCrosshairMove?: (param: any) => void;
}

export interface IndicatorChartProps {
  data: LineData[] | RSIData[] | MLRSIIndicatorData[];
  type: 'rsi' | 'ml-rsi' | 'line';
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
}

export interface OrderBlockChartProps {
  priceData: CandlestickData[];
  orderBlocks: OrderBlockData[];
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
}

// Chart state management
export interface ChartState {
  symbol: string;
  interval: string;
  priceData: CandlestickData[];
  volumeData: VolumeData[];
  indicators: {
    rsi?: RSIData[];
    mlRsi?: MLRSIIndicatorData[];
  };
  orderBlocks: OrderBlockData[];
  isLoading: boolean;
  error?: string;
  lastUpdate: number;
}

// Chart actions
export type ChartAction = 
  | { type: 'SET_SYMBOL'; symbol: string }
  | { type: 'SET_INTERVAL'; interval: string }
  | { type: 'SET_PRICE_DATA'; data: CandlestickData[] }
  | { type: 'SET_VOLUME_DATA'; data: VolumeData[] }
  | { type: 'SET_RSI_DATA'; data: RSIData[] }
  | { type: 'SET_ML_RSI_DATA'; data: MLRSIIndicatorData[] }
  | { type: 'SET_ORDER_BLOCKS'; data: OrderBlockData[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | undefined }
  | { type: 'UPDATE_TIMESTAMP' };

// Chart utilities
export interface TimeRange {
  from: Time;
  to: Time;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface ChartMarker {
  time: Time;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text?: string;
  size?: number;
}

// Chart themes
export interface ChartTheme {
  name: string;
  background: string;
  textColor: string;
  gridColor: string;
  candlestick: {
    upColor: string;
    downColor: string;
    borderUpColor: string;
    borderDownColor: string;
    wickUpColor: string;
    wickDownColor: string;
  };
  volume: {
    upColor: string;
    downColor: string;
  };
  indicators: {
    rsi: string;
    mlRsi: string;
    overbought: string;
    oversold: string;
  };
  orderBlocks: {
    bullish: string;
    bearish: string;
    mitigated: string;
  };
}

// Export/import types
export interface ChartExportOptions {
  format: 'png' | 'svg' | 'pdf';
  width: number;
  height: number;
  quality?: number;
  background?: string;
}

export interface ChartSnapshot {
  symbol: string;
  interval: string;
  timestamp: number;
  data: ChartState;
  settings: {
    theme: string;
    indicators: string[];
    timeRange: TimeRange;
  };
}
