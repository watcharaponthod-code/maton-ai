import { NextResponse } from "next/server"
import { getLogs, getTasks, getLastMeeting } from "@/lib/memory/sheets"
import { AGENTS, AGENT_ORDER } from "@/lib/agents/definitions"

export const runtime = "nodejs"

export async function GET() {
  const [logs, tasks, lastMeeting] = await Promise.all([getLogs(30), getTasks(), getLastMeeting()])
  const now = Date.now()

  const agents = AGENT_ORDER.map(id => {
    const def   = AGENTS[id]
    const runs  = logs.filter(r => r[1] === def.name)
    const last  = runs[runs.length - 1]
    const lastTs = last ? new Date(last[0]).getTime() : 0
    const minAgo = last ? Math.floor((now - lastTs) / 60000) : null
    const task   = tasks.find(t => t[0] === id)
    return {
      id, name: def.name, emoji: def.emoji, color: def.color,
      status: minAgo !== null && minAgo < 20 ? "active" : last ? "idle" : "waiting",
      lastTask: last ? last[2] : "Not run",
      lastResult: last ? last[3]?.slice(0,150) : "",
      issues: last ? last[4] : "",
      minAgo,
      currentTask: task ? task[1] : null,
    }
  })

  const feed = logs.slice(-20).reverse().map(r => ({
    ts: r[0], agent: r[1], task: r[2], result: r[3], issues: r[4],
  }))

  return NextResponse.json({
    agents,
    feed,
    meeting: lastMeeting ? {
      ts: lastMeeting[0], cycle: lastMeeting[1],
      summary: lastMeeting[2], decisions: lastMeeting[3], nextFocus: lastMeeting[4],
    } : null,
    health: agents.filter(a => a.issues).length > 2 ? "degraded" : "healthy",
    totalRuns: logs.length,
    ts: new Date().toISOString(),
  })
}
