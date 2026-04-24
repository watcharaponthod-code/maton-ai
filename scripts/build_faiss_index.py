"""
Build FAISS index from papers in science.db.

Architecture: TF-IDF sparse → dense projection → FAISS IndexFlatIP (cosine similarity).
Swap-ready for BGE embeddings when sentence-transformers+torch are available.

Outputs:
  data/faiss_papers.index   — FAISS index (float32, dim=512)
  data/faiss_id_map.json    — maps FAISS position → paper id
  data/faiss_meta.json      — build stats
"""
import sqlite3, json, os, time
import numpy as np
import faiss
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
import pickle

DB   = os.path.join(os.path.dirname(__file__), "../data/science.db")
OUT  = os.path.join(os.path.dirname(__file__), "../data")
DIM  = 512   # latent dim after SVD

def build():
    t0 = time.time()
    con = sqlite3.connect(DB)
    rows = con.execute("SELECT id, title, abstract, year, source FROM papers").fetchall()
    con.close()
    print(f"Loaded {len(rows)} papers from DB")

    ids      = [r[0] for r in rows]
    texts    = [f"{r[1]} {r[2]}" for r in rows]   # title + abstract
    metas    = [{"id": r[0], "title": r[1], "year": r[4], "source": r[3]} for r in rows]  # note: year=r[2], source=r[4]

    # Fix meta indexing
    metas = [{"id": r[0], "title": r[1], "year": r[2], "source": r[3]} for r in rows]  # year=r[2], source=r[3]
    # Actually: id=r[0], title=r[1], abstract=r[2], year=r[3], source=r[4]
    metas = [{"id": r[0], "title": r[1], "year": r[3], "source": r[4]} for r in rows]

    # TF-IDF → SVD → L2-normalize (gives cosine similarity via dot product)
    print("Building TF-IDF matrix...")
    tfidf = TfidfVectorizer(max_features=20000, sublinear_tf=True, ngram_range=(1,2), min_df=1)
    X_sparse = tfidf.fit_transform(texts)
    print(f"  TF-IDF shape: {X_sparse.shape}")

    print(f"Applying SVD (dim={DIM})...")
    actual_dim = min(DIM, X_sparse.shape[1] - 1, X_sparse.shape[0] - 1)
    svd = TruncatedSVD(n_components=actual_dim, random_state=42)
    X_dense = svd.fit_transform(X_sparse).astype(np.float32)
    X_dense = normalize(X_dense, norm="l2")
    print(f"  Dense matrix: {X_dense.shape}, explained variance: {svd.explained_variance_ratio_.sum():.3f}")

    # Build FAISS index
    print("Building FAISS index...")
    index = faiss.IndexFlatIP(actual_dim)   # inner product on L2-normalized = cosine
    index.add(X_dense)
    print(f"  Index size: {index.ntotal} vectors")

    # Save
    faiss.write_index(index, os.path.join(OUT, "faiss_papers.index"))
    with open(os.path.join(OUT, "faiss_id_map.json"), "w") as f:
        json.dump(ids, f)
    with open(os.path.join(OUT, "faiss_metas.json"), "w") as f:
        json.dump(metas, f)
    with open(os.path.join(OUT, "faiss_vectorizer.pkl"), "wb") as f:
        pickle.dump({"tfidf": tfidf, "svd": svd, "dim": actual_dim}, f)

    meta = {
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "num_papers": len(rows),
        "dim": actual_dim,
        "embedding": "tfidf+svd",
        "note": "Swap tfidf+svd for BGE-M3 when sentence-transformers+torch available",
        "elapsed_s": round(time.time() - t0, 2),
    }
    with open(os.path.join(OUT, "faiss_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Done in {meta['elapsed_s']}s. Files saved to {OUT}/")
    return meta

if __name__ == "__main__":
    build()
