"use client"
import { useState, useEffect } from "react"
import { Database, Search, Dna, Eye, Cpu, RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react"
import Badge from "@/components/ui/Badge"

interface PipelineState {
  papers: { total: number; pubmed: number; arxiv: number; lastAdded: string }
  proteins: { total: number }
  faiss: { exists: boolean; vectors: number; dim: number; builtAt: string; ageMinutes: number; embedding: string }
  fts5: { papers: boolean; proteins: boolean; triggers: boolean }
  mcp: { tools: string[]; routerStatus: string }
  sprint: { id: string; goal: string; cycle: number }
  ts: string
}

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const cls = warn ? "bg-yellow-400" : ok ? "bg-emerald-400" : "bg-red-400"
  return <span className={`inline-block w-2 h-2 rounded-full ${cls} mr-2`}/>
}

function Card({ icon: Icon, title, status, children }: {
  icon: React.ElementType; title: string; status: "ok"|"warn"|"error"|"planned"; children: React.ReactNode
}) {
  const color = { ok:"border-emerald-500/20", warn:"border-yellow-500/20", error:"border-red-500/20", planned:"border-slate-700" }[status]
  const dot   = { ok:"bg-emerald-400", warn:"bg-yellow-400", error:"bg-red-400", planned:"bg-slate-600" }[status]
  return (
    <div className={`card p-4 border ${color}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-cyan-400 shrink-0"/>
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className={`ml-auto w-2 h-2 rounded-full ${dot}`}/>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string|number; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-[11px] text-slate-300 font-mono">{value}{sub && <span className="text-slate-600 ml-1">{sub}</span>}</span>
    </div>
  )
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    try {
      const r = await fetch("/api/pipeline")
      if (r.ok) setData(await r.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <RefreshCw size={20} className="animate-spin text-cyan-400"/>
    </div>
  )

  if (!data) return <div className="p-6 text-slate-500">Failed to load pipeline status.</div>

  const faissAge = data.faiss.ageMinutes
  const faissWarn = faissAge > 120
  const faissStatus = !data.faiss.exists ? "error" : faissWarn ? "warn" : "ok"

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Cpu size={15} className="text-cyan-400"/>
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Pipeline Status</h1>
          <p className="text-xs text-slate-500">
            {data.sprint.id} · cycle {data.sprint.cycle} · updated {new Date(data.ts).toLocaleTimeString()}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition disabled:opacity-40">
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""}/>
          Refresh
        </button>
      </div>

      {/* Sprint goal */}
      <div className="card p-3 mb-5 border-cyan-500/10">
        <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Sprint Goal</div>
        <div className="text-xs text-cyan-300">{data.sprint.goal}</div>
      </div>

      {/* 2×2 pipeline cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">

        {/* RAG Papers */}
        <Card icon={Search} title="Paper RAG Pipeline" status={faissStatus}>
          <Row label="Total papers" value={data.papers.total}/>
          <Row label="PubMed" value={data.papers.pubmed}/>
          <Row label="arXiv" value={data.papers.arxiv}/>
          <Row label="FTS5 index" value={data.fts5.papers ? "active" : "missing"} />
          <div className="mt-2 pt-2 border-t border-[#1a2840] space-y-0.5">
            <div className="text-[9px] text-slate-600 uppercase tracking-widest">FAISS Semantic Index</div>
            <Row label="Vectors" value={data.faiss.vectors} sub={`dim=${data.faiss.dim}`}/>
            <Row label="Embedding" value={data.faiss.embedding}/>
            <Row label="Index age" value={faissAge < 60 ? `${faissAge}m` : `${Math.round(faissAge/60)}h`} sub={faissWarn ? "⚠ stale" : "fresh"}/>
          </div>
        </Card>

        {/* Protein DB */}
        <Card icon={Dna} title="Protein Database" status="ok">
          <Row label="Total proteins" value={data.proteins.total}/>
          <Row label="Source" value="UniProt / PDB"/>
          <Row label="FTS5 index" value={data.fts5.proteins ? "active" : "missing"}/>
          <Row label="Sync triggers" value={data.fts5.triggers ? "3 active" : "missing"}/>
          <div className="mt-2 pt-2 border-t border-[#1a2840]">
            <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Fields indexed</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {["accession","name","gene_names","organism"].map(f => (
                <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono">{f}</span>
              ))}
            </div>
          </div>
        </Card>

        {/* MCP Router */}
        <Card icon={Cpu} title="MCP Router" status="ok">
          <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5">Active Tools</div>
          {data.mcp.tools.map(t => (
            <div key={t} className="flex items-center gap-1.5 py-0.5">
              <CheckCircle size={9} className="text-emerald-400 shrink-0"/>
              <span className="text-[11px] font-mono text-slate-300">{t}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-[#1a2840] text-[10px] text-slate-500">
            Router: {data.mcp.routerStatus}
          </div>
        </Card>

        {/* Vision (planned) */}
        <Card icon={Eye} title="Vision Pipeline" status="planned">
          <div className="space-y-1.5 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5"><Clock size={9}/> X-ray image input</div>
            <div className="flex items-center gap-1.5"><Clock size={9}/> Pretrained vision model (DenseNet121)</div>
            <div className="flex items-center gap-1.5"><Clock size={9}/> Probability + heatmap output</div>
            <div className="flex items-center gap-1.5"><Clock size={9}/> Result + metadata store</div>
          </div>
          <div className="mt-3 text-[9px] text-slate-700 border-t border-[#1a2840] pt-2">
            Requires GPU · planned Sprint-3
          </div>
        </Card>
      </div>

      {/* Query flow */}
      <div className="card p-4">
        <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-3">Query Flow</div>
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {["User Query","MCP Router","Tool Selection","Tool Execution","Context Merge","LLM Summary","Final Answer"].map((step,i,arr) => (
            <span key={step} className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-[#1a2840] text-slate-300">{step}</span>
              {i < arr.length-1 && <span className="text-slate-700">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
