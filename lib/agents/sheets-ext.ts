/**
 * Extended Google Sheets operations for the autonomous agent system.
 * Handles: SystemState, Decisions, Improvements, Roadmap, detailed Tasks.
 */

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

// ── SystemState (key-value store) ─────────────────────────────────────────
export async function getSystemState(): Promise<Record<string, string>> {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/SystemState!A:B`)
    const rows = (d.values ?? []) as string[][]
    return Object.fromEntries(rows.map(r => [r[0] ?? "", r[1] ?? ""]))
  } catch { return {} }
}

export async function setSystemState(key: string, value: string) {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/SystemState!A:B`)
    const rows = (d.values ?? []) as string[][]
    const idx  = rows.findIndex(r => r[0] === key)
    if (idx >= 0) {
      await req("PUT", `/v4/spreadsheets/${SHEET()}/values/SystemState!A${idx+1}:B${idx+1}?valueInputOption=USER_ENTERED`,
        { values: [[key, value]] })
    } else {
      await req("POST", `/v4/spreadsheets/${SHEET()}/values/SystemState!A:B:append?valueInputOption=USER_ENTERED`,
        { values: [[key, value]] })
    }
  } catch (e) { console.error("[setState]", e) }
}

export async function setManyState(kv: Record<string, string>) {
  for (const [k, v] of Object.entries(kv)) {
    await setSystemState(k, v).catch(() => {})
  }
}

// ── Tasks (rich) ──────────────────────────────────────────────────────────
// Columns: A=agent, B=task_id, C=title, D=status, E=priority, F=notes, G=cycle
export async function upsertTask(task: {
  agent:string; taskId:string; title:string; status:string; priority:string; notes:string; cycle:number
}) {
  try {
    const d   = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Tasks!A:G`)
    const rows = (d.values ?? []) as string[][]
    const idx  = rows.findIndex(r => r[1] === task.taskId)
    const row  = [task.agent, task.taskId, task.title, task.status, task.priority, task.notes, task.cycle]
    if (idx >= 0) {
      await req("PUT", `/v4/spreadsheets/${SHEET()}/values/Tasks!A${idx+1}:G${idx+1}?valueInputOption=USER_ENTERED`,
        { values: [row] })
    } else {
      await req("POST", `/v4/spreadsheets/${SHEET()}/values/Tasks!A:G:append?valueInputOption=USER_ENTERED`,
        { values: [row] })
    }
  } catch (e) { console.error("[upsertTask]", e) }
}

export async function updateTaskStatus(taskId: string, status: string, notes?: string) {
  try {
    const d   = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Tasks!A:G`)
    const rows = (d.values ?? []) as string[][]
    const idx  = rows.findIndex(r => r[1] === taskId)
    if (idx >= 0) {
      await req("PUT", `/v4/spreadsheets/${SHEET()}/values/Tasks!D${idx+1}?valueInputOption=USER_ENTERED`,
        { values: [[status]] })
      if (notes) {
        await req("PUT", `/v4/spreadsheets/${SHEET()}/values/Tasks!F${idx+1}?valueInputOption=USER_ENTERED`,
          { values: [[notes]] })
      }
    }
  } catch (e) { console.error("[updateTaskStatus]", e) }
}

export async function setAgentTasks(cycle: number, assignments: Record<string, string>, priority = "high") {
  for (const [agent, title] of Object.entries(assignments)) {
    if (!title || title.length < 3) continue
    await upsertTask({
      agent,
      taskId:   `${agent}-${cycle}`,
      title,
      status:   "todo",
      priority,
      notes:    "",
      cycle,
    })
  }
}

// ── Decisions log ─────────────────────────────────────────────────────────
// Columns: A=timestamp, B=cycle, C=decision, D=justification, E=impact, F=status
export async function logDecision(params: {
  cycle:number; decision:string; justification:string; impact:string
}) {
  await req("POST", `/v4/spreadsheets/${SHEET()}/values/Decisions!A:F:append?valueInputOption=USER_ENTERED`, {
    values: [[new Date().toISOString(), params.cycle, params.decision, params.justification, params.impact, "active"]],
  })
}

export async function getDecisions(limit = 10): Promise<string[][]> {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Decisions!A:F`)
    return ((d.values ?? []) as string[][]).slice(1).slice(-limit)
  } catch { return [] }
}

// ── Improvements queue ────────────────────────────────────────────────────
// Columns: A=id, B=proposed_by, C=description, D=status, E=validation, F=cycle
export async function proposeImprovement(params: {
  id:string; agent:string; description:string; cycle:number
}) {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Improvements!A:F`)
    const rows = (d.values ?? []) as string[][]
    if (rows.some(r => r[0] === params.id)) return // already exists
    await req("POST", `/v4/spreadsheets/${SHEET()}/values/Improvements!A:F:append?valueInputOption=USER_ENTERED`, {
      values: [[params.id, params.agent, params.description, "proposed", "", params.cycle]],
    })
  } catch (e) { console.error("[proposeImprovement]", e) }
}

export async function getImprovements(): Promise<string[][]> {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Improvements!A:F`)
    return ((d.values ?? []) as string[][]).slice(1)
  } catch { return [] }
}

export async function approveImprovement(id: string, validation: string) {
  try {
    const d   = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Improvements!A:F`)
    const rows = (d.values ?? []) as string[][]
    const idx  = rows.findIndex(r => r[0] === id)
    if (idx >= 0) {
      await req("PUT", `/v4/spreadsheets/${SHEET()}/values/Improvements!D${idx+1}:E${idx+1}?valueInputOption=USER_ENTERED`,
        { values: [["approved", validation]] })
    }
  } catch {}
}

// ── Ensure all tabs exist ─────────────────────────────────────────────────
export async function ensureAllTabs() {
  const NEEDED = {
    Logs:        ["timestamp","agent","task","result","issues","next_action"],
    Meetings:    ["timestamp","cycle","summary","decisions","next_focus","tasks_json"],
    Tasks:       ["agent","task_id","title","status","priority","notes","cycle"],
    SystemState: ["key","value"],
    Decisions:   ["timestamp","cycle","decision","justification","impact","status"],
    Improvements:["id","proposed_by","description","status","validation","cycle"],
    Roadmap:     ["sprint_id","goal","status","start","end","notes"],
  }
  try {
    const info   = await req("GET", `/v4/spreadsheets/${SHEET()}`)
    const exist: string[] = (info.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title)
    const toAdd  = Object.keys(NEEDED).filter(n => !exist.includes(n))
    if (!toAdd.length) return
    await req("POST", `/v4/spreadsheets/${SHEET()}:batchUpdate`, {
      requests: toAdd.map(title => ({ addSheet: { properties: { title } } })),
    })
    for (const tab of toAdd) {
      await req("POST", `/v4/spreadsheets/${SHEET()}/values/${tab}!A1:append?valueInputOption=USER_ENTERED`, {
        values: [NEEDED[tab as keyof typeof NEEDED]],
      })
    }
  } catch (e) { console.error("[ensureAllTabs]", e) }
}
