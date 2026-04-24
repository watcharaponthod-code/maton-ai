/**
 * RAG Search — hybrid FAISS semantic search + FTS5 keyword fallback.
 * Returns top-k papers/proteins as grounded context for the LLM.
 */
import { searchPapers, searchProteins, type Paper, type Protein } from "@/lib/db/sqlite"
import { execSync } from "child_process"
import path from "path"

function faissSearch(query: string, k: number): Array<{id:number;title:string;year:string;source:string;score:number}> {
  try {
    const cwd = process.cwd()
    const jsonOut = execSync(
      `python3 -c "import sys,json,os; sys.path.insert(0,'${cwd}/scripts'); os.chdir('${cwd}'); from search_faiss import search; print(json.dumps(search(sys.argv[1],${k})))" ${JSON.stringify(query)}`,
      { timeout: 8000, encoding: "utf-8" }
    )
    return JSON.parse(jsonOut.trim())
  } catch { return [] }
}

export interface RagResult {
  type:     "paper" | "protein"
  id:       number
  title:    string
  snippet:  string
  source:   string
  year?:    string
  accession?: string
  organism?:  string
}

export function ragSearch(query: string, topK = 6): RagResult[] {
  const proteins = isProteinQuery(query) ? searchProteins(query, 3) : []

  // Try FAISS semantic search first; fall back to FTS5 keyword search
  let faissResults = faissSearch(query, topK)
  let papers: Paper[]
  if (faissResults.length >= 3) {
    // Merge FAISS hits with DB for abstract snippets
    const fts = searchPapers(query, Math.max(2, topK - faissResults.length))
    const ftsIds = new Set(fts.map(p => p.id))
    const faissIds = new Set(faissResults.map(r => r.id))
    // Add FTS results not already in FAISS set
    papers = [
      ...fts.filter(p => !faissIds.has(p.id)),
    ]
    faissResults = faissResults.slice(0, topK - papers.length)
  } else {
    faissResults = []
    const terms = query.split(/\s+/).filter(t => t.length > 3).slice(0, 4).join(" OR ")
    papers = searchPapers(`${query} ${terms}`, topK)
  }

  const faissHits: RagResult[] = faissResults.map(r => ({
    type:    "paper" as const,
    id:      r.id,
    title:   r.title,
    snippet: `(semantic match, score ${r.score})`,
    source:  r.source,
    year:    r.year,
  }))

  const paperResults: RagResult[] = papers.map(p => ({
    type:    "paper" as const,
    id:      p.id,
    title:   p.title,
    snippet: truncate(p.abstract, 300),
    source:  p.source,
    year:    p.year,
  }))

  const proteinResults: RagResult[] = proteins.map(p => ({
    type:      "protein",
    id:        p.id,
    title:     p.name,
    snippet:   `Organism: ${p.organism}. Sequence length: ${p.length} aa. ${p.sequence ? `Seq: ${p.sequence.slice(0,60)}…` : ""}`,
    source:    p.source,
    accession: p.accession,
    organism:  p.organism,
  }))

  return [...faissHits, ...paperResults, ...proteinResults].slice(0, topK)
}

export function formatContextForLLM(results: RagResult[]): string {
  if (!results.length) return "No relevant documents found in the knowledge base."
  return results.map((r, i) => {
    const tag = r.type === "paper"
      ? `[${i+1}] ${r.source.toUpperCase()} Paper (${r.year ?? ""}): "${r.title}"\n${r.snippet}`
      : `[${i+1}] Protein (${r.accession ?? r.source}): "${r.title}"\n${r.snippet}`
    return tag
  }).join("\n\n")
}

function isProteinQuery(q: string): boolean {
  const proteinKeywords = ["protein","enzyme","receptor","kinase","gene","sequence","amino acid","uniprot","pdb","structure","fold"]
  return proteinKeywords.some(k => q.toLowerCase().includes(k))
}

function truncate(s: string | null | undefined, len: number): string {
  if (!s) return ""
  return s.length > len ? s.slice(0, len) + "…" : s
}
