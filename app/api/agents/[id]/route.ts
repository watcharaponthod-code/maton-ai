import { NextRequest, NextResponse } from "next/server"
import { runAgent }  from "@/lib/agents/base-agent"
import { AGENT_ORDER, type AgentId } from "@/lib/agents/definitions"
export const maxDuration = 120

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id as AgentId
  if (!AGENT_ORDER.includes(id)) return NextResponse.json({ error: "Unknown agent" }, { status: 400 })
  const result = await runAgent(id)
  return NextResponse.json({ ok: true, ...result })
}
