import { NextRequest, NextResponse } from "next/server"
import { runAgent }              from "@/lib/agents/base-agent"
import { runMeeting }            from "@/lib/agents/runner"
import { ensureAllTabs }         from "@/lib/agents/sheets-ext"
import { ensureTabs }            from "@/lib/memory/sheets"
import { initSprintIfNeeded, getCycleState } from "@/lib/agents/cycle"
import { AGENT_ORDER, type AgentId }         from "@/lib/agents/definitions"

export const maxDuration = 300
export const runtime     = "nodejs"

async function bootstrap() {
  // Ensure all Sheets tabs exist (idempotent)
  await Promise.all([
    ensureTabs().catch(() => {}),
    ensureAllTabs().catch(() => {}),
  ])
  // Initialize sprint state on very first run
  await initSprintIfNeeded().catch(() => {})
}

export async function GET(req: NextRequest) {
  // Auth: accept Vercel cron header OR Bearer secret
  const isVercelCron = req.headers.get("x-vercel-cron") === "1"
  const auth         = req.headers.get("authorization")
  const secret       = process.env.CRON_SECRET
  if (!isVercelCron && secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const agent = req.nextUrl.searchParams.get("agent") as AgentId | null
  if (!agent || !AGENT_ORDER.includes(agent)) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 400 })
  }

  // Bootstrap sheets + sprint state (fast, idempotent)
  await bootstrap()

  const cycle = Math.floor(Date.now() / (15 * 60 * 1000))
  const state = await getCycleState().catch(() => null)

  // Skip non-chief agents if autonomous mode is disabled
  if (agent !== "chief" && state && !state.autonomousMode) {
    return NextResponse.json({
      ok: true, agent, cycle,
      skipped: true,
      reason: "autonomous_mode=false",
    })
  }

  // Chief Agent triggers the full meeting
  if (agent === "chief") {
    const meeting = await runMeeting(cycle)
    return NextResponse.json({
      ok:         true,
      agent:      "chief",
      cycle,
      sprint:     state?.sprintId,
      priorities: meeting.priorities,
      tasks:      meeting.tasks.length,
      stability:  meeting.stability,
      nextFocus:  meeting.nextFocus,
    })
  }

  // All other agents: run with full memory context
  const result = await runAgent(agent)
  return NextResponse.json({
    ok:        true,
    agent,
    cycle,
    sprint:    state?.sprintId,
    task:      result.task,
    hasIssues: Boolean(result.issues),
    ts:        result.timestamp,
  })
}

export async function POST(req: NextRequest) { return GET(req) }
