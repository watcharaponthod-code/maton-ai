"use client"
import { useEffect, useState, useCallback } from "react"
import { RefreshCw, Play, TrendingUp, Activity, Database, Cpu } from "lucide-react"
import Badge from "@/components/ui/Badge"
import { formatDistanceToNow } from "date-fns"

interface AgentStatus { id:string; name:string; emoji:string; color:string; status:"active"|"idle"|"waiting"; lastTask:string; lastResult:string; issues:string; minAgo:number|null; currentTask:string|null }
interface FeedItem    { ts:string; agent:string; task:string; result:string; issues:string }
interface State       { agents:AgentStatus[]; feed:FeedItem[]; meeting:{ ts:string; cycle:string; summary:string; decisions:string; nextFocus:string }|null; health:"healthy"|"degraded"; totalRuns:number; ts:string }

const DOT: Record<string, string> = { active:"dot dot-active", idle:"dot dot-idle", waiting:"dot dot-waiting" }

export default function Dashboard() {
  const [state, setState]   = useState<State|null>(null)
  const [running, setRun]   = useState<Record<string,boolean>>({})
  const [lastRefresh, setLR] = useState<Date|null>(null)

  const load = useCallback(async () => {
    const r = await fetch("/api/state").catch(() => null)
    if (r?.ok) { setState(await r.json()); setLR(new Date()) }
  }, [])

  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id) }, [load])

  async function trigger(type: "agent"|"meeting", id?: string) {
    const key = id ?? "meeting"
    setRun(p => ({...p, [key]:true}))
    try {
      if (type === "meeting") await fetch("/api/meeting", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
      else await fetch(`/api/agents/${id}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
      await load()
    } finally { setRun(p => ({...p, [key]:false})) }
  }

  const active = state?.agents.filter(a => a.status === "active").length ?? 0

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Operations Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {lastRefresh ? `Updated ${formatDistanceToNow(lastRefresh, {addSuffix:true})}` : "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => trigger("meeting")} disabled={running.meeting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/20 transition disabled:opacity-40">
            <Play size={11}/>{running.meeting ? "Meeting…" : "Run Meeting"}
          </button>
          <button onClick={load} className="w-8 h-8 rounded-lg border border-[#1a2840] flex items-center justify-center text-slate-500 hover:text-slate-300 transition">
            <RefreshCw size={13}/>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon:Activity,    label:"System",   value: state?.health === "healthy" ? "Healthy" : "Degraded", color: state?.health === "healthy" ? "text-green-400" : "text-yellow-400" },
          { icon:Cpu,         label:"Active Agents", value:`${active}/8`,         color:"text-cyan-400"  },
          { icon:TrendingUp,  label:"Total Runs",    value:String(state?.totalRuns ?? 0), color:"text-purple-400" },
          { icon:Database,    label:"Knowledge",     value:"193 papers",          color:"text-blue-400"  },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={13} className="text-slate-500"/>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</span>
            </div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Last meeting banner */}
      {state?.meeting && (
        <div className="card p-4 border-amber-500/15 glow-amber">
          <div className="flex gap-3">
            <span className="text-xl">👑</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-amber-300">Latest Meeting — Cycle #{state.meeting.cycle}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{state.meeting.summary}</p>
              {state.meeting.nextFocus && <p className="text-xs mt-1"><span className="text-slate-600">Next: </span><span className="text-cyan-400">{state.meeting.nextFocus}</span></p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Agents */}
        <div className="lg:col-span-2 space-y-2">
          <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Agent Status</div>
          <div className="grid grid-cols-2 gap-2">
            {(state?.agents ?? Array.from({length:8}).map((_,i) => ({id:`_${i}`,name:"…",emoji:"🤖",color:"",status:"waiting" as const,lastTask:"",lastResult:"",issues:"",minAgo:null,currentTask:null}))).map(a => (
              <div key={a.id} className={`card p-3 transition hover:border-slate-700 ${a.status==="active" ? "border-cyan-500/20 glow-cyan" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{a.emoji}</span>
                    <div>
                      <div className="text-xs font-medium text-white">{a.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={DOT[a.status]}/>
                        <span className="text-[9px] text-slate-500 capitalize">{a.status}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => trigger("agent", a.id)} disabled={running[a.id]}
                    className="text-[9px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 hover:bg-cyan-500/20 disabled:opacity-40 transition">
                    {running[a.id] ? "…" : "▶"}
                  </button>
                </div>
                {a.currentTask && <div className="text-[10px] text-slate-400 line-clamp-1 mb-1">📌 {a.currentTask}</div>}
                <div className="text-[10px] text-slate-500 line-clamp-2">{a.lastTask || "Not yet run"}</div>
                {a.issues && <div className="text-[9px] text-red-400 mt-1 line-clamp-1">⚠ {a.issues}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-2">
          <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Live Activity</div>
          <div className="card p-3 space-y-2.5 max-h-[520px] overflow-y-auto">
            {!state?.feed.length && <div className="text-xs text-slate-600 py-8 text-center">Waiting for agents…</div>}
            {state?.feed.map((item, i) => (
              <div key={i} className="flex gap-2 text-xs animate-fade-in">
                <div className="w-1 shrink-0 mt-1 rounded-full bg-cyan-500/30"/>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-300 font-medium text-[11px]">{item.agent}</span>
                    <span className="text-slate-600 text-[9px]">{item.ts ? formatDistanceToNow(new Date(item.ts), {addSuffix:true}) : ""}</span>
                  </div>
                  <div className="text-slate-500 text-[10px] line-clamp-2 mt-0.5">{item.task}</div>
                  {item.issues && <div className="text-red-400 text-[9px] mt-0.5">⚠ {item.issues}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
