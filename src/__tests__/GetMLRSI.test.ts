import { jest, describe, beforeEach, it, expect } from '@jest/globals'
import GetMLRSI from '../tools/GetMLRSI.js'
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { RestClientV5 } from "bybit-api"

type ToolCallRequest = z.infer<typeof CallToolRequestSchema>

// Create mock client methods
const mockClient = {
  getKline: jest.fn(),
} as any

describe('GetMLRSI Tool', () => {
  let getMLRSI: GetMLRSI

  beforeEach(() => {
    jest.clearAllMocks()
    getMLRSI = new GetMLRSI(mockClient)
  })

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(getMLRSI.name).toBe('get_ml_rsi')
    })

    it('should have proper tool definition structure', () => {
      const toolDef = getMLRSI.toolDefinition
      expect(toolDef.name).toBe('get_ml_rsi')
      expect(toolDef.description).toContain('ML-enhanced RSI')
      expect(toolDef.description).toContain('K-Nearest Neighbors')
      expect(toolDef.inputSchema.type).toBe('object')
      expect(toolDef.inputSchema.required).toEqual(['symbol', 'category', 'interval'])
    })

    it('should have all required input parameters', () => {
      const properties = getMLRSI.toolDefinition.inputSchema.properties
      expect(properties).toHaveProperty('symbol')
      expect(properties).toHaveProperty('category')
      expect(properties).toHaveProperty('interval')
      expect(properties).toHaveProperty('rsiLength')
      expect(properties).toHaveProperty('knnNeighbors')
      expect(properties).toHaveProperty('knnLookback')
      expect(properties).toHaveProperty('mlWeight')
      expect(properties).toHaveProperty('featureCount')
      expect(properties).toHaveProperty('smoothingMethod')
      expect(properties).toHaveProperty('limit')
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid symbol format', async () => {
      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "btc-usdt", // Invalid format
            category: "spot",
            interval: "15"
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid input')
    })

    it('should reject invalid category', async () => {
      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "invalid", // Invalid category
            interval: "15"
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid input')
    })

    it('should reject invalid RSI length', async () => {
      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "spot",
            interval: "15",
            rsiLength: 1 // Too small
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid input')
    })

    it('should reject invalid ML weight', async () => {
      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "spot",
            interval: "15",
            mlWeight: 1.5 // Too large
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid input')
    })

    it('should accept valid parameters with defaults', async () => {
      // Mock successful API response
      const mockKlineResponse = {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: Array.from({ length: 200 }, (_, i) => [
            String(Date.now() + i * 900000), // timestamp
            "50000", // open
            "50100", // high
            "49900", // low
            "50050", // close
            "1000"   // volume
          ])
        },
        time: Date.now(),
      };

      (mockClient.getKline as jest.Mock).mockResolvedValueOnce(mockKlineResponse)

      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "spot",
            interval: "15"
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).not.toBe(true)
      expect(mockClient.getKline).toHaveBeenCalled()
    })
  })

  describe('Feature Configuration', () => {
    it('should handle different feature counts', async () => {
      // Mock successful API response
      const mockKlineResponse = {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: Array.from({ length: 200 }, (_, i) => [
            String(Date.now() + i * 900000),
            "50000", "50100", "49900", "50050", "1000"
          ])
        },
        time: Date.now(),
      };

      (mockClient.getKline as jest.Mock).mockResolvedValueOnce(mockKlineResponse)

      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "spot",
            interval: "15",
            featureCount: 5 // Maximum features
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).not.toBe(true)

      const response = JSON.parse(result.content[0].text as string)
      expect(response.metadata.featuresUsed).toEqual([
        "rsi", "momentum", "volatility", "slope", "price_momentum"
      ])
    })

    it('should handle different smoothing methods', async () => {
      // Mock successful API response
      const mockKlineResponse = {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: Array.from({ length: 200 }, (_, i) => [
            String(Date.now() + i * 900000),
            "50000", "50100", "49900", "50050", "1000"
          ])
        },
        time: Date.now(),
      };

      (mockClient.getKline as jest.Mock).mockResolvedValueOnce(mockKlineResponse)

      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "spot",
            interval: "15",
            smoothingMethod: "kalman"
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).not.toBe(true)

      const response = JSON.parse(result.content[0].text as string)
      expect(response.metadata.smoothingApplied).toBe("kalman")
    })
  })

  describe('Error Handling', () => {
    it('should handle insufficient data error', async () => {
      // Mock API response with insufficient data
      const mockKlineResponse = {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: Array.from({ length: 50 }, (_, i) => [
            String(Date.now() + i * 900000),
            "50000", "50100", "49900", "50050", "1000"
          ])
        },
        time: Date.now(),
      };

      (mockClient.getKline as jest.Mock).mockResolvedValueOnce(mockKlineResponse)

      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "spot",
            interval: "15"
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Insufficient data')
    })

    it('should handle API errors gracefully', async () => {
      // Mock API error - use non-retryable error code
      const mockErrorResponse = {
        retCode: 10001,
        retMsg: 'Parameter error',
        result: null,
        time: Date.now(),
      };

      (mockClient.getKline as jest.Mock).mockResolvedValue(mockErrorResponse)

      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "spot",
            interval: "15"
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).toBe(true)
    })
  })

  describe('Response Format', () => {
    it('should return properly formatted ML-RSI response', async () => {
      // Mock successful API response
      const mockKlineResponse = {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: Array.from({ length: 200 }, (_, i) => [
            String(Date.now() + i * 900000),
            "50000", "50100", "49900", "50050", "1000"
          ])
        },
        time: Date.now(),
      };

      (mockClient.getKline as jest.Mock).mockResolvedValueOnce(mockKlineResponse)

      const request: ToolCallRequest = {
        method: "tools/call",
        params: {
          name: "get_ml_rsi",
          arguments: {
            symbol: "BTCUSDT",
            category: "spot",
            interval: "15"
          }
        }
      }

      const result = await getMLRSI.toolCall(request)
      expect(result.isError).not.toBe(true)

      const response = JSON.parse(result.content[0].text as string)

      // Check response structure
      expect(response).toHaveProperty('symbol', 'BTCUSDT')
      expect(response).toHaveProperty('interval', '15')
      expect(response).toHaveProperty('data')
      expect(response).toHaveProperty('metadata')

      // Check metadata
      expect(response.metadata).toHaveProperty('mlEnabled', true)
      expect(response.metadata).toHaveProperty('featuresUsed')
      expect(response.metadata).toHaveProperty('smoothingApplied')
      expect(response.metadata).toHaveProperty('calculationTime')
      expect(response.metadata).toHaveProperty('rsiLength')
      expect(response.metadata).toHaveProperty('knnConfig')

      // Check data points structure
      if (response.data.length > 0) {
        const dataPoint = response.data[0]
        expect(dataPoint).toHaveProperty('timestamp')
        expect(dataPoint).toHaveProperty('standardRsi')
        expect(dataPoint).toHaveProperty('mlRsi')
        expect(dataPoint).toHaveProperty('adaptiveOverbought')
        expect(dataPoint).toHaveProperty('adaptiveOversold')
        expect(dataPoint).toHaveProperty('knnDivergence')
        expect(dataPoint).toHaveProperty('effectiveNeighbors')
        expect(dataPoint).toHaveProperty('trend')
        expect(dataPoint).toHaveProperty('confidence')
      }
    })
  })
})
