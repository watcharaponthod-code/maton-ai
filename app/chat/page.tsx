"use client"
import { useState, useRef, useEffect } from "react"
import { Send, Loader2, FlaskConical, FileText, Dna, Sparkles } from "lucide-react"
import Badge from "@/components/ui/Badge"

interface ToolCall { name:string; input:Record<string,unknown>; output:string }
interface Message  { role:"user"|"assistant"; content:string; toolCalls?:ToolCall[] }

const EXAMPLES = [
  { label:"Cancer AI",  q:"What does deep learning show for cancer immunotherapy?" },
  { label:"Protein",    q:"Tell me about the BRCA1 protein and its role in DNA repair" },
  { label:"COVID",      q:"What are the key structural features of the SARS-CoV-2 spike protein?" },
  { label:"Sequence",   q:"MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGT" },
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
  const [kbStats, setKbStats]   = useState<{papers:number;proteins:number;faissOk:boolean}|null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/pipeline").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setKbStats({ papers: d.papers.total, proteins: d.proteins.total, faissOk: d.faiss.exists })
    }).catch(() => {})
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }) }, [msgs])

  async function send(text: string) {
    if (!text.trim() || streaming) return
    const userMsg: Message = { role:"user", content:text }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs)
    setInput("")
    setStream(true)

    const localTrace: ToolCall[] = []

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
            }
            if (evt.type === "tool_result") {
              const idx = localTrace.findIndex(t => t.name === evt.name && !t.output)
              if (idx >= 0) localTrace[idx].output = evt.output
            }
            if (evt.type === "answer") {
              setMsgs(prev => {
                const copy = [...prev]
                copy[copy.length-1] = { role:"assistant", content:evt.text, toolCalls:[...localTrace] }
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
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles size={13} className="text-white"/>
          </div>
          <h1 className="text-sm font-bold text-slate-800">Scientific AI Chat</h1>
          <Badge v="blue">Gemini 1.5 Pro</Badge>
          <Badge v="blue">RAG</Badge>
          <Badge v="green">{kbStats ? `${kbStats.papers} papers` : "410 papers"}</Badge>
          <Badge v="purple">{kbStats ? `${kbStats.proteins} proteins` : "99 proteins"}</Badge>
          {kbStats?.faissOk && <Badge v="cyan">FAISS</Badge>}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!msgs.length && (
            <div className="flex flex-col items-center justify-center h-full gap-6 pb-20">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <FlaskConical size={28} className="text-blue-600"/>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-slate-800">Multimodal Scientific Assistant</h2>
                <p className="text-sm text-slate-400 mt-1">Ask about research papers, proteins, diseases, or paste an amino acid sequence.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {EXAMPLES.map(e => (
                  <button key={e.label} onClick={() => send(e.q)}
                    className="text-left p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-slate-700 transition-all shadow-sm">
                    <span className="text-blue-600 font-semibold">{e.label}</span>
                    <br/>
                    <span className="line-clamp-2 mt-0.5 leading-relaxed">{e.q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role==="user" ? "flex-row-reverse" : ""} animate-fade-in`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold ${
                m.role==="user" ? "bg-blue-600 text-white" : "bg-slate-100 border border-slate-200 text-slate-600"
              }`}>
                {m.role==="user" ? "U" : <FlaskConical size={14}/>}
              </div>

              <div className={`max-w-[78%] space-y-2 ${m.role==="user" ? "items-end" : "items-start"}`}>
                {/* Tool calls */}
                {m.toolCalls?.map((tc, j) => {
                  let parsed: unknown = null
                  try { parsed = JSON.parse(tc.output) } catch {}
                  const papers = Array.isArray(parsed) && (parsed as {title?:string}[])[0]?.title
                    ? (parsed as {title:string;year?:string;source?:string}[]) : null
                  const protein = !Array.isArray(parsed) && parsed && typeof parsed === "object" && "name" in (parsed as object)
                    ? (parsed as {name:string;organism?:string;length?:number;accession?:string}) : null
                  return (
                    <div key={j} className="card px-3 py-2.5 text-xs border-blue-100 bg-blue-50/40">
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1.5 font-medium">
                        {TOOL_ICONS[tc.name] ?? null}
                        <span className="font-mono text-[10px]">{tc.name}</span>
                        <span className="text-slate-400 font-normal">← {Object.values(tc.input).join(", ").slice(0,40)}</span>
                      </div>
                      {papers && (
                        <div className="space-y-1">
                          {papers.slice(0,3).map((p,k) => (
                            <div key={k} className="flex gap-1.5 text-[10px]">
                              <span className="text-blue-500 shrink-0 font-medium">{p.year ?? "—"}</span>
                              <span className="text-slate-500 line-clamp-1">{p.title}</span>
                            </div>
                          ))}
                          {papers.length > 3 && <div className="text-[9px] text-slate-400">+{papers.length-3} more</div>}
                        </div>
                      )}
                      {protein && (
                        <div className="space-y-0.5 text-[10px]">
                          <div className="text-slate-700 font-semibold">{protein.name}</div>
                          <div className="text-slate-400">{protein.organism} · {protein.length} aa · {protein.accession}</div>
                        </div>
                      )}
                      {!papers && !protein && tc.output && (
                        <div className="text-slate-400 text-[10px] line-clamp-3">{tc.output.slice(0,200)}</div>
                      )}
                    </div>
                  )
                })}

                {/* Message bubble */}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role==="user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                }`}>
                  {m.content
                    ? <div style={{whiteSpace:"pre-wrap"}}>
                        {m.content}
                        {streaming && i === msgs.length-1 && m.role==="assistant" && (
                          <span className="inline-block w-[2px] h-[1em] bg-blue-400 ml-0.5 align-text-bottom animate-pulse"/>
                        )}
                      </div>
                    : <Loader2 size={14} className="animate-spin text-slate-400"/>}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 bg-white shrink-0">
        <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask a scientific question, paste a protein sequence, or describe a disease…"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition"/>
          <button type="submit" disabled={!input.trim()||streaming}
            className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition disabled:opacity-40 shadow-sm">
            {streaming ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>}
          </button>
        </form>
      </div>
    </div>
  )
}
