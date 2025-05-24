/**
 * Jest test setup file
 * Handles global test configuration and cleanup
 */

import { jest } from '@jest/globals'

// Increase timeout for integration tests
jest.setTimeout(30000)

// Mock console methods to reduce noise during tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
const originalConsoleInfo = console.info

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.error = jest.fn()
  console.warn = jest.fn()
  console.info = jest.fn()
})

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
  console.info = originalConsoleInfo
})

// Global cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks()
  
  // Clear any timers
  jest.clearAllTimers()
  
  // Reset modules to ensure clean state
  jest.resetModules()
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

// Export common test utilities
export const createMockResponse = (data: any, success: boolean = true) => {
  return {
    retCode: success ? 0 : 1,
    retMsg: success ? 'OK' : 'Error',
    result: success ? data : null,
    retExtInfo: {},
    time: Date.now()
  }
}

export const createMockRequest = (name: string, arguments_: any) => {
  return {
    method: "tools/call" as const,
    params: {
      name,
      arguments: arguments_
    }
  }
}
