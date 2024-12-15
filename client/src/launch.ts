#!/usr/bin/env node
import { existsSync } from 'fs'
import { join } from 'path'
import { execSync, spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { validateEnv, getEnvConfig } from './env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Cache file to store last check timestamp
const CACHE_FILE = join(__dirname, '..', '.install-check')
const CHECK_INTERVAL = 1000 * 60 * 60 // 1 hour

function shouldCheckDependencies(): boolean {
  try {
    if (existsSync(CACHE_FILE)) {
      const stat = execSync(`stat -f %m "${CACHE_FILE}"`).toString().trim()
      const lastCheck = parseInt(stat, 10) * 1000 // Convert to milliseconds
      return Date.now() - lastCheck > CHECK_INTERVAL
    }
    return true
  } catch {
    return true
  }
}

function updateCheckTimestamp(): void {
  try {
    execSync(`touch "${CACHE_FILE}"`)
  } catch (error) {
    console.warn('Warning: Could not update dependency check timestamp')
  }
}

interface OllamaModel {
  name: string
}

interface OllamaListResponse {
  models: OllamaModel[]
}

function checkOllama(): boolean {
  const config = getEnvConfig()
  try {
    // First check if we can connect to Ollama
    const tagsResponse = execSync(`curl -s ${config.ollamaHost}/api/tags`).toString()

    // Parse the response to check if the required model exists
    const models = JSON.parse(tagsResponse) as OllamaListResponse
    const modelExists = models.models.some(model => model.name === config.defaultModel)

    if (!modelExists) {
      console.error(`Error: Model "${config.defaultModel}" not found on Ollama server at ${config.ollamaHost}`)
      console.log('Available models:', models.models.map(m => m.name).join(', '))
      console.log(`\nTo pull the required model, run:\ncurl -X POST ${config.ollamaHost}/api/pull -d '{"name": "${config.defaultModel}"}'`)
      return false
    }

    return true
  } catch (error) {
    console.error('Error checking Ollama:', error)
    return false
  }
}

function quickDependencyCheck(): boolean {
  const nodeModulesPath = join(__dirname, '..', 'node_modules')
  const buildPath = join(__dirname, '..', 'build')

  if (!existsSync(nodeModulesPath) || !existsSync(buildPath)) {
    console.log('Installing and building...')
    try {
      execSync('pnpm install && pnpm run build', {
        stdio: 'inherit',
        cwd: join(__dirname, '..')
      })
    } catch (error) {
      console.error('Failed to install dependencies and build')
      return false
    }
  }

  return true
}

async function main() {
  try {
    // Validate environment configuration first
    validateEnv()
    const config = getEnvConfig()

    // Check Ollama connection and model availability
    if (!checkOllama()) {
      process.exit(1)
    }

    // Only check dependencies if needed
    if (shouldCheckDependencies()) {
      if (!quickDependencyCheck()) {
        process.exit(1)
      }
      updateCheckTimestamp()
    }

    // Enable debug mode for better error reporting
    process.env.DEBUG = 'true'

    // Start the chat interface in integrated mode with debug enabled
    spawn('node', ['build/cli.js', '--integrated', '--debug', 'chat'], {
      stdio: 'inherit',
      cwd: join(__dirname, '..'),
      env: {
        ...process.env,
        OLLAMA_HOST: config.ollamaHost,
        DEFAULT_MODEL: config.defaultModel
      }
    })

  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message)
      if (process.env.DEBUG === 'true') {
        console.error('Stack trace:', error.stack)
      }
    } else {
      console.error('Unknown error occurred')
    }
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Error:', error)
  if (process.env.DEBUG === 'true') {
    console.error('Stack trace:', error.stack)
  }
  process.exit(1)
})
