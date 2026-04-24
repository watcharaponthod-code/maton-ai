/**
 * SQLite wrapper for the science knowledge base.
 * Uses better-sqlite3 (sync API, works on Node.js runtime).
 * Falls back to JSON if the DB file isn't available (e.g. Vercel edge).
 */
import path from "path"
import fs   from "fs"

let db: import("better-sqlite3").Database | null = null

function getDb() {
  if (db) return db
  const dbPath = path.join(process.cwd(), "data", "science.db")
  if (!fs.existsSync(dbPath)) {
    console.warn("[sqlite] DB not found at", dbPath)
    return null
  }
  // Dynamic require to avoid bundling issues
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require("better-sqlite3")
  db = new Database(dbPath, { readonly: true })
  return db
}

export interface Paper {
  id:       number
  source:   string
  eid:      string
  title:    string
  abstract: string
  year:     string
}

export interface Protein {
  id:        number
  source:    string
  accession: string
  name:      string
  organism:  string
  sequence:  string
  length:    number
}

// ── FTS5 paper search ──────────────────────────────────────────────────────
export function searchPapers(query: string, limit = 8): Paper[] {
  const db = getDb()
  if (!db) return searchPapersJSON(query, limit)

  const sanitized = query.replace(/[^a-zA-Z0-9\s]/g, " ").trim()
  if (!sanitized) return []

  try {
    // Try FTS5 first
    const rows = db.prepare(`
      SELECT p.id, p.source, p.external_id, p.title, p.abstract, p.year
      FROM papers_fts f
      JOIN papers p ON p.id = f.rowid
      WHERE papers_fts MATCH ?
      LIMIT ?
    `).all(sanitized + "*", limit) as Array<{
      id:number; source:string; external_id:string; title:string; abstract:string; year:string
    }>
    if (rows.length > 0) {
      return rows.map(r => ({ id:r.id, source:r.source, eid:r.external_id, title:r.title, abstract:r.abstract, year:r.year }))
    }
  } catch {}

  // Fallback: LIKE search
  try {
    const term = `%${query.split(" ").slice(0,3).join("%")}%`
    const rows = db.prepare(`
      SELECT id,source,external_id,title,abstract,year
      FROM papers WHERE title LIKE ? OR abstract LIKE ? LIMIT ?
    `).all(term, term, limit) as Array<{id:number;source:string;external_id:string;title:string;abstract:string;year:string}>
    return rows.map(r => ({ id:r.id, source:r.source, eid:r.external_id, title:r.title, abstract:r.abstract, year:r.year }))
  } catch { return [] }
}

export function searchProteins(query: string, limit = 5): Protein[] {
  const db = getDb()
  if (!db) return searchProteinsJSON(query, limit)
  try {
    // Use FTS5 if available, fall back to LIKE
    const hasFts = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='proteins_fts'"
    ).get()
    // Wrap in double-quotes for FTS5 literal phrase matching — prevents operator injection
    const ftsQuery = `"${query.replace(/"/g, '""')}"`
    const rows = hasFts
      ? db.prepare(`
          SELECT p.id,p.source,p.accession,p.name,p.organism,p.sequence,p.length
          FROM proteins_fts f JOIN proteins p ON p.id = f.rowid
          WHERE proteins_fts MATCH ? OR p.accession = ? LIMIT ?
        `).all(ftsQuery, query.toUpperCase(), limit) as Array<{id:number;source:string;accession:string;name:string;organism:string;sequence:string;length:number}>
      : db.prepare(`
          SELECT id,source,accession,name,organism,sequence,length
          FROM proteins WHERE name LIKE ? OR organism LIKE ? OR accession = ? LIMIT ?
        `).all(`%${query}%`, `%${query}%`, query.toUpperCase(), limit) as Array<{id:number;source:string;accession:string;name:string;organism:string;sequence:string;length:number}>
    return rows
  } catch { return [] }
}

// ── JSON fallbacks (Vercel edge / first deploy) ───────────────────────────
let _papersCache: Paper[] | null = null
let _proteinsCache: Protein[] | null = null

function loadPapersJSON(): Paper[] {
  if (_papersCache) return _papersCache
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "public", "data", "papers.json"), "utf-8")
    _papersCache = JSON.parse(raw)
    return _papersCache!
  } catch { return [] }
}
function loadProteinsJSON(): Protein[] {
  if (_proteinsCache) return _proteinsCache
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "public", "data", "proteins.json"), "utf-8")
    _proteinsCache = JSON.parse(raw)
    return _proteinsCache!
  } catch { return [] }
}

function searchPapersJSON(query: string, limit: number): Paper[] {
  const terms = query.toLowerCase().split(/\s+/)
  return loadPapersJSON()
    .filter(p => terms.some(t => (p.title+p.abstract).toLowerCase().includes(t)))
    .slice(0, limit)
}
function searchProteinsJSON(query: string, limit: number): Protein[] {
  const q = query.toLowerCase()
  return loadProteinsJSON()
    .filter(p => (p.name+p.organism+p.accession).toLowerCase().includes(q))
    .slice(0, limit)
}
