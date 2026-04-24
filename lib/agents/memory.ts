/**
 * AGENT MEMORY SYSTEM
 *
 * The single source of truth every agent reads before acting.
 * Pulls from Google Sheets tabs: Logs, Tasks, Roadmap, Decisions,
 * Improvements, SystemState.
 *
 * Returns a structured MemorySnapshot that is injected into every
 * agent's context at cron-time.
 */

import {
  getLogs, getTasks, getLastMeeting, getAllMeetings
} from "@/lib/memory/sheets"
import { getSystemState, getDecisions, getImprovements } from "@/lib/agents/sheets-ext"

export interface AgentTask {
  agent:    string
  taskId:   string
  title:    string
  status:   "todo" | "doing" | "done" | "blocked"
  priority: "critical" | "high" | "medium" | "low"
  notes:    string
  cycle:    string
}

export interface MemorySnapshot {
  cycle:             number
  systemState:       Record<string, string>
  myTasks:           AgentTask[]
  allTasks:          AgentTask[]
  recentLogs:        string
  lastDecisions:     string
  lastMeetingFocus:  string
  openImprovements:  string
  sprintGoal:        string
  cycleHistory:      string
  stability:         string
  autonomousMode:    boolean
}

export async function buildMemory(agentId: string, cycle: number): Promise<MemorySnapshot> {
  const [logs, rawTasks, lastMeeting, allMeetings, state, decisions, improvements] = await Promise.all([
    getLogs(20),
    getTasks(),
    getLastMeeting(),
    getAllMeetings(3),
    getSystemState(),
    getDecisions(10),
    getImprovements(),
  ])

  // Parse tasks
  const allTasks: AgentTask[] = rawTasks.map(r => ({
    agent:    r[0] ?? "",
    taskId:   r[1] ?? "",
    title:    r[2] ?? "",
    status:   (r[3] ?? "todo") as AgentTask["status"],
    priority: (r[4] ?? "medium") as AgentTask["priority"],
    notes:    r[5] ?? "",
    cycle:    r[6] ?? "",
  }))
  const myTasks = allTasks.filter(t => t.agent === agentId && t.status !== "done")

  // Recent logs digest (last 8, readable)
  const recentLogs = logs.slice(-8).map(r =>
    `[${r[1]}] ${r[2]?.slice(0,80)} → ${r[3]?.slice(0,100)}${r[4] ? ` ⚠ ${r[4].slice(0,60)}` : ""}`
  ).join("\n") || "No recent activity."

  // Decisions from last meeting
  const lastDecisions = decisions.slice(0,5).map(d =>
    `• ${d[2]} [justified: ${d[3]?.slice(0,80)}]`
  ).join("\n") || lastMeeting?.[3]?.slice(0,300) || "No decisions recorded yet."

  // Last meeting focus
  const lastMeetingFocus = lastMeeting?.[4] ?? state["next_cycle_focus"] ?? "Not defined — establish baseline."

  // Sprint goal
  const sprintGoal = state["sprint_goal"] ?? "Build Multimodal Scientific AI Assistant MVP and deploy on Vercel."

  // Open improvements
  const openImprovements = improvements
    .filter(i => i[3] === "proposed" || i[3] === "approved")
    .slice(0,3)
    .map(i => `[${i[3].toUpperCase()}] ${i[2]}`)
    .join("\n") || "None pending."

  // Cycle history summary (last 3 meetings)
  const cycleHistory = allMeetings.slice(0,3).map(m =>
    `Cycle #${m[1]}: ${m[2]?.slice(0,100)}`
  ).join("\n") || "No previous cycles."

  return {
    cycle,
    systemState:      state,
    myTasks,
    allTasks,
    recentLogs,
    lastDecisions,
    lastMeetingFocus,
    openImprovements,
    sprintGoal,
    cycleHistory,
    stability:        state["stability"] ?? "healthy",
    autonomousMode:   (state["autonomous_mode"] ?? "true") === "true",
  }
}

export function formatMemoryForAgent(mem: MemorySnapshot, agentId: string): string {
  const myTaskStr = mem.myTasks.length > 0
    ? mem.myTasks.map(t =>
        `  [${t.status.toUpperCase()}] [${t.priority.toUpperCase()}] ${t.title}${t.notes ? ` — ${t.notes}` : ""}`
      ).join("\n")
    : "  No specific tasks assigned — infer from sprint goal."

  const allTaskStr = mem.allTasks
    .filter(t => t.status !== "done")
    .map(t => `  ${t.agent}: [${t.status}] ${t.title}`)
    .join("\n") || "  None."

  return `
╔══════════════════════════════════════════════════════════╗
║  AUTONOMOUS OPERATION CONTEXT — CYCLE #${mem.cycle}
╚══════════════════════════════════════════════════════════╝

🎯 SPRINT GOAL:
${mem.sprintGoal}

📍 LAST MEETING FOCUS:
${mem.lastMeetingFocus}

✅ LAST DECISIONS (binding):
${mem.lastDecisions}

📋 YOUR CURRENT TASKS:
${myTaskStr}

👥 TEAM STATUS (other agents):
${allTaskStr}

🔧 OPEN IMPROVEMENTS:
${mem.openImprovements}

📜 RECENT ACTIVITY:
${mem.recentLogs}

📊 CYCLE HISTORY:
${mem.cycleHistory}

⚙️ SYSTEM: stability=${mem.stability} | autonomous=${mem.autonomousMode} | cycle=${mem.cycle}

══════════════════════════════════════════════════════════
INSTRUCTIONS:
1. Read your tasks above — execute the DOING ones first.
2. If all tasks are done, look at the sprint goal for new work.
3. DO NOT duplicate what other agents are doing (check team status).
4. Update task statuses in your output.
5. Propose 1 self-improvement per cycle.
══════════════════════════════════════════════════════════
`.trim()
}
