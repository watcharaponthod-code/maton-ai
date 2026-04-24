/**
 * Main chat endpoint — MCP-powered scientific assistant.
 * Classifies input → selects tools → Claude reasons → streams answer.
 */
import { NextRequest } from "next/server"
import { anthropic }   from "@/lib/ai/claude"
import { TOOLS, executeTool } from "@/lib/mcp/tools"
import { classifyInput, SYSTEM_PROMPT } from "@/lib/mcp/router"
import type Anthropic from "@anthropic-ai/sdk"

export const maxDuration = 120
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const { messages, input } = await req.json() as {
    messages: { role: "user"|"assistant"; content: string }[]
    input?: string
  }

  const lastUser  = input ?? messages.filter(m => m.role === "user").slice(-1)[0]?.content ?? ""
  const route     = classifyInput(lastUser)
  const toolCalls: { name:string; input:Record<string,unknown>; output:string }[] = []

  // Filter tools based on routing decision
  const activeTools = TOOLS.filter(t => route.tools_to_use.includes(t.name))

  const anthropicTools = activeTools.map(t => ({
    name:        t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }))

  const msgs: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }))

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))

      try {
        // Send route info immediately
        send({ type: "route", inputType: route.type, tools: route.tools_to_use })

        // Agentic loop
        let currentMsgs = msgs
        for (let turn = 0; turn < 5; turn++) {
          const resp = await anthropic.messages.create({
            model:      "claude-sonnet-4-6",
            max_tokens: 2048,
            system:     SYSTEM_PROMPT + `\n\nContext hint: ${route.context_hint}`,
            tools:      anthropicTools,
            messages:   currentMsgs,
          })

          if (resp.stop_reason === "tool_use") {
            const toolUses = resp.content.filter(b => b.type === "tool_use")
            currentMsgs = [...currentMsgs, { role: "assistant", content: resp.content }]

            const results: Anthropic.ToolResultBlockParam[] = []
            for (const block of toolUses) {
              if (block.type !== "tool_use") continue
              const toolInput = block.input as Record<string, unknown>
              send({ type: "tool_call", name: block.name, input: toolInput })
              const output = await executeTool(block.name, toolInput)
              send({ type: "tool_result", name: block.name, output: output.slice(0, 500) })
              toolCalls.push({ name: block.name, input: toolInput, output })
              results.push({ type: "tool_result", tool_use_id: block.id, content: output })
            }
            currentMsgs = [...currentMsgs, { role: "user", content: results }]
            continue
          }

          if (resp.stop_reason === "end_turn") {
            const textBlock = resp.content.find(b => b.type === "text")
            const answer = textBlock?.type === "text" ? textBlock.text : ""
            send({ type: "answer", text: answer })
            break
          }
          break
        }
      } catch (e) {
        send({ type: "error", message: String(e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Accel-Buffering": "no" },
  })
}
