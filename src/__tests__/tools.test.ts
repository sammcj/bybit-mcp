import { jest, describe, beforeEach, it, expect } from '@jest/globals'
import GetTicker from '../tools/GetTicker.js'
import GetOrderbook from '../tools/GetOrderbook.js'
import GetPositions from '../tools/GetPositions.js'
import GetWalletBalance from '../tools/GetWalletBalance.js'
import GetInstrumentInfo from '../tools/GetInstrumentInfo.js'
import GetKline from '../tools/GetKline.js'
import GetOrderHistory from '../tools/GetOrderHistory.js'
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { RestClientV5 } from "bybit-api"

type ToolCallRequest = z.infer<typeof CallToolRequestSchema>

// Create mock client methods
const mockClient = {
  getTickers: jest.fn(),
  getOrderbook: jest.fn(),
  getPositionInfo: jest.fn(),
  getWalletBalance: jest.fn(),
  getInstrumentsInfo: jest.fn(),
  getKline: jest.fn(),
  getHistoricOrders: jest.fn(),
} as any

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
    retCode: 10001, // Parameter error - won't trigger retries
    retMsg: 'Parameter error',
    result: null,
    time: Date.now(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GetTicker', () => {
    let getTicker: GetTicker

    beforeEach(() => {
      getTicker = new GetTicker(mockClient)
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

      const mockTickerResponse = {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: [{
            symbol: 'BTCUSDT',
            lastPrice: '50000.00',
            price24hPcnt: '0.0250',
            highPrice24h: '51000.00',
            lowPrice24h: '49000.00',
            prevPrice24h: '48800.00',
            volume24h: '1000.50',
            turnover24h: '50000000.00',
            bid1Price: '49999.50',
            bid1Size: '0.1',
            ask1Price: '50000.50',
            ask1Size: '0.1'
          }]
        },
        time: Date.now(),
      };

      (mockClient.getTickers as jest.Mock).mockResolvedValueOnce(mockTickerResponse)

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

      // Mock the error response for all retry attempts to avoid infinite retry loop
      (mockClient.getTickers as jest.Mock).mockResolvedValue(mockErrorResponse)

      const result = await getTicker.toolCall(request)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBe(true)
      const errorData = JSON.parse(result.content[0].text as string)
      expect(errorData.category).toBe('VALIDATION')
      expect(errorData.message).toContain('Parameter error')
    })
  })

  describe('GetOrderbook', () => {
    let getOrderbook: GetOrderbook

    beforeEach(() => {
      getOrderbook = new GetOrderbook(mockClient)
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

      const mockOrderbookResponse = {
        retCode: 0,
        retMsg: 'OK',
        result: {
          s: 'BTCUSDT',
          b: [['49999.50', '0.1'], ['49999.00', '0.2']],
          a: [['50000.50', '0.1'], ['50001.00', '0.2']],
          ts: Date.now(),
          u: 12345
        },
        time: Date.now(),
      };

      (mockClient.getOrderbook as jest.Mock).mockResolvedValueOnce(mockOrderbookResponse)

      const result = await getOrderbook.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetPositions', () => {
    let getPositions: GetPositions

    beforeEach(() => {
      getPositions = new GetPositions(mockClient)
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

      (mockClient.getPositionInfo as jest.Mock).mockResolvedValueOnce(mockSuccessResponse)

      const result = await getPositions.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetWalletBalance', () => {
    let getWalletBalance: GetWalletBalance

    beforeEach(() => {
      getWalletBalance = new GetWalletBalance(mockClient)
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
      expect(errorData.category).toBe('AUTHENTICATION') // Auth check happens before validation
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

      (mockClient.getWalletBalance as jest.Mock).mockResolvedValueOnce(mockSuccessResponse)

      const result = await getWalletBalance.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('Rate Limiting', () => {
    let getTicker: GetTicker

    beforeEach(() => {
      getTicker = new GetTicker(mockClient)
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

      // Mock successful responses for all requests
      const mockTickerResponse = {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: [{
            symbol: 'BTCUSDT',
            lastPrice: '50000.00',
            price24hPcnt: '0.0250',
            highPrice24h: '51000.00',
            lowPrice24h: '49000.00',
            prevPrice24h: '48800.00',
            volume24h: '1000.50',
            turnover24h: '50000000.00',
            bid1Price: '49999.50',
            bid1Size: '0.1',
            ask1Price: '50000.50',
            ask1Size: '0.1'
          }]
        },
        time: Date.now(),
      };

      (mockClient.getTickers as jest.Mock).mockResolvedValue(mockTickerResponse)

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
      getInstrumentInfo = new GetInstrumentInfo(mockClient)
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

      (mockClient.getInstrumentsInfo as jest.Mock).mockResolvedValueOnce(mockSuccessResponse)

      const result = await getInstrumentInfo.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetKline', () => {
    let getKline: GetKline

    beforeEach(() => {
      getKline = new GetKline(mockClient)
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

      (mockClient.getKline as jest.Mock).mockResolvedValueOnce(mockSuccessResponse)

      const result = await getKline.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('GetOrderHistory', () => {
    let getOrderHistory: GetOrderHistory

    beforeEach(() => {
      getOrderHistory = new GetOrderHistory(mockClient)
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

      (mockClient.getHistoricOrders as jest.Mock).mockResolvedValueOnce(mockSuccessResponse)

      const result = await getOrderHistory.toolCall(request)
      expect(result.content[0].type).toBe('text')
    })
  })

})
