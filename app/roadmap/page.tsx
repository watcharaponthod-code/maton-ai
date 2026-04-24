"use client"
import { useEffect, useState } from "react"
import Badge from "@/components/ui/Badge"

interface Sprint {
  sprintId: string; goal: string; status: string
  startCycle: number; endCycle: number; notes: string
}
interface CycleState {
  cycle: number; sprintId: string; sprintGoal: string
  sprintCycle: number; totalCycles: number; autonomousMode: boolean; stability: string
}
interface TimelineEntry { cycle: string; ts: string; summary: string; focus: string }

const STATUS_STYLE: Record<string, string> = {
  active:    "border-cyan-500/30 bg-cyan-900/10",
  planned:   "border-slate-600/40 bg-slate-900/20",
  completed: "border-green-500/20 bg-green-900/10",
}
const STATUS_BADGE: Record<string, "cyan"|"gray"|"green"> = {
  active:"cyan", planned:"gray", completed:"green"
}
const STABILITY_COLOR: Record<string, string> = {
  healthy:  "text-green-400",
  watch:    "text-yellow-400",
  degraded: "text-red-400",
}

export default function RoadmapPage() {
  const [roadmap, setRoadmap]   = useState<Sprint[]>([])
  const [current, setCurrent]   = useState<CycleState | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [sysState, setSysState] = useState<Record<string,string>>({})
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    const [rd, cy] = await Promise.all([
      fetch("/api/roadmap").then(r => r.json()),
      fetch("/api/cycle").then(r => r.json()),
    ])
    setRoadmap(rd.roadmap ?? [])
    setCurrent(cy.current ?? null)
    setTimeline(cy.timeline ?? [])
    setSysState(cy.systemState ?? {})
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Roadmap</h1>
          <p className="text-xs text-slate-500 mt-0.5">Sprint goals, cycle history, system state</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 rounded-xl bg-white/[0.02] animate-pulse"/>)}</div>
      ) : (
        <>
          {/* Current state banner */}
          {current && (
            <div className="card p-4 border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"/>
                  <span className="text-sm font-semibold text-white">Current: {current.sprintId}</span>
                  <Badge v="cyan">Active</Badge>
                </div>
                <div className={`text-xs font-medium ${STABILITY_COLOR[current.stability] ?? "text-slate-400"}`}>
                  {current.stability}
                </div>
              </div>

              <div className="text-xs text-cyan-200 bg-cyan-500/5 border border-cyan-500/15 rounded-lg px-3 py-2">
                {current.sprintGoal}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Current Cycle", value: current.cycle },
                  { label: "Sprint Cycle", value: `#${current.sprintCycle}` },
                  { label: "Total Cycles", value: current.totalCycles },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/[0.02] rounded-lg py-2">
                    <div className="text-sm font-bold text-white">{stat.value}</div>
                    <div className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {sysState.nextFocus && (
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Next Focus</div>
                  <div className="text-xs text-slate-300">{sysState.nextFocus}</div>
                </div>
              )}

              <div className="flex gap-2 text-[10px]">
                <div className={`px-2 py-1 rounded ${current.autonomousMode ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {current.autonomousMode ? "Autonomous ON" : "Autonomous OFF"}
                </div>
              </div>
            </div>
          )}

          {/* Sprints list */}
          <div className="space-y-3">
            <h2 className="text-xs text-slate-500 uppercase tracking-widest px-1">Sprint History</h2>
            {!roadmap.length ? (
              <div className="card p-8 text-center">
                <div className="text-3xl mb-2">🗺️</div>
                <div className="text-sm text-slate-400">No sprints yet</div>
                <div className="text-xs text-slate-600 mt-1">Sprints are created automatically on first cron run</div>
              </div>
            ) : roadmap.map((s, i) => (
              <div key={i} className={`card p-4 space-y-2 ${STATUS_STYLE[s.status] ?? STATUS_STYLE.planned}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">{s.sprintId}</span>
                  <Badge v={STATUS_BADGE[s.status] ?? "gray"}>{s.status}</Badge>
                  <span className="ml-auto text-[10px] text-slate-600">
                    cycles {s.startCycle} → {s.endCycle}
                  </span>
                </div>
                <div className="text-xs text-slate-200">{s.goal}</div>
                {s.notes && <div className="text-[10px] text-slate-600">{s.notes}</div>}
              </div>
            ))}
          </div>

          {/* Cycle timeline */}
          {timeline.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs text-slate-500 uppercase tracking-widest px-1">Meeting Timeline</h2>
              <div className="space-y-1.5">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex gap-3 items-start bg-white/[0.02] rounded-lg px-3 py-2">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1"/>
                      {i < timeline.length - 1 && <div className="w-px h-full bg-slate-800 grow"/>}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500">#{entry.cycle}</span>
                        <span className="text-[9px] text-slate-700">
                          {entry.ts ? new Date(entry.ts).toLocaleString() : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 line-clamp-1">{entry.summary}</div>
                      {entry.focus && <div className="text-[10px] text-cyan-600 line-clamp-1">{entry.focus}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
