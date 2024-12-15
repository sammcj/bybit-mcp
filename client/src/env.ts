import { config } from 'dotenv'
import { join } from 'path'
import { existsSync } from 'fs'

// Load environment variables from .env file if it exists
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  const result = config({ path: envPath })
  if (result.error) {
    console.error('Error loading .env file:', result.error)
  }
}

export interface EnvConfig {
  ollamaHost: string
  defaultModel: string
  debug: boolean
}

export function getEnvConfig(): EnvConfig {
  const ollamaHost = process.env.OLLAMA_HOST || process.env.OLLAMA_API_BASE
  if (!ollamaHost) {
    throw new Error('OLLAMA_HOST or OLLAMA_API_BASE environment variable must be set')
  }

  // Validate the URL format
  try {
    new URL(ollamaHost)
  } catch (error) {
    throw new Error(`Invalid OLLAMA_HOST URL format: ${ollamaHost}`)
  }

  return {
    ollamaHost,
    defaultModel: process.env.DEFAULT_MODEL || 'llama-3.2-11b-instruct:Q8_0',
    debug: process.env.DEBUG === 'true',
  }
}

// Validate required environment variables
export function validateEnv(): void {
  getEnvConfig() // This will throw if validation fails
}
