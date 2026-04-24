/**
 * Gemini AI client — replaces Anthropic SDK.
 * Uses gemini-1.5-pro with function calling for MCP tool use.
 */
import { GoogleGenerativeAI, FunctionDeclaration, Tool, SchemaType } from "@google/generative-ai"

const apiKey = process.env.GEMINI_API_KEY ?? ""
if (!apiKey) console.warn("[gemini] GEMINI_API_KEY not set")

const genAI = new GoogleGenerativeAI(apiKey)

export function getModel(toolDeclarations?: FunctionDeclaration[]) {
  const tools: Tool[] = toolDeclarations?.length
    ? [{ functionDeclarations: toolDeclarations }]
    : []
  return genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    tools: tools.length ? tools : undefined,
  })
}

export function mcpToolToGemini(tool: {
  name: string
  description: string
  input_schema: { properties?: Record<string, { type: string; description?: string }>; required?: string[] }
}): FunctionDeclaration {
  const props = tool.input_schema.properties ?? {}
  const parameters: Record<string, { type: SchemaType; description?: string }> = {}
  for (const [k, v] of Object.entries(props)) {
    parameters[k] = {
      type: (v.type?.toUpperCase() ?? "STRING") as SchemaType,
      description: v.description,
    }
  }
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: parameters,
      required: tool.input_schema.required ?? [],
    },
  }
}
