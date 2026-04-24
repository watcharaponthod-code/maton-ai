/**
 * Protein analysis tools — UniProt + PDB via REST APIs.
 * Called by the MCP protein tool.
 */

export interface ProteinInfo {
  accession:   string
  name:        string
  gene:        string
  organism:    string
  length:      number
  sequence:    string
  function?:   string
  pdbIds?:     string[]
  source:      "uniprot" | "pdb" | "local"
}

// ── UniProt lookup by accession or name ──────────────────────────────────
export async function lookupUniProt(query: string): Promise<ProteinInfo | null> {
  try {
    const params = new URLSearchParams({
      query:  `(${query}) AND (reviewed:true)`,
      format: "json",
      size:   "1",
      fields: "accession,id,protein_name,gene_names,organism_name,sequence,length,cc_function,xref_pdb",
    })
    const r = await fetch(`https://rest.uniprot.org/uniprotkb/search?${params}`, {
      headers: { Accept: "application/json" },
      signal:  AbortSignal.timeout(10000),
    })
    if (!r.ok) return null
    const d    = await r.json()
    const entry = d.results?.[0]
    if (!entry) return null

    const pdbRefs = (entry.uniProtKBCrossReferences ?? [])
      .filter((x: { database: string }) => x.database === "PDB")
      .slice(0, 5)
      .map((x: { id: string }) => x.id)

    const funcComment = entry.comments?.find((c: { commentType: string }) => c.commentType === "FUNCTION")
    const funcText    = funcComment?.texts?.[0]?.value ?? ""

    return {
      accession: entry.primaryAccession,
      name:      entry.proteinDescription?.recommendedName?.fullName?.value ?? entry.uniProtkbId,
      gene:      entry.genes?.[0]?.geneName?.value ?? "",
      organism:  entry.organism?.scientificName ?? "",
      length:    entry.sequence?.length ?? 0,
      sequence:  entry.sequence?.value ?? "",
      function:  funcText.slice(0, 400),
      pdbIds:    pdbRefs,
      source:    "uniprot",
    }
  } catch (e) {
    console.error("[UniProt]", e)
    return null
  }
}

// ── PDB structure info ────────────────────────────────────────────────────
export async function lookupPDB(pdbId: string): Promise<{ title: string; method: string; resolution: string } | null> {
  try {
    const r = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId.toUpperCase()}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const d = await r.json()
    return {
      title:      d.struct?.title ?? "",
      method:     d.exptl?.[0]?.method ?? "",
      resolution: String(d.reflns?.[0]?.d_resolution_high ?? "N/A"),
    }
  } catch { return null }
}

// ── Sequence analysis (local, no external call) ───────────────────────────
export function analyzeSequence(seq: string): {
  length: number
  composition: Record<string, number>
  hydrophobicPct: number
  chargedPct: number
  mw_approx: number
} {
  const s = seq.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "")
  const hydrophobic = new Set("AILMFWYVP")
  const charged     = new Set("DEKRH")
  const comp: Record<string, number> = {}
  for (const c of s) comp[c] = (comp[c] ?? 0) + 1

  // Average MW per residue ≈ 111 Da
  return {
    length:         s.length,
    composition:    comp,
    hydrophobicPct: Math.round([...s].filter(c => hydrophobic.has(c)).length / s.length * 100),
    chargedPct:     Math.round([...s].filter(c => charged.has(c)).length / s.length * 100),
    mw_approx:      Math.round(s.length * 111),
  }
}

// ── Is this string a protein sequence? ───────────────────────────────────
export function isProteinSequence(s: string): boolean {
  const clean = s.trim().replace(/\s/g, "").toUpperCase()
  if (clean.length < 10 || clean.length > 5000) return false
  const validAA  = /^[ACDEFGHIKLMNPQRSTVWYBZXUO*]+$/
  const validPct = [...clean].filter(c => /[ACDEFGHIKLMNPQRSTVWY]/.test(c)).length / clean.length
  return validAA.test(clean) && validPct > 0.85
}
