"use client"
import { useEffect, useState } from "react"
import Badge from "@/components/ui/Badge"
import { AGENTS } from "@/lib/agents/definitions"

interface Improvement {
  id: string; proposedBy: string; description: string
  status: string; validation: string; cycle: string
}
interface Stats { total: number; proposed: number; approved: number; implemented: number; rejected: number }

const AGENT_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(AGENTS).map(([id, def]) => [id, def.emoji])
)
const STATUS_BADGE: Record<string, "yellow"|"cyan"|"green"|"red"|"gray"> = {
  proposed:    "yellow",
  approved:    "cyan",
  implemented: "green",
  rejected:    "red",
}
const STATUS_FILTER = ["all", "proposed", "approved", "implemented", "rejected"]

export default function ImprovementsPage() {
  const [items, setItems]   = useState<Improvement[]>([])
  const [stats, setStats]   = useState<Stats>({ total:0, proposed:0, approved:0, implemented:0, rejected:0 })
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  const load = async (f = filter) => {
    setLoading(true)
    const url = f === "all" ? "/api/improvements" : `/api/improvements?status=${f}`
    const r = await fetch(url)
    const d = await r.json()
    setItems(d.improvements ?? [])
    setStats(d.stats ?? stats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleFilter = (f: string) => { setFilter(f); load(f) }

  const approve = async (id: string) => {
    await fetch("/api/improvements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, verdict: "approved", validation: "Manually approved via dashboard." }),
    })
    load(filter)
  }

  const reject = async (id: string) => {
    await fetch("/api/improvements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, verdict: "rejected", validation: "Manually rejected via dashboard." }),
    })
    load(filter)
  }

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Self-Improvement Loop</h1>
        <p className="text-xs text-slate-500 mt-0.5">Agent proposals reviewed by Chief Agent each cycle</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Proposed", value: stats.proposed,    color: "text-yellow-400" },
          { label: "Approved", value: stats.approved,    color: "text-cyan-400" },
          { label: "Done",     value: stats.implemented, color: "text-green-400" },
          { label: "Rejected", value: stats.rejected,    color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTER.map(f => (
          <button key={f} onClick={() => handleFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition capitalize
              ${filter === f
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                : "bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-20 rounded-xl bg-white/[0.02] animate-pulse"/>)}</div>
      ) : !items.length ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-2">💡</div>
          <div className="text-sm text-slate-400">No improvements {filter !== "all" ? `with status "${filter}"` : "yet"}</div>
          <div className="text-xs text-slate-600 mt-1">Agents propose 1 improvement per cycle automatically</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((imp, i) => (
            <div key={i} className="card p-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0 mt-0.5">
                  {AGENT_EMOJI[imp.proposedBy] ?? "🤖"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 capitalize">
                      {AGENTS[imp.proposedBy as keyof typeof AGENTS]?.name ?? imp.proposedBy}
                    </span>
                    <Badge v={STATUS_BADGE[imp.status] ?? "gray"}>{imp.status}</Badge>
                    {imp.cycle && <span className="text-[9px] text-slate-700">cycle {imp.cycle}</span>}
                    <span className="text-[9px] text-slate-700 ml-auto font-mono">{imp.id}</span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed">{imp.description}</p>
                  {imp.validation && (
                    <p className="text-[10px] text-slate-500 mt-1 italic">{imp.validation}</p>
                  )}
                </div>
              </div>

              {/* Manual approve/reject for proposed items */}
              {imp.status === "proposed" && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => approve(imp.id)}
                    className="px-2.5 py-1 text-[10px] rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition">
                    Approve
                  </button>
                  <button onClick={() => reject(imp.id)}
                    className="px-2.5 py-1 text-[10px] rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
