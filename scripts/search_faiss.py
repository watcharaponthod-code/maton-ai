"""
FAISS semantic search for papers.
Usage: python3 search_faiss.py "cancer immunotherapy deep learning" --k 5
Or: import and call search(query, k)
"""
import os, json, pickle, sys
import numpy as np
import faiss
from sklearn.preprocessing import normalize

DATA = os.path.join(os.path.dirname(__file__), "../data")

_cache = {}

def _load():
    if _cache: return _cache
    _cache["index"] = faiss.read_index(os.path.join(DATA, "faiss_papers.index"))
    _cache["ids"]   = json.load(open(os.path.join(DATA, "faiss_id_map.json")))
    _cache["metas"] = json.load(open(os.path.join(DATA, "faiss_metas.json")))
    with open(os.path.join(DATA, "faiss_vectorizer.pkl"), "rb") as f:
        v = pickle.load(f)
    _cache["tfidf"] = v["tfidf"]
    _cache["svd"]   = v["svd"]
    return _cache

def search(query: str, k: int = 8) -> list[dict]:
    """Return top-k papers by semantic similarity to query."""
    c = _load()
    vec = c["tfidf"].transform([query])
    vec = c["svd"].transform(vec).astype(np.float32)
    vec = normalize(vec, norm="l2")
    scores, indices = c["index"].search(vec, k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0: continue
        m = c["metas"][idx]
        results.append({**m, "score": round(float(score), 4)})
    return results

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("query", nargs="+")
    p.add_argument("--k", type=int, default=5)
    args = p.parse_args()
    q = " ".join(args.query)
    print(f"Query: {q!r}\n")
    for r in search(q, args.k):
        print(f"  [{r['score']:.3f}] ({r['year']}) {r['title'][:80]}")
