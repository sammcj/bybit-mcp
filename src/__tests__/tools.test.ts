import { jest, describe, beforeEach, it, expect } from '@jest/globals'
import GetTicker from '../tools/GetTicker.js'
import GetOrderbook from '../tools/GetOrderbook.js'
import GetPositions from '../tools/GetPositions.js'
import GetWalletBalance from '../tools/GetWalletBalance.js'
import GetInstrumentInfo from '../tools/GetInstrumentInfo.js'
import GetKline from '../tools/GetKline.js'
import GetMarketInfo from '../tools/GetMarketInfo.js'
import GetOrderHistory from '../tools/GetOrderHistory.js'
import GetTrades from '../tools/GetTrades.js'
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"

type ToolCallRequest = z.infer<typeof CallToolRequestSchema>

// Mock the Bybit API client
jest.mock('bybit-api', () => ({
  RestClientV5: jest.fn().mockImplementation(() => ({
    getTickers: jest.fn(),
    getOrderbook: jest.fn(),
    getPositions: jest.fn(),
    getWalletBalance: jest.fn(),
    getInstruments: jest.fn(),
    getKline: jest.fn(),
    getMarkets: jest.fn(),
    getHistoricOrders: jest.fn(),
    getTrades: jest.fn(),
  })),
  APIResponseV3WithTime: jest.fn(),
}))

// Mock crypto.randomUUID with a properly formatted UUID
const mockRandomUUID = jest.fn(() => '123e4567-e89b-12d3-a456-426614174000')
global.crypto = {
  ...global.crypto,
  randomUUID: mockRandomUUID,
} as Crypto

describe('Bybit MCP Tools', () => {
  const mockSuccessResponse = {
    retCode: 0,
    retMsg: 'OK',
    result: {
      list: [],
    },
    time: Date.now(),
  }

  const mockErrorResponse = {
    retCode: 10002,
    retMsg: 'Rate limit exceeded',
    result: null,
    time: Date.now(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GetTicker', () => {
    let getTicker: GetTicker

    beforeEach(() => {
      getTicker = new GetTicker()
    })

    it('should validate input parameters', async () => {
      const invalidRequest: ToolCallRequest = {
        params: {
          name: 'get_ticker',
          arguments: {
            symbol: '123!@#', // Invalid symbol
          },
        },
        method: 'tools/call' as const,
      }

      const result = await getTicker.toolCall(invalidRequest)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBe(true)
      const errorData = JSON.parse(result.content[0].text as string)
      expect(errorData.category).toBe('VALIDATION')
      expect(errorData.message).toContain('Invalid input')
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_ticker',
          arguments: {
            symbol: 'BTCUSDT',
            category: 'spot',
          },
        },
        method: 'tools/call' as const,
      };

      (getTicker as any).client.getTickers.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getTicker.toolCall(request)
      expect(result.content[0].type).toBe('text')
      expect(JSON.parse(result.content[0].text as string)).toHaveProperty('symbol', 'BTCUSDT')
    })

    it('should handle API errors', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_ticker',
          arguments: {
            symbol: 'BTCUSDT',
          },
        },
        method: 'tools/call' as const,
      };

      (getTicker as any).client.getTickers.mockResolvedValueOnce(mockErrorResponse)

      const result = await getTicker.toolCall(request)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBe(true)
      const errorData = JSON.parse(result.content[0].text as string)
      expect(errorData.category).toBe('RATE_LIMIT')
      expect(errorData.message).toContain('Rate limit exceeded')
    })
  })

  describe('GetOrderbook', () => {
    let getOrderbook: GetOrderbook

    beforeEach(() => {
      getOrderbook = new GetOrderbook()
    })

    it('should validate input parameters', async () => {
      const invalidRequest: ToolCallRequest = {
        params: {
          name: 'get_orderbook',
          arguments: {
            symbol: '', // Empty symbol
          },
        },
        method: 'tools/call' as const,
      }

      const result = await getOrderbook.toolCall(invalidRequest)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBe(true)
      const errorData = JSON.parse(result.content[0].text as string)
      expect(errorData.category).toBe('VALIDATION')
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_orderbook',
          arguments: {
            symbol: 'BTCUSDT',
            category: 'spot',
          },
        },
        method: 'tools/call' as const,
      };

      (getOrderbook as any).client.getOrderbook.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getOrderbook.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetPositions', () => {
    let getPositions: GetPositions

    beforeEach(() => {
      getPositions = new GetPositions()
    })

    it('should validate input parameters', async () => {
      const invalidRequest: ToolCallRequest = {
        params: {
          name: 'get_positions',
          arguments: {
            category: 'invalid', // Invalid category
          },
        },
        method: 'tools/call' as const,
      }

      const result = await getPositions.toolCall(invalidRequest)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBe(true)
      const errorData = JSON.parse(result.content[0].text as string)
      expect(errorData.category).toBe('VALIDATION')
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_positions',
          arguments: {
            category: 'linear',
          },
        },
        method: 'tools/call' as const,
      };

      (getPositions as any).client.getPositions.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getPositions.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetWalletBalance', () => {
    let getWalletBalance: GetWalletBalance

    beforeEach(() => {
      getWalletBalance = new GetWalletBalance()
    })

    it('should validate input parameters', async () => {
      const invalidRequest: ToolCallRequest = {
        params: {
          name: 'get_wallet_balance',
          arguments: {
            accountType: 'invalid', // Invalid account type
          },
        },
        method: 'tools/call' as const,
      }

      const result = await getWalletBalance.toolCall(invalidRequest)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBe(true)
      const errorData = JSON.parse(result.content[0].text as string)
      expect(errorData.category).toBe('VALIDATION')
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_wallet_balance',
          arguments: {
            accountType: 'UNIFIED',
          },
        },
        method: 'tools/call' as const,
      };

      (getWalletBalance as any).client.getWalletBalance.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getWalletBalance.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('Rate Limiting', () => {
    let getTicker: GetTicker

    beforeEach(() => {
      getTicker = new GetTicker()
    })

    it('should handle rate limiting', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_ticker',
          arguments: {
            symbol: 'BTCUSDT',
          },
        },
        method: 'tools/call' as const,
      }

      // Mock multiple rapid requests
      const promises = Array(15).fill(null).map(() => getTicker.toolCall(request))
      const results = await Promise.all(promises)

      // Verify that some requests were rate limited or successful
      const errors = results.filter(r => r.isError === true)
      const successes = results.filter(r => r.isError !== true)
      // At least some should succeed, and rate limiting should be handled gracefully
      expect(successes.length).toBeGreaterThan(0)
    })
  })

  // Add similar test blocks for remaining tools
  describe('GetInstrumentInfo', () => {
    let getInstrumentInfo: GetInstrumentInfo

    beforeEach(() => {
      getInstrumentInfo = new GetInstrumentInfo()
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_instrument_info',
          arguments: {
            category: 'spot',
            symbol: 'BTCUSDT',
          },
        },
        method: 'tools/call' as const,
      };

      (getInstrumentInfo as any).client.getInstruments.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getInstrumentInfo.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetKline', () => {
    let getKline: GetKline

    beforeEach(() => {
      getKline = new GetKline()
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_kline',
          arguments: {
            category: 'spot',
            symbol: 'BTCUSDT',
            interval: '1',
          },
        },
        method: 'tools/call' as const,
      };

      (getKline as any).client.getKline.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getKline.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetMarketInfo', () => {
    let getMarketInfo: GetMarketInfo

    beforeEach(() => {
      getMarketInfo = new GetMarketInfo()
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_market_info',
          arguments: {
            category: 'spot',
          },
        },
        method: 'tools/call' as const,
      };

      (getMarketInfo as any).client.getMarkets.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getMarketInfo.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetOrderHistory', () => {
    let getOrderHistory: GetOrderHistory

    beforeEach(() => {
      getOrderHistory = new GetOrderHistory()
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_order_history',
          arguments: {
            category: 'spot',
          },
        },
        method: 'tools/call' as const,
      };

      (getOrderHistory as any).client.getHistoricOrders.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getOrderHistory.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetTrades', () => {
    let getTrades: GetTrades

    beforeEach(() => {
      getTrades = new GetTrades()
    })

    it('should handle successful API response', async () => {
      const request: ToolCallRequest = {
        params: {
          name: 'get_trades',
          arguments: {
            category: 'spot',
            symbol: 'BTCUSDT',
          },
        },
        method: 'tools/call' as const,
      };

      (getTrades as any).client.getTrades.mockResolvedValueOnce(mockSuccessResponse)

      const result = await getTrades.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })
})
