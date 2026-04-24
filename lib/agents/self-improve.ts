/**
 * SELF-IMPROVEMENT LOOP
 *
 * Each agent proposes 1 improvement per cycle.
 * Chief Agent reviews and approves/rejects.
 * Approved improvements are logged and tracked.
 *
 * Flow:
 *   Agent proposes → stored as "proposed"
 *   Chief approves → stored as "approved" with validation note
 *   Coding agent implements → stored as "implemented"
 */

import {
  getImprovements,
  proposeImprovement,
  approveImprovement,
} from "@/lib/agents/sheets-ext"

export interface Improvement {
  id:          string
  proposedBy:  string
  description: string
  status:      "proposed" | "approved" | "rejected" | "implemented"
  validation:  string
  cycle:       string
}

// ── Parse improvements from raw sheet rows ─────────────────────────────────
export function parseImprovements(rows: string[][]): Improvement[] {
  return rows.map(r => ({
    id:          r[0] ?? "",
    proposedBy:  r[1] ?? "",
    description: r[2] ?? "",
    status:      (r[3] ?? "proposed") as Improvement["status"],
    validation:  r[4] ?? "",
    cycle:       r[5] ?? "",
  }))
}

// ── Agent proposes an improvement (called from base-agent) ─────────────────
export async function submitImprovement(params: {
  agentId:     string
  description: string
  cycle:       number
}) {
  if (!params.description || params.description.length < 10) return
  const id = `imp-${params.agentId}-c${params.cycle}`
  await proposeImprovement({
    id,
    agent:       params.agentId,
    description: params.description,
    cycle:       params.cycle,
  })
}

// ── Chief Agent reviews pending improvements (called from runner) ──────────
export async function processImprovements(params: {
  approvals: Array<{ id: string; validation: string }>
  rejections: Array<{ id: string; reason: string }>
}) {
  await Promise.all([
    ...params.approvals.map(a => approveImprovement(a.id, a.validation)),
    ...params.rejections.map(r => approveImprovement(r.id, `REJECTED: ${r.reason}`)),
  ])
}

// ── Get open improvements summary for agent context ────────────────────────
export async function getOpenImprovementsSummary(): Promise<string> {
  const rows = await getImprovements()
  const items = parseImprovements(rows)
  const open = items.filter(i => i.status === "proposed" || i.status === "approved")
  if (!open.length) return "No open improvements."
  return open.slice(0, 5).map(i =>
    `[${i.status.toUpperCase()}] ${i.proposedBy}: ${i.description}`
  ).join("\n")
}

// ── Format improvements for Chief Agent review prompt ─────────────────────
export async function formatImprovementsForChief(): Promise<string> {
  const rows = await getImprovements()
  const items = parseImprovements(rows)
  const pending = items.filter(i => i.status === "proposed")
  const approved = items.filter(i => i.status === "approved")
  const implemented = items.filter(i => i.status === "implemented").slice(-3)

  const parts: string[] = []
  if (pending.length) {
    parts.push("PENDING REVIEW:\n" + pending.map(i =>
      `  [${i.id}] by ${i.proposedBy}: ${i.description}`
    ).join("\n"))
  }
  if (approved.length) {
    parts.push("APPROVED (awaiting impl):\n" + approved.map(i =>
      `  [${i.id}] ${i.description} — ${i.validation}`
    ).join("\n"))
  }
  if (implemented.length) {
    parts.push("RECENTLY IMPLEMENTED:\n" + implemented.map(i =>
      `  [${i.id}] ${i.description}`
    ).join("\n"))
  }
  return parts.join("\n\n") || "No improvements in queue."
}

// ── Mark improvement as implemented (called by coding agent) ──────────────
export async function markImplemented(id: string, notes: string) {
  // Reuse approveImprovement with a special validation note
  await approveImprovement(id, `IMPLEMENTED: ${notes}`)
  // Then update status via direct upsert (handled in sheets-ext update)
  // We set validation and status to implemented
  const GW    = "https://gateway.maton.ai/google-sheets"
  const MATON = () => process.env.MATON_API_KEY!
  const SHEET = () => process.env.GOOGLE_SHEET_ID!

  try {
    const r = await fetch(`${GW}/v4/spreadsheets/${SHEET()}/values/Improvements!A:F`, {
      headers: { Authorization: `Bearer ${MATON()}` },
    })
    const d = await r.json()
    const rows = (d.values ?? []) as string[][]
    const idx  = rows.findIndex(row => row[0] === id)
    if (idx >= 0) {
      await fetch(
        `${GW}/v4/spreadsheets/${SHEET()}/values/Improvements!D${idx+1}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${MATON()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [["implemented"]] }),
        }
      )
    }
  } catch (e) { console.error("[markImplemented]", e) }
}
