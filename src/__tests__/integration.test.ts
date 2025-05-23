import { describe, beforeAll, it, expect } from '@jest/globals'
import { config } from 'dotenv'
import { join } from 'path'
import { existsSync } from 'fs'
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

// Load environment variables
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  config({ path: envPath })
}

// Check if we're in development mode (no API credentials)
const isDevMode = !process.env.BYBIT_API_KEY || !process.env.BYBIT_API_SECRET
const useTestnet = process.env.BYBIT_USE_TESTNET === "true"

if (isDevMode) {
  console.warn('Running in development mode with limited functionality')
}

describe('Bybit API Integration Tests', () => {
  // Common test symbols
  const testSymbols = {
    spot: 'BTCUSDT',
    linear: 'BTCUSDT',
    inverse: 'BTCUSD'
  }

  beforeAll(() => {
    if (isDevMode) {
      console.warn('Running integration tests in development mode (testnet)')
    } else {
      console.info(`Running integration tests against ${useTestnet ? 'testnet' : 'mainnet'}`)
    }
  })

  describe('Market Data Endpoints', () => {
    describe('GetTicker', () => {
      it('should fetch ticker data for spot market', async () => {
        const getTicker = new GetTicker()
        const request: ToolCallRequest = {
          params: {
            name: 'get_ticker',
            arguments: {
              category: 'spot',
              symbol: testSymbols.spot
            }
          },
          method: 'tools/call' as const
        }

        const result = await getTicker.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(data).toHaveProperty('symbol', testSymbols.spot)
        expect(data).toHaveProperty('lastPrice')
      })
    })

    describe('GetOrderbook', () => {
      it('should fetch orderbook data for spot market', async () => {
        const getOrderbook = new GetOrderbook()
        const request: ToolCallRequest = {
          params: {
            name: 'get_orderbook',
            arguments: {
              category: 'spot',
              symbol: testSymbols.spot,
              limit: 5
            }
          },
          method: 'tools/call' as const
        }

        const result = await getOrderbook.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(data).toHaveProperty('asks')
        expect(data).toHaveProperty('bids')
      })
    })

    describe('GetKline', () => {
      it('should fetch kline data for spot market', async () => {
        const getKline = new GetKline()
        const request: ToolCallRequest = {
          params: {
            name: 'get_kline',
            arguments: {
              category: 'spot',
              symbol: testSymbols.spot,
              interval: '1',
              limit: 5
            }
          },
          method: 'tools/call' as const
        }

        const result = await getKline.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThan(0)
      })
    })

    describe('GetTrades', () => {
      it('should fetch recent trades for spot market', async () => {
        const getTrades = new GetTrades()
        const request: ToolCallRequest = {
          params: {
            name: 'get_trades',
            arguments: {
              category: 'spot',
              symbol: testSymbols.spot,
              limit: 5
            }
          },
          method: 'tools/call' as const
        }

        const result = await getTrades.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThan(0)
      })
    })
  });

  // Skip account-specific tests in development mode
  (isDevMode ? describe.skip : describe)('Account Data Endpoints', () => {
    describe('GetPositions', () => {
      it('should fetch positions for linear perpetual', async () => {
        const getPositions = new GetPositions()
        const request: ToolCallRequest = {
          params: {
            name: 'get_positions',
            arguments: {
              category: 'linear',
              symbol: testSymbols.linear
            }
          },
          method: 'tools/call' as const
        }

        const result = await getPositions.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(Array.isArray(data)).toBe(true)
      })
    })

    describe('GetWalletBalance', () => {
      it('should fetch wallet balance for unified account', async () => {
        const getWalletBalance = new GetWalletBalance()
        const request: ToolCallRequest = {
          params: {
            name: 'get_wallet_balance',
            arguments: {
              accountType: 'UNIFIED'
            }
          },
          method: 'tools/call' as const
        }

        const result = await getWalletBalance.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(data).toHaveProperty('totalEquity')
        expect(data).toHaveProperty('totalWalletBalance')
      })
    })

    describe('GetOrderHistory', () => {
      it('should fetch order history for spot market', async () => {
        const getOrderHistory = new GetOrderHistory()
        const request: ToolCallRequest = {
          params: {
            name: 'get_order_history',
            arguments: {
              category: 'spot',
              limit: 5
            }
          },
          method: 'tools/call' as const
        }

        const result = await getOrderHistory.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(Array.isArray(data)).toBe(true)
      })
    })
  })

  describe('Market Information Endpoints', () => {
    describe('GetInstrumentInfo', () => {
      it('should fetch instrument info for spot market', async () => {
        const getInstrumentInfo = new GetInstrumentInfo()
        const request: ToolCallRequest = {
          params: {
            name: 'get_instrument_info',
            arguments: {
              category: 'spot',
              symbol: testSymbols.spot
            }
          },
          method: 'tools/call' as const
        }

        const result = await getInstrumentInfo.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(data).toHaveProperty('symbol', testSymbols.spot)
      })
    })

    describe('GetMarketInfo', () => {
      it('should fetch market info for spot category', async () => {
        const getMarketInfo = new GetMarketInfo()
        const request: ToolCallRequest = {
          params: {
            name: 'get_market_info',
            arguments: {
              category: 'spot'
            }
          },
          method: 'tools/call' as const
        }

        const result = await getMarketInfo.toolCall(request)
        expect(result.content[0].type).toBe('text')
        const data = JSON.parse(result.content[0].text as string)
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid symbols gracefully', async () => {
      const getTicker = new GetTicker()
      const request: ToolCallRequest = {
        params: {
          name: 'get_ticker',
          arguments: {
            category: 'spot',
            symbol: 'INVALID-PAIR'
          }
        },
        method: 'tools/call' as const
      }

      const result = await getTicker.toolCall(request)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBe(true)
      const errorData = JSON.parse(result.content[0].text as string)
      expect(errorData.category).toBe('VALIDATION')
    })

    it('should handle invalid categories gracefully', async () => {
      const getMarketInfo = new GetMarketInfo()
      const request: ToolCallRequest = {
        params: {
          name: 'get_market_info',
          arguments: {
            category: 'invalid-category' as any
          }
        },
        method: 'tools/call' as const
      }

      const result = await getMarketInfo.toolCall(request)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBe(true)
      const errorData = JSON.parse(result.content[0].text as string)
      expect(errorData.category).toBe('VALIDATION')
    })
  })
})
