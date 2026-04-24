import { NextRequest, NextResponse } from "next/server"
import { getRoadmap, upsertRoadmapEntry, completeSprintEntry } from "@/lib/agents/cycle"

export const runtime = "nodejs"

export async function GET() {
  try {
    const roadmap = await getRoadmap()
    const active    = roadmap.filter(s => s.status === "active")
    const planned   = roadmap.filter(s => s.status === "planned")
    const completed = roadmap.filter(s => s.status === "completed")
    return NextResponse.json({ roadmap, active, planned, completed })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sprintId, goal, status, startCycle, endCycle, notes } = body
    if (!sprintId || !goal) {
      return NextResponse.json({ error: "sprintId and goal required" }, { status: 400 })
    }
    const cycle = Math.floor(Date.now() / (15 * 60 * 1000))
    await upsertRoadmapEntry({
      sprintId, goal,
      status:     status     ?? "planned",
      startCycle: startCycle ?? cycle,
      endCycle:   endCycle   ?? cycle + 96,
      notes:      notes      ?? "",
    })
    return NextResponse.json({ ok: true, sprintId })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { sprintId, notes } = body as { sprintId: string; notes: string }
    if (!sprintId) {
      return NextResponse.json({ error: "sprintId required" }, { status: 400 })
    }
    await completeSprintEntry(sprintId, notes ?? "Completed.")
    return NextResponse.json({ ok: true, sprintId })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
