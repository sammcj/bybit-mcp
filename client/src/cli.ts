#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { BybitMcpClient, Message } from './client.js'
import { Config } from './config.js'
import { createInterface } from 'readline'

const program = new Command()
const config = new Config()
let client: BybitMcpClient | null = null

// Debug helper to log configuration
function logDebugInfo() {
  if (config.get('debug')) {
    console.log(chalk.yellow('Debug Info:'))
    console.log('Ollama Host:', config.get('ollamaHost'))
    console.log('Default Model:', config.get('defaultModel'))
    console.log('Debug Mode:', config.get('debug'))
  }
}

program
  .name('bybit-mcp-client')
  .description('CLI for interacting with Ollama LLMs and bybit-mcp server')
  .version('0.1.0')
  .option('-i, --integrated', 'Run in integrated mode with built-in server')
  .option('-d, --debug', 'Enable debug logging')

program
  .command('config')
  .description('Configure client settings')
  .option('-h, --ollama-host <url>', 'Set Ollama host URL')
  .option('-m, --default-model <model>', 'Set default Ollama model')
  .option('-d, --debug <boolean>', 'Enable/disable debug mode')
  .action((options: { ollamaHost?: string; defaultModel?: string; debug?: string }) => {
    if (options.ollamaHost) {
      config.set('ollamaHost', options.ollamaHost)
      console.log(chalk.green(`Ollama host set to: ${options.ollamaHost}`))
    }
    if (options.defaultModel) {
      config.set('defaultModel', options.defaultModel)
      console.log(chalk.green(`Default model set to: ${options.defaultModel}`))
    }
    if (options.debug !== undefined) {
      const debugEnabled = options.debug.toLowerCase() === 'true'
      config.set('debug', debugEnabled)
      console.log(chalk.green(`Debug mode ${debugEnabled ? 'enabled' : 'disabled'}`))
    }
    logDebugInfo()
  })

program
  .command('models')
  .description('List available Ollama models')
  .action(async () => {
    try {
      logDebugInfo()
      client = new BybitMcpClient(config)
      const models = await client.listModels()
      console.log(chalk.cyan('Available models:'))
      models.forEach(model => console.log(`  ${model}`))
    } catch (error) {
      console.error(chalk.red('Error listing models:'), error)
    } finally {
      await client?.close()
    }
  })

program
  .command('tools')
  .description('List available bybit-mcp tools')
  .argument('[server-command]', 'Command to start the bybit-mcp server (not needed in integrated mode)')
  .action(async (serverCommand?: string) => {
    try {
      logDebugInfo()
      client = new BybitMcpClient(config)

      if (program.opts().integrated) {
        if (program.opts().debug) {
          console.log(chalk.yellow('Starting integrated server...'))
        }
        await client.startIntegratedServer()
        if (program.opts().debug) {
          console.log(chalk.green('Started integrated server'))
        }
      } else if (serverCommand) {
        await client.connectToServer(serverCommand)
      } else {
        throw new Error('Either use --integrated or provide a server command')
      }

      const tools = await client.listTools()
      console.log(chalk.cyan('Available tools:'))
      tools.forEach(tool => {
        console.log(chalk.bold(`\n${tool.name}`))
        if (tool.description) console.log(`  Description: ${tool.description}`)
        if (tool.inputSchema) console.log(`  Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`)
      })
    } catch (error) {
      console.error(chalk.red('Error listing tools:'), error)
    } finally {
      await client?.close()
    }
  })

program
  .command('chat')
  .description('Chat with an Ollama model')
  .argument('[model]', 'Model to use (defaults to config setting)')
  .option('-s, --system <message>', 'System message to set context')
  .action(async (modelArg: string | undefined, options: { system?: string }) => {
    try {
      // Enable debug mode for chat to help diagnose issues
      config.set('debug', true)
      logDebugInfo()

      client = new BybitMcpClient(config)

      // Always start in integrated mode for chat
      if (program.opts().debug) {
        console.log(chalk.yellow('Starting integrated server for chat...'))
      }
      await client.startIntegratedServer()
      if (program.opts().debug) {
        console.log(chalk.green('Started integrated server'))
      }

      const model = modelArg || config.get('defaultModel')
      if (!model) {
        throw new Error('No model specified and no default model configured')
      }

      const messages: Message[] = []

      if (options.system) {
        messages.push({ role: 'system', content: options.system })
      }

      console.log(chalk.cyan(`Chatting with ${model} (Ctrl+C to exit)`))
      console.log(chalk.yellow('Tools are available - ask about cryptocurrency data!'))

      // Start chat loop
      while (true) {
        const userInput = await question(chalk.green('You: '))
        if (!userInput) continue

        messages.push({ role: 'user', content: userInput })

        process.stdout.write(chalk.blue('Assistant: '))
        await client.streamChat(model, messages, (token) => {
          process.stdout.write(token)
        })
        process.stdout.write('\n')

        messages.push({ role: 'assistant', content: await client.chat(model, messages) })
      }
    } catch (error) {
      console.error(chalk.red('Error in chat:'), error)
      if (program.opts().debug) {
        console.error('Full error:', error)
      }
    } finally {
      await client?.close()
    }
  })

program
  .command('tool')
  .description('Call a bybit-mcp tool')
  .argument('[server-command]', 'Command to start the bybit-mcp server (not needed in integrated mode)')
  .argument('<tool-name>', 'Name of the tool to call')
  .argument('[args...]', 'Tool arguments as key=value pairs')
  .action(async (serverCommand: string | undefined, toolName: string, args: string[]) => {
    try {
      logDebugInfo()
      client = new BybitMcpClient(config)

      if (program.opts().integrated) {
        if (program.opts().debug) {
          console.log(chalk.yellow('Starting integrated server...'))
        }
        await client.startIntegratedServer()
        if (program.opts().debug) {
          console.log(chalk.green('Started integrated server'))
        }
      } else if (serverCommand) {
        await client.connectToServer(serverCommand)
      } else {
        throw new Error('Either use --integrated or provide a server command')
      }

      // Parse arguments
      const toolArgs: Record<string, unknown> = {}
      args.forEach((arg: string) => {
        const [key, value] = arg.split('=')
        if (key && value) {
          // Try to parse as number or boolean if possible
          if (value === 'true') toolArgs[key] = true
          else if (value === 'false') toolArgs[key] = false
          else if (!isNaN(Number(value))) toolArgs[key] = Number(value)
          else toolArgs[key] = value
        }
      })

      const result = await client.callTool(toolName, toolArgs)
      console.log(result)
    } catch (error) {
      console.error(chalk.red('Error calling tool:'), error)
    } finally {
      await client?.close()
    }
  })

// Helper function to read user input
function question(query: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => readline.question(query, (answer: string) => {
    readline.close()
    resolve(answer)
  }))
}

// Set debug mode from command line option
if (program.opts().debug) {
  config.set('debug', true)
}

program.parse()
