import Anthropic from "@anthropic-ai/sdk"

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("[claude] ANTHROPIC_API_KEY not set — Claude calls will fail. Set it in Vercel env vars.")
}

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Simple call ────────────────────────────────────────────────────────────
export async function ask(system: string, user: string, maxTokens = 1024): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  })
  const b = msg.content[0]
  return b.type === "text" ? b.text : ""
}

// ── Tool-calling (MCP) ────────────────────────────────────────────────────
export type Tool = {
  name: string
  description: string
  input_schema: object
}

export type ToolResult = {
  tool_name: string
  tool_input: Record<string, unknown>
  tool_output: string
}

export async function askWithTools(params: {
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
  tools: Tool[]
  onToolCall: (name: string, input: Record<string, unknown>) => Promise<string>
  maxTokens?: number
}): Promise<{ answer: string; toolCalls: ToolResult[] }> {
  const { system, messages, tools, onToolCall, maxTokens = 2048 } = params
  const toolCalls: ToolResult[] = []

  // Convert tools to Anthropic format
  const anthropicTools = tools.map(t => ({
    name:        t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }))

  let msgs: Anthropic.MessageParam[] = messages.map(m => ({
    role:    m.role,
    content: m.content,
  }))

  // Agentic loop
  for (let i = 0; i < 5; i++) {
    const resp = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      tools:      anthropicTools,
      messages:   msgs,
    })

    if (resp.stop_reason === "end_turn") {
      const text = resp.content.find(b => b.type === "text")
      return { answer: text?.type === "text" ? text.text : "", toolCalls }
    }

    if (resp.stop_reason === "tool_use") {
      const toolUseBlocks = resp.content.filter(b => b.type === "tool_use")
      const assistantMsg: Anthropic.MessageParam = { role: "assistant", content: resp.content }
      msgs = [...msgs, assistantMsg]

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue
        const input  = block.input as Record<string, unknown>
        const output = await onToolCall(block.name, input)
        toolCalls.push({ tool_name: block.name, tool_input: input, tool_output: output })
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output })
      }

      msgs = [...msgs, { role: "user", content: toolResults }]
      continue
    }

    break
  }

  return { answer: "", toolCalls }
}

// ── Streaming (for chat UI) ────────────────────────────────────────────────
export async function streamAnswer(params: {
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
  onChunk: (t: string) => void
}): Promise<string> {
  let full = ""
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: params.system,
    messages: params.messages,
  })
  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      full += chunk.delta.text
      params.onChunk(chunk.delta.text)
    }
  }
  return full
}
