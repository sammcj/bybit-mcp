/**
 * Data Detection Utilities
 *
 * Detects and classifies different types of data from MCP tool responses
 * to determine appropriate visualisation methods.
 */

export type DataType = 'kline' | 'rsi' | 'orderBlocks' | 'price' | 'volume' | 'unknown';

export interface DetectionResult {
  dataType: DataType;
  confidence: number; // 0-1 scale
  summary: string;
  visualisable: boolean;
  sampleData?: any;
}

/**
 * Main data detection function
 */
export function detectDataType(data: any): DetectionResult {
  if (!data) {
    return createResult('unknown', 0, 'No data provided', false);
  }

  // Try different detection methods in order of specificity
  const detectors = [
    detectKlineData,
    detectRSIData,
    detectOrderBlocksData,
    detectPriceData,
    detectVolumeData
  ];

  for (const detector of detectors) {
    const result = detector(data);
    if (result.confidence > 0.7) {
      return result;
    }
  }

  // Fallback to unknown
  return createResult('unknown', 0, 'Unrecognised data format', false);
}

/**
 * Detect OHLCV/Kline data
 */
function detectKlineData(data: any): DetectionResult {
  try {
    // Check if data has a nested 'data' array (common MCP response format)
    let klineArray = data;
    if (data && typeof data === 'object' && Array.isArray(data.data)) {
      klineArray = data.data;
    }

    // Check if it's an array of kline data
    if (Array.isArray(klineArray) && klineArray.length > 0) {
      const sample = klineArray[0];

      // Check for common kline data structures
      const hasOHLCV = sample && (
        // Array format: [timestamp, open, high, low, close, volume]
        (Array.isArray(sample) && sample.length >= 6) ||
        // Object format with OHLCV properties
        (typeof sample === 'object' &&
         hasNumericProperties(sample, ['open', 'high', 'low', 'close']) &&
         (sample.timestamp || sample.time || sample.openTime))
      );

      if (hasOHLCV) {
        const count = klineArray.length;
        const timespan = getTimespan(klineArray);
        const symbol = data.symbol || 'Unknown';
        return createResult(
          'kline',
          0.9,
          `${count} candles for ${symbol}${timespan ? ` (${timespan})` : ''}`,
          true,
          klineArray.slice(0, 3) // Sample first 3 items
        );
      }
    }

    // Check for single kline object
    if (typeof data === 'object' && hasNumericProperties(data, ['open', 'high', 'low', 'close'])) {
      return createResult('kline', 0.8, 'Single candle data', true, data);
    }

    return createResult('kline', 0, '', false);
  } catch {
    return createResult('kline', 0, '', false);
  }
}

/**
 * Detect RSI or other indicator data
 */
function detectRSIData(data: any): DetectionResult {
  try {
    // Check for RSI-specific patterns
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0];

      // RSI values are typically between 0-100
      const hasRSIValues = sample && (
        (typeof sample === 'object' &&
         (sample.rsi !== undefined || sample.RSI !== undefined)) ||
        (typeof sample === 'number' && sample >= 0 && sample <= 100)
      );

      if (hasRSIValues) {
        const count = data.length;
        const avgValue = calculateAverageRSI(data);
        return createResult(
          'rsi',
          0.85,
          `${count} RSI values (avg: ${avgValue.toFixed(1)})`,
          true,
          data.slice(0, 5)
        );
      }
    }

    // Check for single RSI value
    if (typeof data === 'number' && data >= 0 && data <= 100) {
      return createResult('rsi', 0.7, `RSI: ${data.toFixed(2)}`, true, data);
    }

    // Check for object with RSI property
    if (typeof data === 'object' && (data.rsi !== undefined || data.RSI !== undefined)) {
      const rsiValue = data.rsi || data.RSI;
      return createResult('rsi', 0.8, `RSI: ${rsiValue}`, true, data);
    }

    return createResult('rsi', 0, '', false);
  } catch {
    return createResult('rsi', 0, '', false);
  }
}

/**
 * Detect Order Blocks data
 */
function detectOrderBlocksData(data: any): DetectionResult {
  try {
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0];

      // Look for order block characteristics
      const hasOrderBlockProps = sample && typeof sample === 'object' && (
        (sample.type && (sample.type.includes('block') || sample.type.includes('order'))) ||
        (hasNumericProperties(sample, ['high', 'low']) && sample.volume) ||
        (sample.bullish !== undefined || sample.bearish !== undefined)
      );

      if (hasOrderBlockProps) {
        const count = data.length;
        const types = getOrderBlockTypes(data);
        return createResult(
          'orderBlocks',
          0.85,
          `${count} blocks (${types})`,
          true,
          data.slice(0, 3)
        );
      }
    }

    return createResult('orderBlocks', 0, '', false);
  } catch {
    return createResult('orderBlocks', 0, '', false);
  }
}

/**
 * Detect Price data
 */
function detectPriceData(data: any): DetectionResult {
  try {
    // Single price value
    if (typeof data === 'number' && data > 0) {
      return createResult('price', 0.6, `$${data.toFixed(4)}`, true, data);
    }

    // Price object
    if (typeof data === 'object' && data.price !== undefined) {
      return createResult('price', 0.8, `$${data.price}`, true, data);
    }

    // Array of prices
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
      const count = data.length;
      const latest = data[data.length - 1];
      return createResult('price', 0.7, `${count} prices (latest: $${latest})`, true, data.slice(-5));
    }

    return createResult('price', 0, '', false);
  } catch {
    return createResult('price', 0, '', false);
  }
}

/**
 * Detect Volume data
 */
function detectVolumeData(data: any): DetectionResult {
  try {
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0];

      // Volume array or objects with volume property
      const hasVolumeData = (
        typeof sample === 'number' ||
        (typeof sample === 'object' && sample.volume !== undefined)
      );

      if (hasVolumeData) {
        const count = data.length;
        const totalVolume = calculateTotalVolume(data);
        return createResult(
          'volume',
          0.8,
          `${count} volume points (total: ${formatVolume(totalVolume)})`,
          true,
          data.slice(0, 5)
        );
      }
    }

    return createResult('volume', 0, '', false);
  } catch {
    return createResult('volume', 0, '', false);
  }
}

/**
 * Helper function to create detection results
 */
function createResult(
  dataType: DataType,
  confidence: number,
  summary: string,
  visualisable: boolean,
  sampleData?: any
): DetectionResult {
  return { dataType, confidence, summary, visualisable, sampleData };
}

/**
 * Check if object has numeric properties
 */
function hasNumericProperties(obj: any, props: string[]): boolean {
  return props.every(prop =>
    obj[prop] !== undefined &&
    (typeof obj[prop] === 'number' || !isNaN(parseFloat(obj[prop])))
  );
}

/**
 * Calculate timespan for kline data
 */
function getTimespan(data: any[]): string | null {
  try {
    if (data.length < 2) return null;

    const first = data[0];
    const last = data[data.length - 1];

    // Extract timestamps
    let firstTime, lastTime;
    if (Array.isArray(first)) {
      firstTime = first[0];
      lastTime = last[0];
    } else if (typeof first === 'object') {
      firstTime = first.timestamp || first.time || first.openTime;
      lastTime = last.timestamp || last.time || last.openTime;
    }

    if (firstTime && lastTime) {
      const diffHours = Math.abs(lastTime - firstTime) / (1000 * 60 * 60);
      if (diffHours < 24) return `${diffHours.toFixed(1)}h`;
      if (diffHours < 24 * 7) return `${(diffHours / 24).toFixed(1)}d`;
      return `${(diffHours / (24 * 7)).toFixed(1)}w`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate average RSI value
 */
function calculateAverageRSI(data: any[]): number {
  try {
    const values = data.map(item => {
      if (typeof item === 'number') return item;
      if (typeof item === 'object') return item.rsi || item.RSI;
      return 0;
    }).filter(val => val > 0);

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  } catch {
    return 0;
  }
}

/**
 * Get order block types summary
 */
function getOrderBlockTypes(data: any[]): string {
  try {
    const types = data.map(block => {
      if (block.bullish) return 'bullish';
      if (block.bearish) return 'bearish';
      if (block.type) return block.type;
      return 'unknown';
    });

    const bullish = types.filter(t => t === 'bullish').length;
    const bearish = types.filter(t => t === 'bearish').length;

    return `${bullish}B/${bearish}B`;
  } catch {
    return 'mixed';
  }
}

/**
 * Calculate total volume
 */
function calculateTotalVolume(data: any[]): number {
  try {
    return data.reduce((total, item) => {
      const volume = typeof item === 'number' ? item : (item.volume || 0);
      return total + volume;
    }, 0);
  } catch {
    return 0;
  }
}

/**
 * Format volume for display
 */
function formatVolume(volume: number): string {
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return volume.toFixed(0);
}
