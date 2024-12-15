import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Ollama } from 'ollama'
import { Config } from './config.js'
import type {
  Tool,
  TextContent,
  ImageContent,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'

// Define a simpler Message type for Ollama compatibility
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ServerProcess {
  process: ChildProcess
  kill: () => void
}

class RequestQueue {
  private queue: (() => Promise<any>)[] = []
  private processing: boolean = false

  async enqueue<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(request)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.processQueue()
    })
  }

  private async executeWithRetry(request: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await request()
      } catch (error) {
        if (attempt === retries) throw error
        if (error instanceof Error && error.message.includes('model not found')) throw error
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
      }
    }
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    this.processing = true

    while (this.queue.length > 0) {
      const request = this.queue.shift()
      if (request) {
        try {
          await request()
        } catch (error) {
          console.error('Error processing request:', error)
        }
      }
    }

    this.processing = false
  }
}

export class BybitMcpClient {
  private mcpClient: Client
  private ollama: Ollama
  private config: Config
  private serverProcess: ServerProcess | null = null
  private availableTools: Tool[] = []
  private modelValidated: boolean = false
  private requestQueue: RequestQueue

  constructor(config: Config) {
    this.config = config
    this.requestQueue = new RequestQueue()
    this.mcpClient = new Client({
      name: 'bybit-mcp-client',
      version: '0.1.0'
    }, {
      capabilities: {
        roots: {
          listChanged: true
        },
        sampling: {}
      }
    })

    const ollamaHost = config.get('ollamaHost')
    if (!ollamaHost) {
      throw new Error('OLLAMA_HOST is not configured')
    }

    this.ollama = new Ollama({
      host: ollamaHost
    })
  }

  private async validateModel(): Promise<void> {
    if (this.modelValidated) {
      return
    }

    const model = this.config.get('defaultModel')
    try {
      const response = await this.requestQueue.enqueue(() => this.ollama.list())
      const modelExists = response.models.some(m => m.name === model)

      if (!modelExists) {
        const ollamaHost = this.config.get('ollamaHost')
        throw new Error(
          `Model "${model}" not found on Ollama server at ${ollamaHost}.\n` +
          `Available models: ${response.models.map(m => m.name).join(', ')}\n\n` +
          `To pull the required model, run:\n` +
          `curl -X POST ${ollamaHost}/api/pull -d '{"name": "${model}"}'`
        )
      }

      this.modelValidated = true
    } catch (error) {
      throw new Error(`Failed to validate model: ${error}`)
    }
  }

  private getServerPath(): string {
    // When running as part of bybit-mcp repository
    const repoServerPath = join(process.cwd(), '..', 'build', 'index.js')

    // When installed as a package
    const packageServerPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      'build',
      'index.js'
    )

    // Check which path exists and is executable
    try {
      if (existsSync(repoServerPath)) {
        return repoServerPath
      }
      if (existsSync(packageServerPath)) {
        return packageServerPath
      }
    } catch (error) {
      console.error('Error finding server path:', error)
    }

    throw new Error('Could not find bybit-mcp server. Please ensure it is installed correctly.')
  }

  async startIntegratedServer(): Promise<void> {
    if (this.serverProcess) {
      throw new Error('Server is already running')
    }

    const serverPath = this.getServerPath()
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DEVELOPMENT_MODE: 'true',
        NODE_ENV: 'production'
      }
    })

    // Handle server output
    serverProcess.stdout?.on('data', (data: Buffer) => {
      if (this.config.get('debug')) {
        console.log('[Server]:', data.toString())
      }
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      if (this.config.get('debug')) {
        console.error('[Server Error]:', data.toString())
      }
    })

    // Handle server exit
    serverProcess.on('exit', (code: number | null) => {
      if (code !== 0 && this.config.get('debug')) {
        console.error(`Server exited with code ${code}`)
      }
      this.serverProcess = null
    })

    this.serverProcess = {
      process: serverProcess,
      kill: () => {
        serverProcess.kill()
        this.serverProcess = null
      }
    }

    // Connect to the server
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath]
    })
    await this.mcpClient.connect(transport)

    // Cache available tools
    const response = await this.mcpClient.listTools()
    this.availableTools = response.tools

    // Validate model availability once at startup
    await this.validateModel()
  }

  async connectToServer(command: string): Promise<void> {
    const transport = new StdioClientTransport({
      command,
      args: []
    })
    await this.mcpClient.connect(transport)

    // Cache available tools
    const response = await this.mcpClient.listTools()
    this.availableTools = response.tools

    // Validate model availability once at startup
    await this.validateModel()
  }

  async listTools(): Promise<Tool[]> {
    return this.availableTools
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    const response = await this.mcpClient.callTool({
      name: toolName,
      arguments: args
    }) as CallToolResult

    if (!response.content?.[0]) {
      throw new Error('Invalid response from tool')
    }

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error(`Unexpected content type: ${content.type}`)
    }

    if (response.isError) {
      throw new Error(content.text)
    }

    return content.text
  }

  private generateSystemPrompt(userSystemMessage?: string): string {
    let systemPrompt = `You are a helpful assistant with access to real-time cryptocurrency data through the bybit-mcp server. You have access to the following tools:

${this.availableTools.map(tool => {
  const schema = tool.inputSchema as { properties?: Record<string, any>, required?: string[] }
  const required = schema.required || []
  const properties = Object.entries(schema.properties || {}).map(([name, prop]) => {
    const isRequired = required.includes(name)
    const annotations = (prop as any).annotations || {}
    return `    ${name}${isRequired ? ' (required)' : ''}: ${prop.description || 'No description'} ${annotations.priority === 1 ? '(high priority)' : ''}`
  }).join('\n')

  return `${tool.name}:
  Description: ${tool.description || 'No description provided'}
  Parameters:
${properties}
`
}).join('\n')}

When a user asks about cryptocurrency data, you MUST use these tools to provide real-time information. For example:
- Use get_ticker to get current price information
- Use get_orderbook to see current buy/sell orders
- Use get_kline to view price history
- Use get_trades to see recent trades

To use a tool, format your response like this:
<tool>get_ticker</tool>
<arguments>
{
  "category": "spot",
  "symbol": "BTCUSDT"
}
</arguments>
`

    if (userSystemMessage) {
      systemPrompt += `\n\nAdditional Context: ${userSystemMessage}`
    }

    return systemPrompt
  }

  private async handleToolUsage(response: string): Promise<string | null> {
    const toolMatch = response.match(/<tool>(.*?)<\/tool>/s)
    const argsMatch = response.match(/<arguments>(.*?)<\/arguments>/s)

    if (toolMatch && argsMatch) {
      const toolName = toolMatch[1].trim()
      try {
        const args = JSON.parse(argsMatch[1].trim())
        const result = await this.callTool(toolName, args)
        return result
      } catch (error) {
        console.error(`Error executing tool ${toolName}:`, error)
        return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`
      }
    }
    return null
  }

  async chat(model: string, messages: Message[]): Promise<string> {
    // Create a copy of messages to avoid modifying the input
    const messagesCopy = [...messages]

    // If there's no system message, add one with tool information
    if (!messagesCopy.some(m => m.role === 'system')) {
      messagesCopy.unshift({
        role: 'system',
        content: this.generateSystemPrompt()
      })
    }

    const response = await this.requestQueue.enqueue(() =>
      this.ollama.chat({
        model,
        messages: messagesCopy,
        stream: false
      }).then(response => response.message.content)
    )

    // Check if the response contains a tool usage request
    const toolResult = await this.handleToolUsage(response)
    if (toolResult) {
      // Add the tool result to the conversation and get a new response
      messagesCopy.push({ role: 'assistant', content: response })
      messagesCopy.push({ role: 'system', content: `Tool result: ${toolResult}` })

      return this.requestQueue.enqueue(() =>
        this.ollama.chat({
          model,
          messages: messagesCopy,
          stream: false
        }).then(response => response.message.content)
      )
    }

    return response
  }

  async streamChat(
    model: string,
    messages: Message[],
    onToken: (token: string) => void
  ): Promise<void> {
    // Create a copy of messages to avoid modifying the input
    const messagesCopy = [...messages]

    // If there's no system message, add one with tool information
    if (!messagesCopy.some(m => m.role === 'system')) {
      messagesCopy.unshift({
        role: 'system',
        content: this.generateSystemPrompt()
      })
    }

    let fullResponse = ''
    await this.requestQueue.enqueue(async () => {
      for await (const chunk of await this.ollama.chat({
        model,
        messages: messagesCopy,
        stream: true
      })) {
        if (chunk.message?.content) {
          fullResponse += chunk.message.content
          onToken(chunk.message.content)
        }
      }
    })

    // Check if the response contains a tool usage request
    const toolResult = await this.handleToolUsage(fullResponse)
    if (toolResult) {
      // Add the tool result to the conversation and get a new response
      messagesCopy.push({ role: 'assistant', content: fullResponse })
      messagesCopy.push({ role: 'system', content: `Tool result: ${toolResult}` })

      onToken('\n\nTool result: ' + toolResult + '\n\nProcessing result...\n\n')

      await this.requestQueue.enqueue(async () => {
        for await (const chunk of await this.ollama.chat({
          model,
          messages: messagesCopy,
          stream: true
        })) {
          if (chunk.message?.content) {
            onToken(chunk.message.content)
          }
        }
      })
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.requestQueue.enqueue(() => this.ollama.list())
    return response.models.map(model => model.name)
  }

  async close(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill()
    }
    await this.mcpClient.close()
  }

  isIntegrated(): boolean {
    return this.serverProcess !== null
  }
}
