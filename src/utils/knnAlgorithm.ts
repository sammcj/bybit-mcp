/**
 * K-Nearest Neighbors algorithm implementation for ML-RSI
 * Based on the pinescript ML-RSI implementation
 */

import { euclideanDistance, normalize, FeatureVector, KlineData } from './mathUtils.js'

export interface KNNNeighbor {
  index: number;
  distance: number;
  rsiValue: number;
  weight: number;
}

export interface KNNResult {
  enhancedRsi: number;
  knnDivergence: number;
  effectiveNeighbors: number;
  adaptiveOverbought: number;
  adaptiveOversold: number;
  confidence: number;
}

export interface KNNConfig {
  neighbors: number;
  lookbackPeriod: number;
  mlWeight: number;
  featureCount: number;
}

/**
 * Normalize feature vector for comparison
 */
function normalizeFeatureVector(
  features: FeatureVector,
  allFeatures: FeatureVector[],
  lookbackPeriod: number
): number[] {
  const normalized: number[] = []
  
  // Extract all RSI values for normalization
  const rsiValues = allFeatures.map(f => f.rsi).filter(v => v !== undefined)
  const normalizedRsi = normalize(rsiValues, Math.min(lookbackPeriod, rsiValues.length))
  normalized.push(normalizedRsi[normalizedRsi.length - 1] || 0.5)
  
  if (features.momentum !== undefined) {
    const momentumValues = allFeatures.map(f => f.momentum).filter(v => v !== undefined) as number[]
    if (momentumValues.length > 0) {
      const normalizedMomentum = normalize(momentumValues, Math.min(lookbackPeriod, momentumValues.length))
      normalized.push(normalizedMomentum[normalizedMomentum.length - 1] || 0.5)
    }
  }
  
  if (features.volatility !== undefined) {
    const volatilityValues = allFeatures.map(f => f.volatility).filter(v => v !== undefined) as number[]
    if (volatilityValues.length > 0) {
      const normalizedVolatility = normalize(volatilityValues, Math.min(lookbackPeriod, volatilityValues.length))
      normalized.push(normalizedVolatility[normalizedVolatility.length - 1] || 0.5)
    }
  }
  
  if (features.slope !== undefined) {
    const slopeValues = allFeatures.map(f => f.slope).filter(v => v !== undefined) as number[]
    if (slopeValues.length > 0) {
      const normalizedSlope = normalize(slopeValues, Math.min(lookbackPeriod, slopeValues.length))
      normalized.push(normalizedSlope[normalizedSlope.length - 1] || 0.5)
    }
  }
  
  if (features.priceMomentum !== undefined) {
    const priceMomentumValues = allFeatures.map(f => f.priceMomentum).filter(v => v !== undefined) as number[]
    if (priceMomentumValues.length > 0) {
      const normalizedPriceMomentum = normalize(priceMomentumValues, Math.min(lookbackPeriod, priceMomentumValues.length))
      normalized.push(normalizedPriceMomentum[normalizedPriceMomentum.length - 1] || 0.5)
    }
  }
  
  return normalized
}

/**
 * Find K nearest neighbors using feature similarity
 */
export function findKNearestNeighbors(
  currentFeatures: FeatureVector,
  historicalFeatures: FeatureVector[],
  rsiValues: number[],
  config: KNNConfig
): KNNNeighbor[] {
  if (historicalFeatures.length === 0 || rsiValues.length === 0) {
    return []
  }
  
  const distances: { index: number; distance: number; rsiValue: number }[] = []
  
  // Normalize current features
  const currentNormalized = normalizeFeatureVector(currentFeatures, historicalFeatures, config.lookbackPeriod)
  
  // Calculate distances to all historical points
  for (let i = 0; i < Math.min(historicalFeatures.length, config.lookbackPeriod); i++) {
    const historicalNormalized = normalizeFeatureVector(historicalFeatures[i], historicalFeatures, config.lookbackPeriod)
    
    if (currentNormalized.length === historicalNormalized.length) {
      const distance = euclideanDistance(currentNormalized, historicalNormalized)
      const rsiValue = rsiValues[i]
      
      if (!isNaN(distance) && !isNaN(rsiValue)) {
        distances.push({ index: i, distance, rsiValue })
      }
    }
  }
  
  // Sort by distance (closest first)
  distances.sort((a, b) => a.distance - b.distance)
  
  // Take K nearest neighbors
  const kNearest = distances.slice(0, Math.min(config.neighbors, distances.length))
  
  // Calculate weights (inverse distance weighting)
  const neighbors: KNNNeighbor[] = kNearest.map(neighbor => {
    const weight = neighbor.distance < 0.0001 ? 1.0 : 1.0 / neighbor.distance
    return {
      index: neighbor.index,
      distance: neighbor.distance,
      rsiValue: neighbor.rsiValue,
      weight
    }
  })
  
  return neighbors
}

/**
 * Calculate adaptive thresholds based on historical RSI distribution
 */
function calculateAdaptiveThresholds(
  neighbors: KNNNeighbor[],
  klineData: KlineData[],
  defaultOverbought: number = 70,
  defaultOversold: number = 30
): { overbought: number; oversold: number } {
  if (neighbors.length === 0) {
    return { overbought: defaultOverbought, oversold: defaultOversold }
  }
  
  const overboughtCandidates: number[] = []
  const oversoldCandidates: number[] = []
  
  // Analyze future returns for each neighbor to identify extreme zones
  for (const neighbor of neighbors) {
    const futureIndex = neighbor.index + 5 // Look 5 periods ahead
    if (futureIndex < klineData.length) {
      const currentPrice = klineData[neighbor.index].close
      const futurePrice = klineData[futureIndex].close
      const futureReturn = (futurePrice - currentPrice) / currentPrice
      
      // If significant positive return followed, this RSI level might be oversold
      if (futureReturn > 0.02) { // 2% positive return
        oversoldCandidates.push(neighbor.rsiValue)
      }
      
      // If significant negative return followed, this RSI level might be overbought
      if (futureReturn < -0.02) { // 2% negative return
        overboughtCandidates.push(neighbor.rsiValue)
      }
    }
  }
  
  // Calculate adaptive thresholds
  const overbought = overboughtCandidates.length > 0 
    ? overboughtCandidates.reduce((sum, val) => sum + val, 0) / overboughtCandidates.length
    : defaultOverbought
    
  const oversold = oversoldCandidates.length > 0
    ? oversoldCandidates.reduce((sum, val) => sum + val, 0) / oversoldCandidates.length
    : defaultOversold
  
  return { 
    overbought: Math.max(overbought, 60), // Ensure reasonable bounds
    oversold: Math.min(oversold, 40)
  }
}

/**
 * Apply KNN algorithm to enhance RSI
 */
export function applyKNNToRSI(
  currentRsi: number,
  currentFeatures: FeatureVector,
  historicalFeatures: FeatureVector[],
  rsiValues: number[],
  klineData: KlineData[],
  config: KNNConfig
): KNNResult {
  // Find nearest neighbors
  const neighbors = findKNearestNeighbors(currentFeatures, historicalFeatures, rsiValues, config)
  
  if (neighbors.length === 0) {
    return {
      enhancedRsi: currentRsi,
      knnDivergence: 0,
      effectiveNeighbors: 0,
      adaptiveOverbought: 70,
      adaptiveOversold: 30,
      confidence: 0
    }
  }
  
  // Calculate weighted average RSI from neighbors
  const totalWeight = neighbors.reduce((sum, neighbor) => sum + neighbor.weight, 0)
  const weightedRsi = neighbors.reduce((sum, neighbor) => {
    return sum + (neighbor.rsiValue * neighbor.weight)
  }, 0) / totalWeight
  
  // Blend traditional RSI with ML-enhanced RSI
  const enhancedRsi = Math.max(0, Math.min(100, 
    (1 - config.mlWeight) * currentRsi + config.mlWeight * weightedRsi
  ))
  
  // Calculate divergence (how different current RSI is from similar historical patterns)
  const avgDistance = neighbors.reduce((sum, neighbor) => sum + neighbor.distance, 0) / neighbors.length
  const knnDivergence = avgDistance * 100 // Scale for readability
  
  // Calculate adaptive thresholds
  const { overbought, oversold } = calculateAdaptiveThresholds(neighbors, klineData)
  
  // Calculate confidence based on neighbor similarity and count
  const maxDistance = Math.max(...neighbors.map(n => n.distance))
  const avgSimilarity = maxDistance > 0 ? 1 - (avgDistance / maxDistance) : 1
  const countFactor = Math.min(neighbors.length / config.neighbors, 1)
  const confidence = avgSimilarity * countFactor * 100
  
  return {
    enhancedRsi,
    knnDivergence,
    effectiveNeighbors: neighbors.length,
    adaptiveOverbought: overbought,
    adaptiveOversold: oversold,
    confidence
  }
}

/**
 * Batch process multiple RSI values with KNN enhancement
 */
export function batchProcessKNN(
  rsiValues: number[],
  allFeatures: FeatureVector[],
  klineData: KlineData[],
  config: KNNConfig
): KNNResult[] {
  const results: KNNResult[] = []
  
  for (let i = config.lookbackPeriod; i < rsiValues.length; i++) {
    const currentRsi = rsiValues[i]
    const currentFeatures = allFeatures[i]
    
    if (currentFeatures) {
      // Use historical features up to current point
      const historicalFeatures = allFeatures.slice(Math.max(0, i - config.lookbackPeriod), i)
      const historicalRsi = rsiValues.slice(Math.max(0, i - config.lookbackPeriod), i)
      
      const result = applyKNNToRSI(
        currentRsi,
        currentFeatures,
        historicalFeatures,
        historicalRsi,
        klineData,
        config
      )
      
      results.push(result)
    } else {
      // Fallback for missing features
      results.push({
        enhancedRsi: currentRsi,
        knnDivergence: 0,
        effectiveNeighbors: 0,
        adaptiveOverbought: 70,
        adaptiveOversold: 30,
        confidence: 0
      })
    }
  }
  
  return results
}
