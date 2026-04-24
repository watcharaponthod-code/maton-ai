"use client"
import { useState, useEffect } from "react"
import { Database, Search, Dna, Eye, Cpu, RefreshCw, CheckCircle, Clock } from "lucide-react"
import Badge from "@/components/ui/Badge"

interface PipelineState {
  papers:   { total:number; pubmed:number; arxiv:number }
  proteins: { total:number }
  faiss:    { exists:boolean; vectors:number; dim:number; ageMinutes:number; embedding:string }
  fts5:     { papers:boolean; proteins:boolean; triggers:boolean }
  mcp:      { tools:string[]; routerStatus:string }
  sprint:   { id:string; goal:string; cycle:number }
  ts:       string
}

function StatusBadge({ status }: { status:"ok"|"warn"|"error"|"planned" }) {
  const map = { ok:["green","Active"], warn:["amber","Stale"], error:["red","Error"], planned:["slate","Planned"] }
  const [v, label] = map[status]
  return <Badge v={v}>{label}</Badge>
}

function Card({ icon: Icon, title, status, children }: {
  icon: React.ElementType; title:string; status:"ok"|"warn"|"error"|"planned"; children:React.ReactNode
}) {
  const border = { ok:"border-slate-200", warn:"border-amber-200", error:"border-red-200", planned:"border-slate-200" }[status]
  return (
    <div className={`card p-5 border ${border}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
            <Icon size={14} className="text-slate-600"/>
          </div>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
        </div>
        <StatusBadge status={status}/>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, sub }: { label:string; value:string|number; sub?:string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs text-slate-700 font-mono font-medium">{value}
        {sub && <span className="text-slate-400 ml-1 font-normal">{sub}</span>}
      </span>
    </div>
  )
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineState|null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(r = false) {
    if (r) setRefreshing(true)
    try {
      const res = await fetch("/api/pipeline")
      if (res.ok) setData(await res.json())
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <RefreshCw size={20} className="animate-spin text-blue-500"/>
    </div>
  )
  if (!data) return <div className="p-6 text-slate-400 text-sm">Failed to load pipeline status.</div>

  const faissAge    = data.faiss.ageMinutes
  const faissWarn   = faissAge > 120
  const faissStatus = !data.faiss.exists ? "error" : faissWarn ? "warn" : "ok"

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pipeline Status</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {data.sprint.id} · cycle {data.sprint.cycle} · {new Date(data.ts).toLocaleTimeString()}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition disabled:opacity-40">
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""}/>
          Refresh
        </button>
      </div>

      {/* Sprint goal banner */}
      <div className="card p-4 mb-6 bg-blue-50 border-blue-100">
        <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-widest mb-1">Sprint Goal</div>
        <div className="text-sm text-blue-800 font-medium">{data.sprint.goal}</div>
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card icon={Search} title="Paper RAG Pipeline" status={faissStatus}>
          <Row label="Total papers" value={data.papers.total}/>
          <Row label="PubMed" value={data.papers.pubmed}/>
          <Row label="arXiv" value={data.papers.arxiv}/>
          <Row label="FTS5 index" value={data.fts5.papers ? "active" : "missing"}/>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">FAISS Semantic Index</div>
            <Row label="Vectors" value={data.faiss.vectors} sub={`dim=${data.faiss.dim}`}/>
            <Row label="Embedding" value={data.faiss.embedding}/>
            <Row label="Index age" value={faissAge < 60 ? `${faissAge}m` : `${Math.round(faissAge/60)}h`} sub={faissWarn ? "⚠ stale" : "fresh"}/>
          </div>
        </Card>

        <Card icon={Dna} title="Protein Database" status="ok">
          <Row label="Total proteins" value={data.proteins.total}/>
          <Row label="Source" value="UniProt / PDB"/>
          <Row label="FTS5 index" value={data.fts5.proteins ? "active" : "missing"}/>
          <Row label="Sync triggers" value={data.fts5.triggers ? "3 active" : "missing"}/>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Fields Indexed</div>
            <div className="flex flex-wrap gap-1">
              {["accession","name","gene_names","organism"].map(f => (
                <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{f}</span>
              ))}
            </div>
          </div>
        </Card>

        <Card icon={Cpu} title="MCP Router" status="ok">
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Active Tools</div>
          {data.mcp.tools.map(t => (
            <div key={t} className="flex items-center gap-2 py-1">
              <CheckCircle size={10} className="text-green-500 shrink-0"/>
              <span className="text-xs font-mono text-slate-600">{t}</span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
            {data.mcp.routerStatus}
          </div>
        </Card>

        <Card icon={Eye} title="Vision Pipeline" status="planned">
          <div className="space-y-2 text-xs text-slate-400">
            {["X-ray image input","DenseNet121 / ViT model","Probability + heatmap output","Result + metadata store"].map(s => (
              <div key={s} className="flex items-center gap-2">
                <Clock size={10} className="shrink-0 text-slate-300"/>
                {s}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-300">
            Requires GPU · Sprint-3
          </div>
        </Card>
      </div>

      {/* Query flow */}
      <div className="card p-5">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-4">Query Flow</div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {["User Query","MCP Router","Tool Selection","Tool Execution","Context Merge","Gemini 1.5 Pro","Final Answer"].map((step,i,arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium">{step}</span>
              {i < arr.length-1 && <span className="text-slate-300">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
