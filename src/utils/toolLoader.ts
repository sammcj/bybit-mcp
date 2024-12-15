import { BaseToolImplementation } from "../tools/BaseTool.js"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { promises as fs } from "fs"

async function findToolsPath(): Promise<string> {
  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFilePath)
  return join(currentDir, "..", "tools")
}

const isToolFile = (file: string): boolean => {
  return (
    file.endsWith(".js") &&
    !file.includes("BaseTool") &&
    !file.includes("index") &&
    !file.endsWith(".test.js") &&
    !file.endsWith(".spec.js") &&
    !file.endsWith(".d.js")
  )
}

export async function loadTools(): Promise<BaseToolImplementation[]> {
  try {
    const toolsPath = await findToolsPath()
    const files = await fs.readdir(toolsPath)
    const tools: BaseToolImplementation[] = []

    for (const file of files) {
      if (!isToolFile(file)) {
        continue
      }

      try {
        const modulePath = `file://${join(toolsPath, file)}`
        const { default: ToolClass } = await import(modulePath)

        if (!ToolClass || typeof ToolClass !== 'function') {
          console.warn(JSON.stringify({
            type: "warning",
            message: `Invalid tool class in ${file}`
          }))
          continue
        }

        const tool = new ToolClass()

        if (
          tool instanceof BaseToolImplementation &&
          tool.name &&
          tool.toolDefinition &&
          typeof tool.toolCall === "function"
        ) {
          tools.push(tool)
          console.info(JSON.stringify({
            type: "info",
            message: `Loaded tool: ${tool.name}`
          }))
        } else {
          console.warn(JSON.stringify({
            type: "warning",
            message: `Invalid tool implementation in ${file}`
          }))
        }
      } catch (error) {
        console.error(JSON.stringify({
          type: "error",
          message: `Error loading tool from ${file}: ${error instanceof Error ? error.message : String(error)}`
        }))
      }
    }

    return tools
  } catch (error) {
    console.error(JSON.stringify({
      type: "error",
      message: `Failed to load tools: ${error instanceof Error ? error.message : String(error)}`
    }))
    return []
  }
}

export function createToolsMap(tools: BaseToolImplementation[]): Map<string, BaseToolImplementation> {
  return new Map(tools.map((tool) => [tool.name, tool]))
}
