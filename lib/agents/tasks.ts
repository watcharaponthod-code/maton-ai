/**
 * TASK SYSTEM
 *
 * Manages the todo/doing/done lifecycle for each agent.
 * Tasks are persisted in Google Sheets "Tasks" tab.
 *
 * Task lifecycle:
 *   todo → doing → done
 *              ↓ (if blocked)
 *           blocked → todo (after resolution)
 */

import { upsertTask, updateTaskStatus, getImprovements } from "@/lib/agents/sheets-ext"
import type { AgentId } from "@/lib/agents/definitions"

export interface Task {
  agent:    string
  taskId:   string
  title:    string
  status:   "todo" | "doing" | "done" | "blocked"
  priority: "critical" | "high" | "medium" | "low"
  notes:    string
  cycle:    string
}

// ── Called when agent starts working on a task ────────────────────────────
export async function startTask(taskId: string) {
  await updateTaskStatus(taskId, "doing")
}

// ── Called when agent completes a task ────────────────────────────────────
export async function completeTask(taskId: string, notes: string) {
  await updateTaskStatus(taskId, "done", notes)
}

// ── Called when agent is blocked ──────────────────────────────────────────
export async function blockTask(taskId: string, reason: string) {
  await updateTaskStatus(taskId, "blocked", `BLOCKED: ${reason}`)
}

// ── Parse task updates from agent JSON output ────────────────────────────
export async function applyTaskUpdates(
  agentId: AgentId,
  cycle: number,
  updates: Array<{ taskId: string; status: string; notes?: string }>
) {
  for (const u of updates) {
    await updateTaskStatus(u.taskId, u.status, u.notes).catch(() => {})
  }
}

// ── Generate task ID ──────────────────────────────────────────────────────
export function makeTaskId(agent: string, cycle: number, index = 0): string {
  return `${agent}-c${cycle}-${index}`
}

// ── Build task context string for agent prompt ────────────────────────────
export function formatTasks(tasks: Task[]): string {
  if (!tasks.length) return "No assigned tasks. Use sprint goal as guide."
  const byStatus = { todo: [] as Task[], doing: [] as Task[], blocked: [] as Task[] }
  for (const t of tasks) {
    if (t.status === "done") continue
    if (t.status in byStatus) byStatus[t.status as keyof typeof byStatus].push(t)
  }
  const lines: string[] = []
  if (byStatus.doing.length)   lines.push(`▶ DOING:\n${byStatus.doing.map(t=>`   [${t.taskId}] ${t.title}`).join("\n")}`)
  if (byStatus.todo.length)    lines.push(`○ TODO:\n${byStatus.todo.map(t=>`   [${t.taskId}] ${t.title} [${t.priority}]`).join("\n")}`)
  if (byStatus.blocked.length) lines.push(`⊘ BLOCKED:\n${byStatus.blocked.map(t=>`   [${t.taskId}] ${t.title} — ${t.notes}`).join("\n")}`)
  return lines.join("\n\n")
}
