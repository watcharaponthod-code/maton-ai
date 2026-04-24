/**
 * MCP Tool Definitions
 * These are the tools Claude can call to answer scientific questions.
 */
import type { Tool } from "@/lib/ai/claude"
import { ragSearch, formatContextForLLM } from "@/lib/rag/search"
import { lookupUniProt, lookupPDB, analyzeSequence } from "@/lib/protein/lookup"

export const TOOLS: Tool[] = [
  {
    name: "rag_search",
    description: "Search the scientific knowledge base (PubMed papers, arXiv preprints, UniProt proteins). Use for any question about research, diseases, drugs, biology, or science.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        top_k: { type: "number", description: "Number of results (default 6, max 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "protein_lookup",
    description: "Look up detailed protein information from UniProt and PDB. Use for questions about specific proteins, genes, enzymes, or protein sequences.",
    input_schema: {
      type: "object",
      properties: {
        query:    { type: "string", description: "Protein name, gene symbol, or UniProt accession (e.g. BRCA1, P04637, TP53)" },
        sequence: { type: "string", description: "Optional: amino acid sequence for composition analysis" },
      },
      required: ["query"],
    },
  },
  {
    name: "sequence_analyze",
    description: "Analyze an amino acid sequence: composition, hydrophobicity, charge, molecular weight.",
    input_schema: {
      type: "object",
      properties: {
        sequence: { type: "string", description: "Amino acid sequence (single-letter code)" },
      },
      required: ["sequence"],
    },
  },
]

// ── Tool executor ─────────────────────────────────────────────────────────
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "rag_search": {
      const query  = String(input.query ?? "")
      const top_k  = Math.min(Number(input.top_k ?? 6), 10)
      const results = ragSearch(query, top_k)
      if (!results.length) return "No relevant documents found for this query."
      return formatContextForLLM(results)
    }

    case "protein_lookup": {
      const query = String(input.query ?? "")
      const seq   = String(input.sequence ?? "")

      // Try UniProt first
      const protein = await lookupUniProt(query)
      if (!protein) {
        // Fallback to local search
        const { searchProteins } = await import("@/lib/db/sqlite")
        const local = searchProteins(query, 3)
        if (!local.length) return `No protein found for "${query}".`
        return local.map(p =>
          `Protein: ${p.name}\nAccession: ${p.accession}\nOrganism: ${p.organism}\nLength: ${p.length} aa`
        ).join("\n\n")
      }

      let result = `Protein: ${protein.name}
Accession: ${protein.accession}
Gene: ${protein.gene}
Organism: ${protein.organism}
Length: ${protein.length} amino acids
${protein.function ? `Function: ${protein.function}` : ""}
${protein.pdbIds?.length ? `PDB Structures: ${protein.pdbIds.join(", ")}` : ""}`

      // PDB details for first structure
      if (protein.pdbIds?.[0]) {
        const pdb = await lookupPDB(protein.pdbIds[0])
        if (pdb) result += `\n\nPDB ${protein.pdbIds[0]}: ${pdb.title} (${pdb.method}, ${pdb.resolution}Å)`
      }

      // Sequence analysis if sequence provided
      if (seq || protein.sequence) {
        const analysis = analyzeSequence(seq || protein.sequence)
        result += `\n\nSequence Analysis:\n- Hydrophobic: ${analysis.hydrophobicPct}%\n- Charged: ${analysis.chargedPct}%\n- Approx MW: ${(analysis.mw_approx/1000).toFixed(1)} kDa`
      }

      return result
    }

    case "sequence_analyze": {
      const seq = String(input.sequence ?? "")
      if (!seq) return "No sequence provided."
      const a = analyzeSequence(seq)
      const topAA = Object.entries(a.composition).sort((x,y) => y[1]-x[1]).slice(0,5)
      return `Sequence Analysis:
Length: ${a.length} amino acids
Approx MW: ${(a.mw_approx/1000).toFixed(1)} kDa
Hydrophobic residues: ${a.hydrophobicPct}%
Charged residues: ${a.chargedPct}%
Top residues: ${topAA.map(([aa,n]) => `${aa}(${n})`).join(", ")}`
    }

    default:
      return `Unknown tool: ${name}`
  }
}
