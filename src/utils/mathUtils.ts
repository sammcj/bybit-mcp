/**
 * Mathematical utility functions for technical analysis
 * Inspired by pinescript mathematical operations
 */

export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (prices.length < period + 1) {
    return []
  }

  const rsiValues: number[] = []
  const gains: number[] = []
  const losses: number[] = []

  // Calculate initial gains and losses
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period

  // Calculate first RSI value
  const rs = avgGain / (avgLoss || 0.0001) // Avoid division by zero
  rsiValues.push(100 - (100 / (1 + rs)))

  // Calculate subsequent RSI values using smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    
    const rs = avgGain / (avgLoss || 0.0001)
    rsiValues.push(100 - (100 / (1 + rs)))
  }

  return rsiValues
}

/**
 * Calculate momentum (rate of change)
 */
export function calculateMomentum(values: number[], period: number = 1): number[] {
  const momentum: number[] = []
  
  for (let i = period; i < values.length; i++) {
    momentum.push(values[i] - values[i - period])
  }
  
  return momentum
}

/**
 * Calculate volatility using standard deviation
 */
export function calculateVolatility(values: number[], period: number = 10): number[] {
  const volatility: number[] = []
  
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const mean = slice.reduce((sum, val) => sum + val, 0) / slice.length
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / slice.length
    volatility.push(Math.sqrt(variance))
  }
  
  return volatility
}

/**
 * Calculate linear regression slope
 */
export function calculateSlope(values: number[], period: number = 5): number[] {
  const slopes: number[] = []
  
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const n = slice.length
    const x = Array.from({ length: n }, (_, idx) => idx)
    
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = slice.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, idx) => sum + val * slice[idx], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    slopes.push(slope)
  }
  
  return slopes
}

/**
 * Min-max normalisation
 */
export function normalize(values: number[], period: number): number[] {
  const normalized: number[] = []
  
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const min = Math.min(...slice)
    const max = Math.max(...slice)
    const range = max - min
    
    if (range === 0) {
      normalized.push(0.5) // Middle value when no variation
    } else {
      normalized.push((values[i] - min) / range)
    }
  }
  
  return normalized
}

/**
 * Calculate Euclidean distance between two feature vectors
 */
export function euclideanDistance(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error("Vectors must have the same length")
  }
  
  const sumSquares = vector1.reduce((sum, val, idx) => {
    return sum + Math.pow(val - vector2[idx], 2)
  }, 0)
  
  return Math.sqrt(sumSquares)
}

/**
 * Simple Moving Average
 */
export function sma(values: number[], period: number): number[] {
  const smaValues: number[] = []
  
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const average = slice.reduce((sum, val) => sum + val, 0) / slice.length
    smaValues.push(average)
  }
  
  return smaValues
}

/**
 * Exponential Moving Average
 */
export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return []
  
  const emaValues: number[] = []
  const multiplier = 2 / (period + 1)
  
  // First EMA value is the first price
  emaValues.push(values[0])
  
  for (let i = 1; i < values.length; i++) {
    const emaValue = (values[i] * multiplier) + (emaValues[i - 1] * (1 - multiplier))
    emaValues.push(emaValue)
  }
  
  return emaValues
}

/**
 * Kalman Filter implementation for smoothing
 */
export function kalmanFilter(values: number[], processNoise: number = 0.01, measurementNoise: number = 0.1): number[] {
  if (values.length === 0) return []
  
  const filtered: number[] = []
  let estimate = values[0]
  let errorEstimate = 1.0
  
  filtered.push(estimate)
  
  for (let i = 1; i < values.length; i++) {
    // Prediction step
    const predictedEstimate = estimate
    const predictedError = errorEstimate + processNoise
    
    // Update step
    const kalmanGain = predictedError / (predictedError + measurementNoise)
    estimate = predictedEstimate + kalmanGain * (values[i] - predictedEstimate)
    errorEstimate = (1 - kalmanGain) * predictedError
    
    filtered.push(estimate)
  }
  
  return filtered
}

/**
 * ALMA (Arnaud Legoux Moving Average) implementation
 */
export function alma(values: number[], period: number, offset: number = 0.85, sigma: number = 6): number[] {
  if (values.length < period) return []
  
  const almaValues: number[] = []
  const m = Math.floor(offset * (period - 1))
  const s = period / sigma
  
  for (let i = period - 1; i < values.length; i++) {
    let weightedSum = 0
    let weightSum = 0
    
    for (let j = 0; j < period; j++) {
      const weight = Math.exp(-Math.pow(j - m, 2) / (2 * Math.pow(s, 2)))
      weightedSum += values[i - period + 1 + j] * weight
      weightSum += weight
    }
    
    almaValues.push(weightedSum / weightSum)
  }
  
  return almaValues
}

/**
 * Double EMA implementation
 */
export function doubleEma(values: number[], period: number): number[] {
  const firstEma = ema(values, period)
  const secondEma = ema(firstEma, period)
  
  return firstEma.map((val, idx) => {
    if (idx < secondEma.length) {
      return 2 * val - secondEma[idx]
    }
    return val
  }).slice(period - 1) // Remove initial values that don't have corresponding second EMA
}

/**
 * Extract features for KNN analysis
 */
export interface FeatureVector {
  rsi: number;
  momentum?: number;
  volatility?: number;
  slope?: number;
  priceMomentum?: number;
}

export function extractFeatures(
  klineData: KlineData[],
  index: number,
  rsiValues: number[],
  featureCount: number,
  lookbackPeriod: number
): FeatureVector | null {
  if (index < lookbackPeriod || index >= rsiValues.length) {
    return null
  }
  
  const features: FeatureVector = {
    rsi: rsiValues[index]
  }
  
  if (featureCount >= 2) {
    const rsiMomentum = calculateMomentum(rsiValues.slice(0, index + 1), 3)
    if (rsiMomentum.length > 0) {
      features.momentum = rsiMomentum[rsiMomentum.length - 1]
    }
  }
  
  if (featureCount >= 3) {
    const rsiVolatility = calculateVolatility(rsiValues.slice(0, index + 1), 10)
    if (rsiVolatility.length > 0) {
      features.volatility = rsiVolatility[rsiVolatility.length - 1]
    }
  }
  
  if (featureCount >= 4) {
    const rsiSlope = calculateSlope(rsiValues.slice(0, index + 1), 5)
    if (rsiSlope.length > 0) {
      features.slope = rsiSlope[rsiSlope.length - 1]
    }
  }
  
  if (featureCount >= 5) {
    const closePrices = klineData.slice(0, index + 1).map(k => k.close)
    const priceMomentum = calculateMomentum(closePrices, 5)
    if (priceMomentum.length > 0) {
      features.priceMomentum = priceMomentum[priceMomentum.length - 1]
    }
  }
  
  return features
}
