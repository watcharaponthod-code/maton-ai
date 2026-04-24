import { NextRequest, NextResponse } from "next/server"
import { getImprovements, approveImprovement, proposeImprovement } from "@/lib/agents/sheets-ext"
import { parseImprovements }           from "@/lib/agents/self-improve"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const rows = await getImprovements()
    const all  = parseImprovements(rows)

    const status = req.nextUrl.searchParams.get("status")
    const filtered = status ? all.filter(i => i.status === status) : all

    const stats = {
      total:       all.length,
      proposed:    all.filter(i => i.status === "proposed").length,
      approved:    all.filter(i => i.status === "approved").length,
      implemented: all.filter(i => i.status === "implemented").length,
      rejected:    all.filter(i => i.status === "rejected").length,
    }

    return NextResponse.json({ improvements: filtered, stats })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, agent, description, cycle } = body
    if (!id || !agent || !description) {
      return NextResponse.json({ error: "id, agent, description required" }, { status: 400 })
    }
    await proposeImprovement({
      id,
      agent,
      description,
      cycle: cycle ?? Math.floor(Date.now() / (15 * 60 * 1000)),
    })
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, verdict, validation } = body as {
      id: string; verdict: "approved" | "rejected"; validation: string
    }
    if (!id || !verdict) {
      return NextResponse.json({ error: "id and verdict required" }, { status: 400 })
    }
    const note = verdict === "rejected" ? `REJECTED: ${validation}` : validation
    await approveImprovement(id, note)
    return NextResponse.json({ ok: true, id, verdict })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
