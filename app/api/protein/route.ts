import { NextRequest, NextResponse } from "next/server"
import { lookupUniProt, analyzeSequence, isProteinSequence } from "@/lib/protein/lookup"
import { searchProteins } from "@/lib/db/sqlite"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 })

  if (isProteinSequence(q)) {
    return NextResponse.json({ type: "sequence", analysis: analyzeSequence(q) })
  }

  const uniprot = await lookupUniProt(q)
  if (uniprot) return NextResponse.json({ type: "uniprot", protein: uniprot })

  const local = searchProteins(q, 5)
  return NextResponse.json({ type: "local", proteins: local })
}
