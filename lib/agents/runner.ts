/**
 * MEETING RUNNER — Chief Agent chairs the team meeting
 *
 * Meeting flow:
 *   1. Collect all agent reports from this cycle
 *   2. Build per-agent statements for debate context
 *   3. Run Chief Agent with full context + improvement queue
 *   4. Parse Chief's decisions, rulings, task assignments
 *   5. Apply task assignments to Sheets (Tasks tab)
 *   6. Process improvement approvals/rejections
 *   7. Advance sprint state (focus, stability, new goal if needed)
 *   8. Persist meeting to Sheets, send Telegram, commit to GitHub
 */

import { ask }                         from "@/lib/ai/claude"
import { AGENTS, type AgentId }        from "@/lib/agents/definitions"
import { getLogs, appendMeeting }      from "@/lib/memory/sheets"
import {
  setAgentTasks,
  setManyState,
  logDecision,
} from "@/lib/agents/sheets-ext"
import { processImprovements, formatImprovementsForChief } from "@/lib/agents/self-improve"
import { advanceSprint, getCycleState }                    from "@/lib/agents/cycle"
import { send as sendTelegram }        from "@/lib/memory/telegram"
import { commit }                      from "@/lib/memory/github"

interface MeetingResult {
  cycle:       number
  summary:     string
  priorities:  string[]
  decisions:   string
  nextFocus:   string
  tasks:       Array<{ agent: string; task: string; priority: string }>
  message:     string
  stability:   string
}

export async function runMeeting(cycle: number): Promise<MeetingResult> {
  // 1. Collect logs for this cycle window (last 30 min to capture all agents)
  const logs = await getLogs(60)
  const windowStart = cycle * 15 * 60 * 1000 - 5 * 60 * 1000  // 5 min grace
  const cycleLogs = logs.filter(r => {
    try { return new Date(r[0]).getTime() >= windowStart } catch { return false }
  })

  // 2. Build per-agent status report for debate context
  const agentReports = Object.entries(AGENTS)
    .filter(([id]) => id !== "chief")
    .map(([id, def]) => {
      const agentLogs = cycleLogs.filter(r => r[1] === def.name)
      const latest    = agentLogs[agentLogs.length - 1]
      if (!latest) {
        return `${def.emoji} ${def.name} [DID NOT RUN]\n  Status: Missing — no output this cycle.`
      }
      return [
        `${def.emoji} ${def.name}`,
        `  Task:   ${latest[2]?.slice(0, 100)}`,
        `  Result: ${latest[3]?.slice(0, 200)}`,
        latest[4] ? `  Issues: ${latest[4]?.slice(0, 100)}` : "  Issues: none",
      ].join("\n")
    }).join("\n\n")

  // 3. Get improvement queue for Chief review
  const improvementQueue = await formatImprovementsForChief()

  // 4. Get current sprint state
  const cycleState = await getCycleState()

  // 5. Build Chief Agent context
  const chiefContext = `
CYCLE #${cycle} | Sprint: ${cycleState.sprintId} | Cycle-in-sprint: ${cycleState.sprintCycle}

SPRINT GOAL: ${cycleState.sprintGoal}

━━━ AGENT REPORTS ━━━
${agentReports}

━━━ IMPROVEMENT QUEUE ━━━
${improvementQueue}

━━━ SYSTEM STATE ━━━
stability: ${cycleState.stability} | autonomous: ${cycleState.autonomousMode}

INSTRUCTIONS:
- Review each agent report critically. Call out vague or fabricated reports.
- Make binding decisions that advance the sprint goal.
- Assign specific, actionable tasks (not generic roles).
- Review all pending improvements — approve good ones, reject weak ones.
- Set next cycle focus.
Output valid JSON only.`.trim()

  // 6. Run Chief Agent (use high token budget for thorough meeting)
  const chiefPrompt = AGENTS.chief.prompt
  const rawChief = await ask(chiefPrompt, chiefContext, 2560)
    .catch(e => JSON.stringify({
      meeting_summary:  `Meeting error: ${String(e).slice(0, 100)}`,
      top_3_priorities: [],
      decisions:        [],
      agent_tasks:      {},
      improvement_reviews: [],
      next_cycle_focus: cycleState.sprintGoal,
      stability:        cycleState.stability,
      message_to_team:  "System error during meeting.",
    }))

  // 7. Parse Chief's output
  let plan: {
    meeting_summary?:     string
    top_3_priorities?:    string[]
    decisions?:           Array<{ decision: string; justification: string; impact?: string }>
    agent_tasks?:         Record<string, string>
    improvement_reviews?: Array<{ id: string; verdict: string; justification: string }>
    new_sprint_goal?:     string | null
    blockers?:            string[]
    next_cycle_focus?:    string
    stability?:           string
    message_to_team?:     string
  } = {}

  try {
    const m = rawChief.match(/\{[\s\S]*\}/)
    if (m) plan = JSON.parse(m[0])
  } catch {
    plan = {
      meeting_summary: rawChief.slice(0, 300),
      top_3_priorities: [],
      decisions: [],
      agent_tasks: {},
    }
  }

  const summary      = plan.meeting_summary    ?? "Meeting completed."
  const priorities   = plan.top_3_priorities   ?? []
  const decisionsArr = plan.decisions          ?? []
  const nextFocus    = plan.next_cycle_focus   ?? priorities[0] ?? cycleState.sprintGoal
  const assignments  = plan.agent_tasks        ?? {}
  const stability    = plan.stability          ?? cycleState.stability
  const message      = plan.message_to_team    ?? ""
  const reviewArr    = plan.improvement_reviews ?? []

  // 8. Format decisions string
  const decisionsStr = decisionsArr.map(d => `• ${d.decision}`).join("\n")

  // 9. Apply improvement reviews
  const approvals  = reviewArr.filter(r => r.verdict === "approved")
    .map(r => ({ id: r.id, validation: r.justification }))
  const rejections = reviewArr.filter(r => r.verdict === "rejected")
    .map(r => ({ id: r.id, reason: r.justification }))
  if (approvals.length || rejections.length) {
    await processImprovements({ approvals, rejections }).catch(() => {})
  }

  // 10. Build task list for Sheets and Telegram
  const tasks = Object.entries(assignments)
    .filter(([, t]) => t && String(t).length > 3)
    .map(([agent, task]) => ({ agent, task: String(task), priority: "high" }))

  // 11. Persist tasks to Sheets (rich format via setAgentTasks)
  const taskMap: Record<string, string> = {}
  for (const t of tasks) { taskMap[t.agent] = t.task }
  await setAgentTasks(cycle, taskMap, "high").catch(() => {})

  // 12. Log decisions to Decisions tab
  for (const d of decisionsArr.slice(0, 5)) {
    await logDecision({
      cycle,
      decision:      d.decision,
      justification: d.justification,
      impact:        d.impact ?? "medium",
    }).catch(() => {})
  }

  // 13. Advance sprint state
  await advanceSprint({
    newGoal:   plan.new_sprint_goal ?? undefined,
    newFocus:  nextFocus,
    stability,
  }).catch(() => {})

  // 14. Update system state
  await setManyState({
    last_meeting_cycle: String(cycle),
    stability,
  }).catch(() => {})

  // 15. Persist meeting to Sheets
  const tasksForSheets = tasks.map(t => ({ agent: t.agent, task: t.task, priority: t.priority, status: "todo" }))
  await appendMeeting({
    cycle,
    summary,
    decisions: decisionsStr,
    nextFocus,
    tasks: JSON.stringify(tasksForSheets),
  }).catch(e => console.error("[appendMeeting]", e))

  // 16. Telegram notification
  const taskLines = tasks.slice(0, 7)
    .map(t => `• *${AGENTS[t.agent as AgentId]?.name ?? t.agent}*: ${t.task.slice(0, 80)}`)
    .join("\n")

  await sendTelegram(`
*MATON AI — Cycle #${cycle} Meeting*
Sprint: ${cycleState.sprintId} | Cycle ${cycleState.sprintCycle}
*Stability: ${stability}*
━━━━━━━━━━━━━━━
*Top Priorities*
${priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")}

*Summary*
${summary.slice(0, 300)}

*Tasks Assigned*
${taskLines || "No tasks assigned."}

*Focus Next Cycle*
${nextFocus.slice(0, 150)}

_${new Date().toLocaleString()}_`.trim()).catch(() => {})

  // 17. GitHub commit
  const md = [
    `# Meeting — Cycle #${cycle}`,
    `> Sprint: ${cycleState.sprintId} | Stability: ${stability}`,
    "",
    `## Summary`,
    summary,
    "",
    `## Top Priorities`,
    priorities.map((p, i) => `${i + 1}. ${p}`).join("\n"),
    "",
    `## Decisions`,
    decisionsStr || "No formal decisions.",
    "",
    `## Team Tasks`,
    taskLines.replace(/\*/g, ""),
    "",
    `## Next Cycle Focus`,
    nextFocus,
    "",
    message ? `## Message to Team\n${message}` : "",
  ].filter(Boolean).join("\n")

  await commit(
    `meetings/cycle-${cycle}.md`,
    md,
    `[MATON AI] Meeting cycle #${cycle} — ${stability}`
  ).catch(() => {})

  return { cycle, summary, priorities, decisions: decisionsStr, nextFocus, tasks: tasksForSheets, message, stability }
}
