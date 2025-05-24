/**
 * Volume analysis utilities for Order Block Detection
 * Based on the pinescript order-block-detector implementation
 */

import { KlineData } from './mathUtils.js'

export interface OrderBlock {
  id: string;
  timestamp: number;
  top: number;
  bottom: number;
  average: number;
  volume: number;
  mitigated: boolean;
  mitigationTime?: number;
  type: 'bullish' | 'bearish';
}

export interface VolumeAnalysisConfig {
  volumePivotLength: number;
  bullishBlocks: number;
  bearishBlocks: number;
  mitigationMethod: 'wick' | 'close';
}

/**
 * Detect volume pivots (peaks) in the data
 */
export function detectVolumePivots(klineData: KlineData[], pivotLength: number): number[] {
  const pivotIndices: number[] = []
  
  for (let i = pivotLength; i < klineData.length - pivotLength; i++) {
    const currentVolume = klineData[i].volume
    let isPivot = true
    
    // Check if current volume is higher than surrounding volumes
    for (let j = i - pivotLength; j <= i + pivotLength; j++) {
      if (j !== i && klineData[j].volume >= currentVolume) {
        isPivot = false
        break
      }
    }
    
    if (isPivot) {
      pivotIndices.push(i)
    }
  }
  
  return pivotIndices
}

/**
 * Determine market structure (uptrend/downtrend) at a given point
 */
export function getMarketStructure(klineData: KlineData[], index: number, lookback: number): 'uptrend' | 'downtrend' {
  const startIndex = Math.max(0, index - lookback)
  const slice = klineData.slice(startIndex, index + 1)
  
  if (slice.length < 2) return 'uptrend'
  
  const highs = slice.map(k => k.high)
  const lows = slice.map(k => k.low)
  
  const currentHigh = highs[highs.length - 1]
  const currentLow = lows[lows.length - 1]
  const previousHigh = Math.max(...highs.slice(0, -1))
  const previousLow = Math.min(...lows.slice(0, -1))
  
  // Simple trend detection based on higher highs/lower lows
  if (currentHigh > previousHigh && currentLow > previousLow) {
    return 'uptrend'
  } else if (currentHigh < previousHigh && currentLow < previousLow) {
    return 'downtrend'
  }
  
  // Default to uptrend if unclear
  return 'uptrend'
}

/**
 * Create order block from volume pivot
 */
export function createOrderBlock(
  klineData: KlineData[],
  pivotIndex: number,
  pivotLength: number,
  type: 'bullish' | 'bearish'
): OrderBlock {
  const kline = klineData[pivotIndex]
  const { high, low, close, volume, timestamp } = kline
  
  let top: number, bottom: number
  
  if (type === 'bullish') {
    // Bullish order block: from low to median (hl2)
    bottom = low
    top = (high + low) / 2
  } else {
    // Bearish order block: from median (hl2) to high
    bottom = (high + low) / 2
    top = high
  }
  
  const average = (top + bottom) / 2
  
  return {
    id: `${type}_${timestamp}_${pivotIndex}`,
    timestamp,
    top,
    bottom,
    average,
    volume,
    mitigated: false,
    type
  }
}

/**
 * Check if an order block has been mitigated
 */
export function checkMitigation(
  orderBlock: OrderBlock,
  klineData: KlineData[],
  currentIndex: number,
  method: 'wick' | 'close'
): boolean {
  if (orderBlock.mitigated) return true
  
  const currentKline = klineData[currentIndex]
  
  if (orderBlock.type === 'bullish') {
    // Bullish order block is mitigated when price goes below the bottom
    if (method === 'wick') {
      return currentKline.low < orderBlock.bottom
    } else {
      return currentKline.close < orderBlock.bottom
    }
  } else {
    // Bearish order block is mitigated when price goes above the top
    if (method === 'wick') {
      return currentKline.high > orderBlock.top
    } else {
      return currentKline.close > orderBlock.top
    }
  }
}

/**
 * Update order block mitigation status
 */
export function updateOrderBlockMitigation(
  orderBlocks: OrderBlock[],
  klineData: KlineData[],
  currentIndex: number,
  method: 'wick' | 'close'
): { mitigatedBullish: boolean; mitigatedBearish: boolean } {
  let mitigatedBullish = false
  let mitigatedBearish = false
  
  for (const block of orderBlocks) {
    if (!block.mitigated && checkMitigation(block, klineData, currentIndex, method)) {
      block.mitigated = true
      block.mitigationTime = klineData[currentIndex].timestamp
      
      if (block.type === 'bullish') {
        mitigatedBullish = true
      } else {
        mitigatedBearish = true
      }
    }
  }
  
  return { mitigatedBullish, mitigatedBearish }
}

/**
 * Remove mitigated order blocks from arrays
 */
export function removeMitigatedBlocks(orderBlocks: OrderBlock[]): OrderBlock[] {
  return orderBlocks.filter(block => !block.mitigated)
}

/**
 * Get active support and resistance levels from order blocks
 */
export function getActiveLevels(orderBlocks: OrderBlock[]): {
  support: number[];
  resistance: number[];
} {
  const activeBlocks = orderBlocks.filter(block => !block.mitigated)
  
  const support = activeBlocks
    .filter(block => block.type === 'bullish')
    .map(block => block.average)
    .sort((a, b) => b - a) // Descending order
  
  const resistance = activeBlocks
    .filter(block => block.type === 'bearish')
    .map(block => block.average)
    .sort((a, b) => a - b) // Ascending order
  
  return { support, resistance }
}

/**
 * Detect order blocks from kline data
 */
export function detectOrderBlocks(
  klineData: KlineData[],
  config: VolumeAnalysisConfig
): {
  bullishBlocks: OrderBlock[];
  bearishBlocks: OrderBlock[];
  volumePivots: number[];
} {
  const volumePivots = detectVolumePivots(klineData, config.volumePivotLength)
  const bullishBlocks: OrderBlock[] = []
  const bearishBlocks: OrderBlock[] = []
  
  for (const pivotIndex of volumePivots) {
    // Determine market structure at pivot point
    const marketStructure = getMarketStructure(klineData, pivotIndex, config.volumePivotLength)
    
    if (marketStructure === 'uptrend') {
      // In uptrend, create bullish order block
      const block = createOrderBlock(klineData, pivotIndex, config.volumePivotLength, 'bullish')
      bullishBlocks.push(block)
    } else {
      // In downtrend, create bearish order block
      const block = createOrderBlock(klineData, pivotIndex, config.volumePivotLength, 'bearish')
      bearishBlocks.push(block)
    }
  }
  
  // Process mitigation for all blocks
  for (let i = 0; i < klineData.length; i++) {
    updateOrderBlockMitigation([...bullishBlocks, ...bearishBlocks], klineData, i, config.mitigationMethod)
  }
  
  // Keep only the most recent unmitigated blocks
  const activeBullishBlocks = removeMitigatedBlocks(bullishBlocks)
    .slice(-config.bullishBlocks)
  
  const activeBearishBlocks = removeMitigatedBlocks(bearishBlocks)
    .slice(-config.bearishBlocks)
  
  return {
    bullishBlocks: activeBullishBlocks,
    bearishBlocks: activeBearishBlocks,
    volumePivots
  }
}

/**
 * Calculate order block statistics
 */
export function calculateOrderBlockStats(
  bullishBlocks: OrderBlock[],
  bearishBlocks: OrderBlock[]
): {
  totalBlocks: number;
  activeBullishBlocks: number;
  activeBearishBlocks: number;
  mitigatedBlocks: number;
  averageVolume: number;
} {
  const allBlocks = [...bullishBlocks, ...bearishBlocks]
  const activeBlocks = allBlocks.filter(block => !block.mitigated)
  const mitigatedBlocks = allBlocks.filter(block => block.mitigated)
  
  const activeBullishBlocks = bullishBlocks.filter(block => !block.mitigated).length
  const activeBearishBlocks = bearishBlocks.filter(block => !block.mitigated).length
  
  const averageVolume = allBlocks.length > 0
    ? allBlocks.reduce((sum, block) => sum + block.volume, 0) / allBlocks.length
    : 0
  
  return {
    totalBlocks: allBlocks.length,
    activeBullishBlocks,
    activeBearishBlocks,
    mitigatedBlocks: mitigatedBlocks.length,
    averageVolume
  }
}

/**
 * Find nearest order blocks to current price
 */
export function findNearestOrderBlocks(
  orderBlocks: OrderBlock[],
  currentPrice: number,
  maxDistance: number = 0.05 // 5% price distance
): OrderBlock[] {
  return orderBlocks
    .filter(block => !block.mitigated)
    .filter(block => {
      const distance = Math.abs(block.average - currentPrice) / currentPrice
      return distance <= maxDistance
    })
    .sort((a, b) => {
      const distanceA = Math.abs(a.average - currentPrice)
      const distanceB = Math.abs(b.average - currentPrice)
      return distanceA - distanceB
    })
}
