import { NextRequest, NextResponse } from "next/server"
import { runMeeting }     from "@/lib/agents/runner"
import { getAllMeetings } from "@/lib/memory/sheets"
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({})) as { cycle?: number }
  const cycle = body.cycle ?? Math.floor(Date.now() / (15 * 60 * 1000))
  const result = await runMeeting(cycle)
  return NextResponse.json({ ok: true, ...result })
}

export async function GET() {
  const rows = await getAllMeetings(15)
  const meetings = rows.map(r => ({
    timestamp: r[0], cycle: r[1], summary: r[2],
    decisions: r[3], nextFocus: r[4],
    tasks: (() => { try { return JSON.parse(r[5] ?? "[]") } catch { return [] } })(),
  }))
  return NextResponse.json({ meetings: meetings.reverse() })
}
