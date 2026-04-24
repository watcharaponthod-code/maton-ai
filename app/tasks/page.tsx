"use client"
import { useEffect, useState } from "react"
import Badge from "@/components/ui/Badge"
import { AGENTS, AGENT_ORDER } from "@/lib/agents/definitions"

interface Task {
  agent: string; taskId: string; title: string
  status: string; priority: string; notes: string; cycle: string
}
interface Kanban { todo: Task[]; doing: Task[]; blocked: Task[]; done: Task[] }

const PRIORITY_BADGE: Record<string, "red"|"yellow"|"cyan"|"gray"> = {
  critical:"red", high:"yellow", medium:"cyan", low:"gray"
}
const STATUS_COLOR: Record<string, string> = {
  todo:    "border-slate-700 bg-slate-800/40",
  doing:   "border-cyan-500/30 bg-cyan-900/10",
  blocked: "border-red-500/30 bg-red-900/10",
  done:    "border-green-500/20 bg-green-900/10",
}
const STATUS_DOT: Record<string, string> = {
  todo: "bg-slate-500", doing: "bg-cyan-400 animate-pulse",
  blocked: "bg-red-400", done: "bg-green-400",
}

const AGENT_EMOJI: Record<string, string> = Object.fromEntries(
  AGENT_ORDER.map(id => [id, AGENTS[id].emoji])
)

export default function TasksPage() {
  const [kanban, setKanban]   = useState<Kanban>({ todo: [], doing: [], blocked: [], done: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<string>("all")

  const load = async () => {
    const r = await fetch("/api/tasks")
    const d = await r.json()
    setKanban(d.kanban ?? { todo: [], doing: [], blocked: [], done: [] })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const cols: Array<{ key: keyof Kanban; label: string; dot: string }> = [
    { key: "doing",   label: "Doing",   dot: STATUS_DOT.doing },
    { key: "todo",    label: "Todo",    dot: STATUS_DOT.todo },
    { key: "blocked", label: "Blocked", dot: STATUS_DOT.blocked },
    { key: "done",    label: "Done",    dot: STATUS_DOT.done },
  ]

  const agents = ["all", ...AGENT_ORDER]
  const filterTasks = (tasks: Task[]) =>
    filter === "all" ? tasks : tasks.filter(t => t.agent === filter)

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Task Board</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live task status across all agents</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition">
          Refresh
        </button>
      </div>

      {/* Agent filter */}
      <div className="flex gap-2 flex-wrap">
        {agents.map(id => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition
              ${filter === id
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                : "bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300"}`}>
            {id === "all" ? "All Agents" : `${AGENT_EMOJI[id] ?? "🤖"} ${AGENTS[id as keyof typeof AGENTS]?.name.replace(" Agent","").replace(" Hunter","") ?? id}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-64 rounded-xl bg-white/[0.02] animate-pulse"/>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cols.map(col => {
            const tasks = filterTasks(kanban[col.key])
            return (
              <div key={col.key} className="space-y-2">
                {/* Column header */}
                <div className="flex items-center gap-2 px-1">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`}/>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{col.label}</span>
                  <span className="ml-auto text-[10px] text-slate-600 bg-white/5 rounded px-1.5 py-0.5">{tasks.length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[4rem]">
                  {tasks.length === 0 ? (
                    <div className="text-[10px] text-slate-700 px-2 py-4 text-center border border-dashed border-slate-800 rounded-lg">
                      Empty
                    </div>
                  ) : tasks.map((t, i) => (
                    <div key={i} className={`rounded-lg border p-3 space-y-2 ${STATUS_COLOR[t.status] ?? STATUS_COLOR.todo}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{AGENT_EMOJI[t.agent] ?? "🤖"}</span>
                        <span className="text-[10px] text-slate-500 capitalize">
                          {AGENTS[t.agent as keyof typeof AGENTS]?.name.replace(" Agent","").replace(" Hunter","") ?? t.agent}
                        </span>
                        <span className="ml-auto">
                          <Badge v={PRIORITY_BADGE[t.priority] ?? "gray"}>{t.priority}</Badge>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-snug line-clamp-3">{t.title}</p>
                      {t.notes && (
                        <p className="text-[10px] text-slate-600 line-clamp-2">{t.notes}</p>
                      )}
                      {t.cycle && (
                        <p className="text-[9px] text-slate-700">cycle {t.cycle}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
