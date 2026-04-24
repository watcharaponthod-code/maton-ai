import { NextRequest, NextResponse } from "next/server"
import { ragSearch } from "@/lib/rag/search"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  if (!q.trim()) return NextResponse.json({ results: [] })
  const results = ragSearch(q, 8)
  return NextResponse.json({ results, query: q })
}
