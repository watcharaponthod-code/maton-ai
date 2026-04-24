"use client"
import { useState, useRef, useEffect } from "react"
import { Send, Loader2, FlaskConical, FileText, Dna } from "lucide-react"
import Badge from "@/components/ui/Badge"

interface ToolCall { name:string; input:Record<string,unknown>; output:string }
interface Message  { role:"user"|"assistant"; content:string; toolCalls?:ToolCall[]; inputType?:string }

const EXAMPLES = [
  { label:"Cancer AI", q:"What does deep learning show for cancer immunotherapy?" },
  { label:"Protein",   q:"Tell me about the BRCA1 protein and its role in DNA repair" },
  { label:"COVID",     q:"What are the key structural features of the SARS-CoV-2 spike protein?" },
  { label:"Sequence",  q:"MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGT" },
]

const TOOL_ICONS: Record<string,React.ReactNode> = {
  rag_search:       <FileText size={11}/>,
  protein_lookup:   <Dna size={11}/>,
  sequence_analyze: <FlaskConical size={11}/>,
}

export default function ChatPage() {
  const [msgs, setMsgs]         = useState<Message[]>([])
  const [input, setInput]       = useState("")
  const [streaming, setStream]  = useState(false)
  const [toolTrace, setTrace]   = useState<ToolCall[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }) }, [msgs])

  async function send(text: string) {
    if (!text.trim() || streaming) return
    const userMsg: Message = { role:"user", content:text }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs)
    setInput("")
    setStream(true)
    setTrace([])

    const localTrace: ToolCall[] = []
    let answer = ""

    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages: newMsgs }),
      })
      if (!res.body) throw new Error("No stream")

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      setMsgs(prev => [...prev, { role:"assistant", content:"", toolCalls:[] }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream:true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const evt = JSON.parse(line)
            if (evt.type === "tool_call") {
              localTrace.push({ name:evt.name, input:evt.input, output:"" })
              setTrace([...localTrace])
            }
            if (evt.type === "tool_result") {
              const idx = localTrace.findIndex(t => t.name === evt.name && !t.output)
              if (idx >= 0) { localTrace[idx].output = evt.output; setTrace([...localTrace]) }
            }
            if (evt.type === "answer") {
              answer = evt.text
              setMsgs(prev => {
                const copy = [...prev]
                copy[copy.length-1] = { role:"assistant", content:answer, toolCalls:localTrace }
                return copy
              })
            }
          } catch {}
        }
      }
    } catch (e) {
      setMsgs(prev => [...prev, { role:"assistant", content:`Error: ${e}` }])
    } finally {
      setStream(false)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="px-5 py-3 border-b border-[#1a2840] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"/>
          <h1 className="text-sm font-semibold text-white">Scientific AI Chat</h1>
          <Badge v="cyan">RAG + MCP</Badge>
          <Badge v="green">243 papers</Badge>
          <Badge v="purple">99 proteins</Badge>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!msgs.length && (
            <div className="flex flex-col items-center justify-center h-full gap-5 pb-16">
              <div className="text-5xl">🔬</div>
              <div className="text-center">
                <h2 className="text-base font-semibold text-white">Multimodal Scientific Assistant</h2>
                <p className="text-sm text-slate-500 mt-1">Ask about research papers, proteins, diseases, or paste an amino acid sequence.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {EXAMPLES.map(e => (
                  <button key={e.label} onClick={() => send(e.q)}
                    className="text-left p-2.5 rounded-lg bg-white/[0.03] border border-[#1a2840] text-xs text-slate-400 hover:border-cyan-500/30 hover:text-slate-200 transition">
                    <span className="text-cyan-500 font-medium">{e.label}</span><br/>
                    <span className="line-clamp-2 mt-0.5">{e.q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role==="user" ? "flex-row-reverse" : ""} animate-fade-in`}>
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm bg-[#1a2840]">
                {m.role==="user" ? "👤" : "🔬"}
              </div>
              <div className={`max-w-[80%] space-y-2 ${m.role==="user" ? "items-end" : "items-start"}`}>
                {/* Tool calls */}
                {m.toolCalls?.map((tc, j) => {
                  let parsed: unknown = null
                  try { parsed = JSON.parse(tc.output) } catch {}
                  const papers = Array.isArray(parsed) && (parsed as {title?:string}[])[0]?.title
                    ? (parsed as {title:string; year?:string; source?:string}[])
                    : null
                  const protein = !Array.isArray(parsed) && parsed && typeof parsed === "object" && "name" in (parsed as object)
                    ? (parsed as {name:string; organism?:string; length?:number; accession?:string})
                    : null
                  return (
                    <div key={j} className="card px-3 py-2 text-xs border-cyan-500/15">
                      <div className="flex items-center gap-1.5 text-cyan-400 mb-1.5">
                        {TOOL_ICONS[tc.name] ?? null}
                        <span className="font-mono">{tc.name}</span>
                        <span className="text-slate-600">← {Object.values(tc.input).join(", ").slice(0,40)}</span>
                      </div>
                      {papers && (
                        <div className="space-y-1">
                          {papers.slice(0,3).map((p,k) => (
                            <div key={k} className="flex gap-1.5 text-[10px]">
                              <span className="text-cyan-600 shrink-0">{p.year ?? "—"}</span>
                              <span className="text-slate-400 line-clamp-1">{p.title}</span>
                            </div>
                          ))}
                          {papers.length > 3 && <div className="text-[9px] text-slate-600">+{papers.length-3} more</div>}
                        </div>
                      )}
                      {protein && (
                        <div className="space-y-0.5 text-[10px]">
                          <div className="text-slate-300 font-medium">{protein.name}</div>
                          <div className="text-slate-500">{protein.organism} · {protein.length} aa · {protein.accession}</div>
                        </div>
                      )}
                      {!papers && !protein && tc.output && (
                        <div className="text-slate-500 text-[10px] line-clamp-3">{tc.output.slice(0,200)}</div>
                      )}
                    </div>
                  )
                })}
                {/* Message bubble */}
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role==="user"
                    ? "bg-cyan-500/10 text-cyan-50 rounded-tr-sm border border-cyan-500/20"
                    : "card text-slate-300 rounded-tl-sm"
                }`}>
                  {m.content
                    ? <div style={{whiteSpace:"pre-wrap"}}>
                        {m.content}
                        {streaming && i === msgs.length-1 && m.role==="assistant" && (
                          <span className="inline-block w-[2px] h-[1em] bg-cyan-400 ml-0.5 align-text-bottom animate-pulse"/>
                        )}
                      </div>
                    : <Loader2 size={14} className="animate-spin text-slate-600"/>}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>

        {/* Tool trace sidebar */}
        {toolTrace.length > 0 && (
          <div className="w-64 shrink-0 border-l border-[#1a2840] p-3 overflow-y-auto space-y-2">
            <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-2">Tool Trace</div>
            {toolTrace.map((tc, i) => (
              <div key={i} className="card p-2 text-[10px]">
                <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                  {TOOL_ICONS[tc.name]}
                  <span className="font-mono">{tc.name}</span>
                </div>
                <div className="text-slate-600 line-clamp-2">{Object.values(tc.input).join(" · ").slice(0,60)}</div>
                {tc.output && <div className="text-slate-500 line-clamp-3 mt-1">{tc.output.slice(0,150)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#1a2840] shrink-0">
        <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask a scientific question, paste a protein sequence, or describe a disease…"
            className="flex-1 bg-[#0d1520] border border-[#1a2840] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition"/>
          <button type="submit" disabled={!input.trim()||streaming}
            className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/20 transition disabled:opacity-40">
            {streaming ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>}
          </button>
        </form>
      </div>
    </div>
  )
}
