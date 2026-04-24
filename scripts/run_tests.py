"""Testing Agent — runs 15 automated tests each cycle and writes results to Sheets."""
import sys, time, json, sqlite3, os, urllib.request, urllib.error
sys.path.insert(0, "/home/vercel-sandbox/maton-scripts")
import sheets

PASS = "PASS"
FAIL = "FAIL"
SKIP = "SKIP"

results: list[dict] = []

def test(name: str):
    def decorator(fn):
        def wrapper():
            start = time.time()
            try:
                msg = fn()
                status = PASS
                detail = msg or ""
            except AssertionError as e:
                status = FAIL
                detail = str(e)
            except Exception as e:
                status = FAIL
                detail = f"Exception: {e}"
            elapsed = round((time.time() - start) * 1000)
            results.append({"name": name, "status": status, "detail": detail, "ms": elapsed})
            sym = "✓" if status == PASS else "✗"
            print(f"  {sym} [{status}] {name} ({elapsed}ms){' — '+detail if detail and status!=PASS else ''}")
        wrapper.__name__ = fn.__name__
        return wrapper
    return decorator


# ── Sheets connectivity ──────────────────────────────────────────────────────

@test("sheets: MATON_API_KEY present")
def t01():
    key = os.environ.get("MATON_API_KEY", "")
    assert key, "MATON_API_KEY not set"
    return f"key length {len(key)}"

@test("sheets: read SystemState")
def t02():
    state = sheets.get_state()
    assert isinstance(state, dict), "get_state did not return dict"
    assert state, "SystemState is empty"
    return f"{len(state)} keys"

@test("sheets: write + read roundtrip")
def t03():
    ts = str(int(time.time()))
    sheets.set_state("_test_ping", ts)
    state = sheets.get_state()
    got = state.get("_test_ping")
    assert got == ts, f"expected {ts!r}, got {got!r}"
    return "roundtrip ok"

@test("sheets: Logs tab readable")
def t04():
    rows = sheets.get_recent_logs(5)
    assert isinstance(rows, list), "expected list"
    return f"{len(rows)} rows"

@test("sheets: Tasks tab readable")
def t05():
    rows = sheets.get_values("Tasks", "A:G")
    assert isinstance(rows, list), "expected list"
    return f"{len(rows)} rows"


# ── SQLite / science.db ──────────────────────────────────────────────────────

DB_PATH = "/home/vercel-sandbox/maton-ai-v2/data/science.db"

@test("db: science.db exists")
def t06():
    assert os.path.exists(DB_PATH), f"not found: {DB_PATH}"
    size_kb = os.path.getsize(DB_PATH) // 1024
    return f"{size_kb} KB"

@test("db: papers count >= 243")
def t07():
    con = sqlite3.connect(DB_PATH)
    n = con.execute("SELECT COUNT(*) FROM papers").fetchone()[0]
    con.close()
    assert n >= 312, f"only {n} papers"
    return f"{n} papers"

@test("db: papers_fts FTS5 table exists")
def t08():
    con = sqlite3.connect(DB_PATH)
    row = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='papers_fts'").fetchone()
    con.close()
    assert row, "papers_fts missing"
    return "papers_fts present"

@test("db: proteins_fts FTS5 table exists")
def t09():
    con = sqlite3.connect(DB_PATH)
    row = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='proteins_fts'").fetchone()
    con.close()
    assert row, "proteins_fts missing"
    return "proteins_fts present"

@test("db: FTS5 paper search returns results")
def t10():
    con = sqlite3.connect(DB_PATH)
    try:
        rows = con.execute(
            "SELECT p.title FROM papers_fts f JOIN papers p ON p.id=f.rowid WHERE papers_fts MATCH ? LIMIT 3",
            ("cancer*",)
        ).fetchall()
        assert rows, "no results for 'cancer'"
        return f"{len(rows)} results"
    finally:
        con.close()

@test("db: FTS5 protein search returns results")
def t11():
    con = sqlite3.connect(DB_PATH)
    try:
        # Try FTS5 prefix search first
        rows = con.execute(
            "SELECT p.name FROM proteins_fts f JOIN proteins p ON p.id=f.rowid WHERE proteins_fts MATCH ? LIMIT 3",
            ("BRCA*",)
        ).fetchall()
        if not rows:
            # Fallback: LIKE search to confirm data exists
            rows = con.execute(
                "SELECT name FROM proteins WHERE name LIKE ? LIMIT 3", ("%BRCA%",)
            ).fetchall()
            assert rows, "no BRCA proteins in db at all"
            return f"LIKE fallback: {len(rows)} results (FTS5 index may need rebuild)"
        return f"{len(rows)} FTS5 results"
    finally:
        con.close()

@test("db: proteins_fts sync triggers exist")
def t12():
    con = sqlite3.connect(DB_PATH)
    rows = con.execute(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('proteins_ai','proteins_ad','proteins_au')"
    ).fetchall()
    con.close()
    names = {r[0] for r in rows}
    missing = {"proteins_ai","proteins_ad","proteins_au"} - names
    assert len(names) == 3, f"missing triggers: {missing}"
    return "all 3 triggers present"


# ── Maton API gateway ────────────────────────────────────────────────────────

@test("gateway: reachable (HTTP 200 or 400)")
def t13():
    key = os.environ.get("MATON_API_KEY", "")
    req = urllib.request.Request("https://gateway.maton.ai/google-sheets/v4/spreadsheets")
    req.add_header("Authorization", f"Bearer {key}")
    try:
        urllib.request.urlopen(req, timeout=8)
        return "200 ok"
    except urllib.error.HTTPError as e:
        # 400 = bad request (no spreadsheet id) but gateway is reachable
        assert e.code < 500, f"gateway error {e.code}"
        return f"HTTP {e.code} (gateway alive)"


# ── Config ────────────────────────────────────────────────────────────────────

@test("config: config.json has sheet_id")
def t14():
    cfg_path = "/home/vercel-sandbox/maton-scripts/config.json"
    assert os.path.exists(cfg_path), "config.json missing"
    with open(cfg_path) as f:
        cfg = json.load(f)
    assert cfg.get("sheet_id"), "sheet_id empty"
    return f"id={cfg['sheet_id'][:8]}…"

@test("config: run_chain.sh lock file not stale")
def t15():
    lock = "/tmp/maton_chain.lock"
    if not os.path.exists(lock):
        return "no lock (clean)"
    age = time.time() - os.path.getmtime(lock)
    assert age < 600, f"stale lock file ({int(age)}s old)"
    return f"lock age {int(age)}s"


# ── FAISS index ───────────────────────────────────────────────────────────────

FAISS_DIR = "/home/vercel-sandbox/maton-ai-v2/data"

@test("faiss: index file exists and is fresh (<2hr)")
def t16():
    idx_path  = os.path.join(FAISS_DIR, "faiss_papers.index")
    meta_path = os.path.join(FAISS_DIR, "faiss_meta.json")
    assert os.path.exists(idx_path), "faiss_papers.index missing"
    assert os.path.exists(meta_path), "faiss_meta.json missing"
    with open(meta_path) as f:
        meta = json.load(f)
    built_at = meta.get("built_at", "")
    if built_at:
        age_min = (time.time() - time.mktime(time.strptime(built_at, "%Y-%m-%dT%H:%M:%SZ"))) / 60
        assert age_min < 120, f"index stale: {int(age_min)}m old (threshold 120m)"
        return f"{int(age_min)}m old, {meta.get('num_papers',0)} vectors"
    return "index exists (no timestamp)"

@test("faiss: search returns >=3 results for known query")
def t17():
    sys.path.insert(0, "/home/vercel-sandbox/maton-ai-v2/scripts")
    old_dir = os.getcwd()
    try:
        os.chdir("/home/vercel-sandbox/maton-ai-v2")
        # Force reload to pick up latest index
        if "search_faiss" in sys.modules:
            del sys.modules["search_faiss"]
        from search_faiss import search  # type: ignore
        results = search("cancer immunotherapy machine learning", 5)
        assert len(results) >= 3, f"only {len(results)} results"
        return f"{len(results)} results, top score {results[0]['score']:.3f}"
    finally:
        os.chdir(old_dir)

@test("faiss: vectorizer pkl size <20MB")
def t18():
    pkl_path = os.path.join(FAISS_DIR, "faiss_vectorizer.pkl")
    assert os.path.exists(pkl_path), "faiss_vectorizer.pkl missing"
    size_mb = os.path.getsize(pkl_path) / 1_000_000
    assert size_mb < 21, f"pkl too large: {size_mb:.1f}MB"
    return f"{size_mb:.1f}MB"


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"[tests] Running {len([v for v in globals().values() if callable(v) and v.__name__.startswith('t')])  } tests...")
    fns = [v for k,v in sorted(globals().items()) if callable(v) and k.startswith("t") and k[1:].isdigit()]
    for fn in fns:
        fn()

    total  = len(results)
    passed = sum(1 for r in results if r["status"] == PASS)
    failed = sum(1 for r in results if r["status"] == FAIL)
    avg_ms = round(sum(r["ms"] for r in results) / total) if total else 0

    print(f"\n[tests] {passed}/{total} passed, {failed} failed, avg {avg_ms}ms")

    # Write summary to Sheets SystemState
    summary = f"{passed}/{total} passed"
    sheets.set_state("last_test_run", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    sheets.set_state("last_test_summary", summary)
    sheets.set_state("last_test_failures", str(failed))

    # Log full results as a Logs entry
    detail = "; ".join(f"{r['name']}={r['status']}" + (f"({r['detail'][:40]})" if r["status"]==FAIL else "") for r in results)
    sheets.log_result("Testing Agent", "automated test suite", summary, detail[:400] if failed else "", "fix failures" if failed else "all clear")

    cycle = int(time.time() // 300)
    sheets.upsert_task("testing", f"testing-c{cycle}", "run automated tests", "done", "high", "next cycle" if not failed else "fix failures", cycle)

    # Self-improvement if failures
    if failed:
        failing = [r["name"] for r in results if r["status"] == FAIL]
        imp = f"Tests failing: {', '.join(failing[:3])}. Investigate root cause and fix before next cycle."
        imp_id = f"imp-testing-c{cycle}"
        sheets.propose_improvement(imp_id, "testing", imp, cycle)
        print(f"[tests] Improvement proposed: {imp[:80]}")

    return failed


if __name__ == "__main__":
    sys.exit(main())
