/**
 * Chat endpoint — Gemini 1.5 Pro + MCP tool calling.
 */
import { NextRequest } from "next/server"
import { getModel, mcpToolToGemini } from "@/lib/ai/gemini"
import { TOOLS, executeTool } from "@/lib/mcp/tools"
import { classifyInput, SYSTEM_PROMPT } from "@/lib/mcp/router"

export const maxDuration = 120
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[]
  }

  const lastUser = messages.filter(m => m.role === "user").slice(-1)[0]?.content ?? ""
  const route    = classifyInput(lastUser)
  const activeTools = TOOLS.filter(t => route.tools_to_use.includes(t.name))
  const geminiTools = activeTools.map(mcpToolToGemini)
  const model = getModel(geminiTools)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))

      try {
        send({ type: "route", inputType: route.type, tools: route.tools_to_use })

        // Build Gemini history (exclude last user msg)
        const history = messages.slice(0, -1).map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }))

        const chat = model.startChat({
          history,
          systemInstruction: SYSTEM_PROMPT + `\n\nContext hint: ${route.context_hint}`,
        })

        let response = await chat.sendMessage(lastUser)

        // Agentic tool loop (up to 5 turns)
        for (let turn = 0; turn < 5; turn++) {
          const candidate = response.response.candidates?.[0]
          if (!candidate) break

          const fnCalls = candidate.content.parts?.filter(p => p.functionCall) ?? []
          if (fnCalls.length === 0) break

          const toolResults = []
          for (const part of fnCalls) {
            const fn = part.functionCall!
            const toolInput = fn.args as Record<string, unknown>
            send({ type: "tool_call", name: fn.name, input: toolInput })
            const output = await executeTool(fn.name, toolInput)
            send({ type: "tool_result", name: fn.name, output: output.slice(0, 500) })
            toolResults.push({
              functionResponse: { name: fn.name, response: { result: output } },
            })
          }

          response = await chat.sendMessage(toolResults)
        }

        // Extract final text
        const text = response.response.text()
        send({ type: "answer", text })

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
