/**
 * CYCLE & ROADMAP SYSTEM
 *
 * Manages sprint state, cycle counter, roadmap goals.
 * All state persisted in Google Sheets: SystemState + Roadmap tabs.
 *
 * Cycle = one 15-minute cron interval.
 * Sprint = N cycles focused on one goal.
 */

import {
  getSystemState,
  setSystemState,
  setManyState,
} from "@/lib/agents/sheets-ext"

const GW    = "https://gateway.maton.ai/google-sheets"
const MATON = () => process.env.MATON_API_KEY!
const SHEET = () => process.env.GOOGLE_SHEET_ID!

async function req(method: string, path: string, body?: object) {
  const r = await fetch(`${GW}${path}`, {
    method,
    headers: { Authorization: `Bearer ${MATON()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`Sheets ${method} ${path} → ${r.status}`)
  return r.json()
}

export interface Sprint {
  sprintId:  string
  goal:      string
  status:    "active" | "completed" | "planned"
  startCycle: number
  endCycle:   number
  notes:     string
}

export interface CycleState {
  cycle:          number
  sprintId:       string
  sprintGoal:     string
  sprintCycle:    number  // cycles into current sprint
  totalCycles:    number
  autonomousMode: boolean
  stability:      string
}

// ── Read current cycle state ───────────────────────────────────────────────
export async function getCycleState(): Promise<CycleState> {
  const state = await getSystemState()
  const cycle = Math.floor(Date.now() / (15 * 60 * 1000))
  const sprintStart = parseInt(state["sprint_start_cycle"] ?? String(cycle), 10)

  return {
    cycle,
    sprintId:       state["sprint_id"]       ?? "sprint-1",
    sprintGoal:     state["sprint_goal"]      ?? "Build Multimodal Scientific AI Assistant MVP and deploy on Vercel.",
    sprintCycle:    cycle - sprintStart,
    totalCycles:    parseInt(state["total_cycles"] ?? "0", 10),
    autonomousMode: (state["autonomous_mode"] ?? "true") === "true",
    stability:      state["stability"] ?? "healthy",
  }
}

// ── Initialize first sprint (called on first cron run) ────────────────────
export async function initSprintIfNeeded(): Promise<boolean> {
  const state = await getSystemState()
  if (state["sprint_id"]) return false  // already initialized

  const cycle = Math.floor(Date.now() / (15 * 60 * 1000))
  await setManyState({
    sprint_id:          "sprint-1",
    sprint_goal:        "Build Multimodal Scientific AI Assistant MVP and deploy on Vercel.",
    sprint_start_cycle: String(cycle),
    total_cycles:       "0",
    autonomous_mode:    "true",
    stability:          "healthy",
    next_cycle_focus:   "Establish baseline: verify RAG, protein lookup, and chat UI are operational.",
    phase:              "bootstrap",
  })

  // Write to Roadmap tab
  await upsertRoadmapEntry({
    sprintId:   "sprint-1",
    goal:       "Build Multimodal Scientific AI Assistant MVP and deploy on Vercel.",
    status:     "active",
    startCycle: cycle,
    endCycle:   cycle + 96,  // ~24 hours of 15-min cycles
    notes:      "Auto-initialized by cron bootstrap.",
  })

  return true
}

// ── Increment cycle counter ────────────────────────────────────────────────
export async function incrementCycleCounter(): Promise<number> {
  const state = await getSystemState()
  const total = parseInt(state["total_cycles"] ?? "0", 10) + 1
  await setSystemState("total_cycles", String(total))
  return total
}

// ── Advance sprint (called by Chief Agent after meeting) ──────────────────
export async function advanceSprint(params: {
  newGoal?:   string
  newFocus?:  string
  stability?: string
}) {
  const updates: Record<string, string> = {}
  if (params.newFocus)   updates["next_cycle_focus"] = params.newFocus
  if (params.stability)  updates["stability"]        = params.stability
  if (params.newGoal) {
    const cycle = Math.floor(Date.now() / (15 * 60 * 1000))
    const state = await getSystemState()
    const sprintNum = parseInt((state["sprint_id"] ?? "sprint-0").replace("sprint-", ""), 10) + 1
    updates["sprint_id"]          = `sprint-${sprintNum}`
    updates["sprint_goal"]        = params.newGoal
    updates["sprint_start_cycle"] = String(cycle)

    await upsertRoadmapEntry({
      sprintId:   `sprint-${sprintNum}`,
      goal:       params.newGoal,
      status:     "active",
      startCycle: cycle,
      endCycle:   cycle + 96,
      notes:      `Promoted from Chief Agent decision at cycle ${cycle}.`,
    })
  }
  if (Object.keys(updates).length) await setManyState(updates)
}

// ── Roadmap CRUD ───────────────────────────────────────────────────────────
// Columns: A=sprint_id, B=goal, C=status, D=start_cycle, E=end_cycle, F=notes
export async function upsertRoadmapEntry(sprint: Omit<Sprint, "status"> & { status: string }) {
  try {
    const d    = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Roadmap!A:F`)
    const rows = (d.values ?? []) as string[][]
    const idx  = rows.findIndex(r => r[0] === sprint.sprintId)
    const row  = [sprint.sprintId, sprint.goal, sprint.status, sprint.startCycle, sprint.endCycle, sprint.notes]

    if (idx >= 0) {
      await req("PUT",
        `/v4/spreadsheets/${SHEET()}/values/Roadmap!A${idx+1}:F${idx+1}?valueInputOption=USER_ENTERED`,
        { values: [row] })
    } else {
      await req("POST",
        `/v4/spreadsheets/${SHEET()}/values/Roadmap!A:F:append?valueInputOption=USER_ENTERED`,
        { values: [row] })
    }
  } catch (e) { console.error("[upsertRoadmap]", e) }
}

export async function getRoadmap(): Promise<Sprint[]> {
  try {
    const d    = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Roadmap!A:F`)
    const rows = (d.values ?? []) as string[][]
    return rows.slice(1).map(r => ({
      sprintId:   r[0] ?? "",
      goal:       r[1] ?? "",
      status:     (r[2] ?? "planned") as Sprint["status"],
      startCycle: parseInt(r[3] ?? "0", 10),
      endCycle:   parseInt(r[4] ?? "0", 10),
      notes:      r[5] ?? "",
    }))
  } catch { return [] }
}

export async function completeSprintEntry(sprintId: string, notes: string) {
  try {
    const d    = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Roadmap!A:F`)
    const rows = (d.values ?? []) as string[][]
    const idx  = rows.findIndex(r => r[0] === sprintId)
    if (idx >= 0) {
      await req("PUT",
        `/v4/spreadsheets/${SHEET()}/values/Roadmap!C${idx+1}:F${idx+1}?valueInputOption=USER_ENTERED`,
        { values: [["completed", rows[idx][3], rows[idx][4], notes]] })
    }
  } catch (e) { console.error("[completeSprintEntry]", e) }
}
