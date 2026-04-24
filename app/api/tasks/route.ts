import { NextRequest, NextResponse } from "next/server"
import { getTasks }                  from "@/lib/memory/sheets"
import { updateTaskStatus, upsertTask } from "@/lib/agents/sheets-ext"
import { AGENTS, AGENT_ORDER }       from "@/lib/agents/definitions"

export const runtime = "nodejs"

export async function GET() {
  try {
    const rows = await getTasks()

    // Map to rich task objects
    const tasks = rows.map(r => ({
      agent:    r[0] ?? "",
      taskId:   r[1] ?? "",
      title:    r[2] ?? r[1] ?? "Untitled task",
      status:   r[3] ?? "todo",
      priority: r[4] ?? "medium",
      notes:    r[5] ?? "",
      cycle:    r[6] ?? "",
    }))

    // Group by agent
    const byAgent: Record<string, typeof tasks> = {}
    for (const id of AGENT_ORDER) {
      byAgent[id] = tasks.filter(t => t.agent === id)
    }

    // Kanban board columns
    const kanban = {
      todo:    tasks.filter(t => t.status === "todo"),
      doing:   tasks.filter(t => t.status === "doing"),
      blocked: tasks.filter(t => t.status === "blocked"),
      done:    tasks.filter(t => t.status === "done").slice(-20),
    }

    return NextResponse.json({ tasks, byAgent, kanban, total: tasks.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { taskId, status, notes } = body as { taskId: string; status: string; notes?: string }
    if (!taskId || !status) {
      return NextResponse.json({ error: "taskId and status required" }, { status: 400 })
    }
    await updateTaskStatus(taskId, status, notes)
    return NextResponse.json({ ok: true, taskId, status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agent, taskId, title, status, priority, notes, cycle } = body
    if (!agent || !taskId || !title) {
      return NextResponse.json({ error: "agent, taskId, title required" }, { status: 400 })
    }
    await upsertTask({
      agent, taskId, title,
      status:   status   ?? "todo",
      priority: priority ?? "medium",
      notes:    notes    ?? "",
      cycle:    cycle    ?? Math.floor(Date.now() / (15 * 60 * 1000)),
    })
    return NextResponse.json({ ok: true, taskId })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
