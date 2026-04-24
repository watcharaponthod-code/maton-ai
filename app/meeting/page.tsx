"use client"
import { useEffect, useState } from "react"
import { Play, Loader2 } from "lucide-react"
import Badge from "@/components/ui/Badge"
import { formatDistanceToNow } from "date-fns"

interface Meeting { timestamp:string; cycle:string; summary:string; decisions:string; nextFocus:string; tasks:{agent:string;task:string;priority:string}[] }

const AGENT_EMOJI: Record<string,string> = {
  research:"🧪",coding:"💻",testing:"🧫","bug-hunter":"🐞","ui-ux":"🎨",ops:"⚙️","project-manager":"📋",chief:"👑"
}

export default function MeetingPage() {
  const [meetings, set] = useState<Meeting[]>([])
  const [loading, setL] = useState(true)
  const [running, setR] = useState(false)

  const load = async () => {
    const r = await fetch("/api/meeting")
    const d = await r.json()
    set(d.meetings ?? [])
    setL(false)
  }

  useEffect(() => { load() }, [])

  async function trigger() {
    setR(true)
    await fetch("/api/meeting", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
    await load()
    setR(false)
  }

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Meeting Room</h1>
          <p className="text-xs text-slate-500 mt-0.5">Team discussions, decisions, and task assignments</p>
        </div>
        <button onClick={trigger} disabled={running}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/20 disabled:opacity-40 transition">
          {running ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
          {running ? "Running…" : "Trigger Meeting"}
        </button>
      </div>

      {running && (
        <div className="card p-4 border-amber-500/20 animate-pulse">
          <div className="flex gap-3 items-center">
            <span className="text-2xl">👑</span>
            <div>
              <div className="text-sm text-amber-300 font-medium">Meeting in progress…</div>
              <div className="text-xs text-slate-500">Chief Agent reading all reports and making decisions</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2].map(i=><div key={i} className="card h-40 animate-pulse"/>)}</div>
      ) : !meetings.length ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🏛️</div>
          <div className="text-sm text-slate-400">No meetings yet</div>
          <div className="text-xs text-slate-600 mt-1">Click "Trigger Meeting" or wait for the Chief Agent's cron (14 min mark)</div>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((m, i) => (
            <div key={i} className={`card p-5 space-y-4 ${i===0 ? "border-amber-500/20 glow-amber" : ""}`}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>👑</span>
                  <span className="text-sm font-semibold text-white">Cycle #{m.cycle} Meeting</span>
                  {i===0 && <Badge v="amber">Latest</Badge>}
                </div>
                <span className="text-xs text-slate-600">
                  {m.timestamp ? formatDistanceToNow(new Date(m.timestamp), {addSuffix:true}) : ""}
                </span>
              </div>

              {/* Summary */}
              <div>
                <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5">Summary</div>
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{m.summary}</div>
              </div>

              {/* Decisions */}
              {m.decisions && (
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5">Decisions</div>
                  <div className="text-xs text-slate-400 whitespace-pre-line">{m.decisions}</div>
                </div>
              )}

              {/* Next focus */}
              {m.nextFocus && (
                <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg px-3 py-2">
                  <div className="text-[9px] text-cyan-600 uppercase tracking-widest mb-0.5">Next Cycle Focus</div>
                  <div className="text-xs text-cyan-300">{m.nextFocus}</div>
                </div>
              )}

              {/* Tasks */}
              {m.tasks?.length > 0 && (
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-2">Assigned Tasks</div>
                  <div className="space-y-1.5">
                    {m.tasks.map((t,j) => (
                      <div key={j} className="flex items-start gap-2.5 bg-white/[0.02] rounded-lg px-2.5 py-2">
                        <span>{AGENT_EMOJI[t.agent] ?? "🤖"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-slate-300 capitalize">{t.agent.replace("-"," ")}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{t.task}</div>
                        </div>
                        <Badge v={t.priority==="critical"?"red":t.priority==="high"?"yellow":"gray"}>{t.priority}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
