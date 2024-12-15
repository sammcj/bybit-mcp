import { config } from 'dotenv'
import { join } from 'path'
import { existsSync } from 'fs'

// Load environment variables from .env file if it exists
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  config({ path: envPath })
}

export interface EnvConfig {
  apiKey: string | undefined
  apiSecret: string | undefined
  useTestnet: boolean
  debug: boolean
}

export function getEnvConfig(): EnvConfig {
  return {
    apiKey: process.env.BYBIT_API_KEY,
    apiSecret: process.env.BYBIT_API_SECRET,
    useTestnet: process.env.BYBIT_USE_TESTNET === 'true',
    debug: process.env.DEBUG === 'true',
  }
}

// Validate environment variables
export function validateEnv(): void {
  const config = getEnvConfig()

  // In development mode, API keys are optional
  if (!config.apiKey || !config.apiSecret) {
    console.warn('Running in development mode: API keys not provided')
  }

  // Additional validations can be added here
}
