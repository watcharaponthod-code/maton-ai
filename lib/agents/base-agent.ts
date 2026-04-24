/**
 * BASE AGENT — Autonomous execution core
 *
 * Every non-chief agent runs through this. Each cycle:
 *   1. Build rich memory snapshot (tasks, logs, decisions, sprint goal)
 *   2. Format context for agent prompt
 *   3. Call Claude with agent's role prompt + context
 *   4. Parse structured JSON output
 *   5. Apply task status updates
 *   6. Submit self-improvement proposal
 *   7. Log result to Google Sheets
 */

import { ask }                         from "@/lib/ai/claude"
import { appendLog }                   from "@/lib/memory/sheets"
import { AGENTS, type AgentId }        from "@/lib/agents/definitions"
import { buildMemory, formatMemoryForAgent } from "@/lib/agents/memory"
import { applyTaskUpdates }            from "@/lib/agents/tasks"
import { submitImprovement }           from "@/lib/agents/self-improve"
import { incrementCycleCounter }       from "@/lib/agents/cycle"
import {
  upsertTask,
  setSystemState,
} from "@/lib/agents/sheets-ext"

export interface AgentResult {
  agentId:    AgentId
  cycle:      number
  task:       string
  result:     string
  issues:     string
  nextAction: string
  raw:        Record<string, unknown>
  timestamp:  string
}

export async function runAgent(agentId: AgentId): Promise<AgentResult> {
  const def   = AGENTS[agentId]
  const cycle = Math.floor(Date.now() / (15 * 60 * 1000))

  // 1. Build full memory snapshot for this agent
  const memory = await buildMemory(agentId, cycle).catch(() => null)

  // 2. Build context string
  const context = memory
    ? formatMemoryForAgent(memory, agentId)
    : `CYCLE #${cycle}\nNo memory available — establish baseline for your role.`

  // 3. Call Claude
  const maxTokens = def.tier === "senior" ? 1536 : 1024
  const raw = await ask(def.prompt, context, maxTokens)
    .catch(e => JSON.stringify({
      task:       "error executing agent",
      result:     String(e),
      issues:     String(e),
      next_action:"retry next cycle",
      task_updates: [],
      self_improvement: "",
    }))

  // 4. Parse JSON output
  let parsed: Record<string, unknown> = {}
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) parsed = JSON.parse(m[0])
  } catch {
    // fallback: use raw text
    parsed = { task: "parse error", result: raw.slice(0, 300), issues: "JSON parse failed" }
  }

  // 5. Apply task status updates
  const taskUpdates = Array.isArray(parsed.task_updates)
    ? (parsed.task_updates as Array<{ taskId: string; status: string; notes?: string }>)
    : []
  if (taskUpdates.length) {
    await applyTaskUpdates(agentId, cycle, taskUpdates).catch(() => {})
  }

  // 6. Auto-create a task for this cycle if agent has no assigned task
  const myTasks = memory?.myTasks ?? []
  const activeTasks = myTasks.filter(t => t.status === "doing" || t.status === "todo")
  if (activeTasks.length === 0) {
    const taskTitle = String(parsed.task ?? `${def.name} cycle work`)
    await upsertTask({
      agent:    agentId,
      taskId:   `${agentId}-c${cycle}`,
      title:    taskTitle.slice(0, 120),
      status:   "done",
      priority: "medium",
      notes:    String(parsed.next_action ?? "").slice(0, 200),
      cycle,
    }).catch(() => {})
  }

  // 7. Submit self-improvement proposal
  const improvement = String(parsed.self_improvement ?? "").trim()
  if (improvement && improvement.length > 10) {
    await submitImprovement({ agentId, description: improvement, cycle }).catch(() => {})
  }

  // 8. Track stability from ops agent
  if (agentId === "ops") {
    const healthScore = Number(parsed.health_score ?? 8)
    const stability = healthScore >= 8 ? "healthy" : healthScore >= 5 ? "watch" : "degraded"
    await setSystemState("stability", stability).catch(() => {})
  }

  // 9. Assemble result
  const resultText = String(
    parsed.findings ??
    parsed.implementation_plan ??
    parsed.chief_briefing ??
    parsed.meeting_summary ??
    parsed.result ??
    raw.slice(0, 300)
  )

  const result: AgentResult = {
    agentId,
    cycle,
    task:       String(parsed.task ?? "completed task").slice(0, 150),
    result:     resultText.slice(0, 500),
    issues:     String(parsed.issues ?? ""),
    nextAction: String(parsed.next_action ?? ""),
    raw:        parsed,
    timestamp:  new Date().toISOString(),
  }

  // 10. Log to Google Sheets
  await appendLog({
    agent:       def.name,
    task:        result.task,
    result:      result.result.slice(0, 400),
    issues:      result.issues.slice(0, 200),
    next_action: result.nextAction.slice(0, 200),
  }).catch(e => console.error("[Sheets log]", e))

  // 11. Increment cycle counter (only once per non-chief run per cycle)
  await incrementCycleCounter().catch(() => {})

  return result
}
