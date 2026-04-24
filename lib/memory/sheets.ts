const GW    = "https://gateway.maton.ai/google-sheets"
const MATON = () => process.env.MATON_API_KEY!
const SHEET = () => process.env.GOOGLE_SHEET_ID!

async function req(method: string, path: string, body?: object) {
  const r = await fetch(`${GW}${path}`, {
    method,
    headers: { Authorization: `Bearer ${MATON()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`Sheets ${method} → ${r.status}`)
  return r.json()
}

export async function appendLog(row: {
  agent:string; task:string; result:string; issues:string; next_action:string
}) {
  const ts = new Date().toISOString()
  await req("POST", `/v4/spreadsheets/${SHEET()}/values/Logs!A:F:append?valueInputOption=USER_ENTERED`, {
    values: [[ts, row.agent, row.task, row.result, row.issues, row.next_action]],
  })
}

export async function appendMeeting(row: {
  cycle:number; summary:string; decisions:string; nextFocus:string; tasks:string
}) {
  await req("POST", `/v4/spreadsheets/${SHEET()}/values/Meetings!A:F:append?valueInputOption=USER_ENTERED`, {
    values: [[new Date().toISOString(), row.cycle, row.summary, row.decisions, row.nextFocus, row.tasks]],
  })
}

export async function setTasks(tasks: { agent:string; task:string; priority:string; status:string }[]) {
  await req("POST", `/v4/spreadsheets/${SHEET()}/values/Tasks!A:D:clear`, {})
  if (!tasks.length) return
  await req("POST", `/v4/spreadsheets/${SHEET()}/values/Tasks!A1:append?valueInputOption=USER_ENTERED`, {
    values: [["agent","task","priority","status"], ...tasks.map(t => [t.agent,t.task,t.priority,t.status])],
  })
}

export async function getLogs(limit = 30): Promise<string[][]> {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Logs!A:F`)
    return ((d.values ?? []) as string[][]).slice(-limit)
  } catch { return [] }
}

export async function getTasks(): Promise<string[][]> {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Tasks!A:G`)
    return ((d.values ?? []) as string[][]).slice(1)
  } catch { return [] }
}

export async function getLastMeeting(): Promise<string[] | null> {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Meetings!A:F`)
    const rows = (d.values ?? []) as string[][]
    return rows.length > 1 ? rows[rows.length - 1] : null
  } catch { return null }
}

export async function getAllMeetings(limit = 10): Promise<string[][]> {
  try {
    const d = await req("GET", `/v4/spreadsheets/${SHEET()}/values/Meetings!A:F`)
    return ((d.values ?? []) as string[][]).slice(1).slice(-limit)
  } catch { return [] }
}

export async function ensureTabs() {
  try {
    const info = await req("GET", `/v4/spreadsheets/${SHEET()}`)
    const exist: string[] = (info.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title)
    const need = ["Logs","Meetings","Tasks"]
    const add  = need.filter(n => !exist.includes(n))
    if (!add.length) return
    await req("POST", `/v4/spreadsheets/${SHEET()}:batchUpdate`, {
      requests: add.map(title => ({ addSheet: { properties: { title } } })),
    })
    const headers: Record<string,string[]> = {
      Logs:     ["timestamp","agent","task","result","issues","next_action"],
      Meetings: ["timestamp","cycle","summary","decisions","next_focus","tasks_json"],
      Tasks:    ["agent","task","priority","status"],
    }
    for (const tab of add) {
      await req("POST", `/v4/spreadsheets/${SHEET()}/values/${tab}!A1:append?valueInputOption=USER_ENTERED`, {
        values: [headers[tab]],
      })
    }
  } catch (e) { console.error("ensureTabs:", e) }
}
