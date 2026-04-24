import { NextRequest, NextResponse } from "next/server"
import { getCycleState, getRoadmap }    from "@/lib/agents/cycle"
import { getSystemState, setManyState } from "@/lib/agents/sheets-ext"
import { getAllMeetings }               from "@/lib/memory/sheets"

export const runtime = "nodejs"

export async function GET() {
  try {
    const [state, roadmap, meetings] = await Promise.all([
      getCycleState(),
      getRoadmap(),
      getAllMeetings(10),
    ])

    const sysState = await getSystemState()

    // Meeting timeline
    const timeline = meetings.map(m => ({
      cycle:    m[1],
      ts:       m[0],
      summary:  m[2]?.slice(0, 100),
      focus:    m[4],
    }))

    return NextResponse.json({
      current:  state,
      roadmap,
      timeline,
      systemState: {
        nextFocus:     sysState["next_cycle_focus"],
        sprintGoal:    sysState["sprint_goal"],
        stability:     sysState["stability"],
        autonomousMode: sysState["autonomous_mode"],
        phase:         sysState["phase"],
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const allowed = ["sprint_goal", "next_cycle_focus", "autonomous_mode", "stability", "phase"]
    const updates: Record<string, string> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = String(body[key])
    }
    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 })
    }
    await setManyState(updates)
    return NextResponse.json({ ok: true, updated: Object.keys(updates) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
