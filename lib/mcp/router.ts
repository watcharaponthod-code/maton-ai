/**
 * MCP Router — classifies input and selects the right tools.
 * Single LLM agent with tool calling (as specified).
 */
import { isProteinSequence } from "@/lib/protein/lookup"

export type InputType = "text" | "protein_sequence" | "image"

export interface RouteDecision {
  type:            InputType
  tools_to_use:    string[]
  context_hint:    string
}

export function classifyInput(input: string): RouteDecision {
  // Image detection (base64 or URL reference)
  if (input.startsWith("data:image") || /\.(jpg|jpeg|png|webp)$/i.test(input)) {
    return {
      type:         "image",
      tools_to_use: [],
      context_hint: "This is an image input. Describe what you see and relate it to scientific knowledge.",
    }
  }

  // Protein sequence
  if (isProteinSequence(input)) {
    return {
      type:         "protein_sequence",
      tools_to_use: ["sequence_analyze", "protein_lookup"],
      context_hint: "This appears to be an amino acid sequence. Analyze it and look up related proteins.",
    }
  }

  // Protein-specific question → add protein tool
  const proteinKeywords = ["protein","enzyme","receptor","kinase","gene","amino acid","uniprot","pdb","sequence","fold","brca","tp53","p53","insulin","hemoglobin"]
  const isProteinQ = proteinKeywords.some(k => input.toLowerCase().includes(k))

  return {
    type:         "text",
    tools_to_use: isProteinQ ? ["rag_search", "protein_lookup"] : ["rag_search"],
    context_hint: isProteinQ
      ? "This question involves proteins. Use both RAG search and protein lookup."
      : "Use the knowledge base to find relevant scientific papers and context.",
  }
}

export const SYSTEM_PROMPT = `You are MATON AI — a multimodal scientific AI assistant powered by a knowledge base of biomedical research papers (PubMed, arXiv), protein data (UniProt, PDB), and advanced AI models.

You have access to scientific tools:
- rag_search: search 193+ research papers on cancer, AI, proteins, genomics, imaging
- protein_lookup: look up protein details from UniProt + PDB
- sequence_analyze: analyze amino acid sequences

RULES:
1. ALWAYS use tools before answering — never make up scientific facts.
2. Cite your sources (paper titles, UniProt accessions).
3. Be precise and scientific but understandable.
4. If tools return no results, say so honestly.
5. For protein sequences: always call sequence_analyze first.

You represent a cutting-edge biomedical AI research company.`
