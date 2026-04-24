"use client"
import { useEffect, useState } from "react"
import { AGENTS, AGENT_ORDER } from "@/lib/agents/definitions"
import Badge from "@/components/ui/Badge"
import { Play, ChevronDown, ChevronUp } from "lucide-react"

interface AgentLog { ts:string; agent:string; task:string; result:string; issues:string }

const TIER_BADGE: Record<string, "amber"|"cyan"|"gray"> = { chief:"amber", senior:"cyan", standard:"gray" }

export default function AgentsPage() {
  const [logs, setLogs]         = useState<AgentLog[]>([])
  const [running, setRunning]   = useState<Record<string,boolean>>({})
  const [expanded, setExpanded] = useState<Record<string,boolean>>({})
  const [output, setOutput]     = useState<Record<string,unknown>>({})

  useEffect(() => {
    fetch("/api/state").then(r=>r.json()).then(d => setLogs(d.feed ?? []))
  }, [])

  async function run(id: string) {
    setRunning(p=>({...p,[id]:true})); setExpanded(p=>({...p,[id]:true}))
    try {
      const r = await fetch(`/api/agents/${id}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
      const d = await r.json()
      setOutput(p=>({...p,[id]:d.raw}))
      const s = await fetch("/api/state").then(r=>r.json())
      setLogs(s.feed ?? [])
    } finally { setRunning(p=>({...p,[id]:false})) }
  }

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-3">
      <div>
        <h1 className="text-xl font-bold text-white">Agent Monitor</h1>
        <p className="text-xs text-slate-500 mt-0.5">8 autonomous agents running every 15 minutes</p>
      </div>

      {AGENT_ORDER.map(id => {
        const def    = AGENTS[id]
        const open   = expanded[id]
        const myLogs = logs.filter(l => l.agent === def.name).slice(0, 3)
        const out    = output[id] as Record<string,unknown>|undefined

        return (
          <div key={id} className="card overflow-hidden">
            <div className="flex items-center gap-3 p-3.5">
              <span className="text-xl w-8 text-center">{def.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{def.name}</span>
                  <Badge v={TIER_BADGE[def.tier]}>{def.tier}</Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{def.desc}</p>
                {myLogs[0] && <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-1">Last: {myLogs[0].task}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => run(id)} disabled={running[id]}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs hover:bg-cyan-500/20 transition disabled:opacity-40">
                  <Play size={10}/>{running[id] ? "…" : "Run"}
                </button>
                <button onClick={() => setExpanded(p=>({...p,[id]:!open}))}
                  className="w-6 h-6 rounded-lg border border-[#1a2840] flex items-center justify-center text-slate-500">
                  {open ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                </button>
              </div>
            </div>

            {open && (
              <div className="border-t border-[#1a2840] p-3.5 space-y-3">
                {/* Latest output */}
                {out && (
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5">Latest Output</div>
                    <pre className="text-green-400 bg-black/30 rounded-lg p-2.5 text-[10px] leading-relaxed overflow-auto max-h-40 whitespace-pre-wrap">
                      {JSON.stringify(out, null, 2)}
                    </pre>
                  </div>
                )}
                {/* Recent logs */}
                {myLogs.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-slate-600 uppercase tracking-widest">History</div>
                    {myLogs.map((l,i) => (
                      <div key={i} className="bg-white/[0.02] rounded-lg px-2.5 py-2 text-[10px]">
                        <div className="text-slate-300 font-medium">{l.task}</div>
                        <div className="text-slate-500 mt-0.5 line-clamp-2">{l.result}</div>
                        {l.issues && <div className="text-red-400 mt-0.5">⚠ {l.issues}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
