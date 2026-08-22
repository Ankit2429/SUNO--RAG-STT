import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eval import dataset
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

examples = dataset.load_examples(num_answerable=50, num_unanswerable=50, seed=42)
answerable = [ex for ex in examples if ex.is_answerable]

from dataclasses import dataclass
@dataclass
class ChunkRecord:
    query_id: int
    lang: str
    is_selected: bool
    text: str

def _chunk_text(text: str, size=300, overlap=50) -> list[str]:
    text = text.strip()
    if len(text) <= size:
        return [text] if text else []
    chunks = []
    step = max(1, size - overlap)
    for start in range(0, len(text), step):
        chunk = text[start : start + size].strip()
        if chunk:
            chunks.append(chunk)
        if start + size >= len(text):
            break
    return chunks

texts = []
records = []
for ex in examples:
    selected_idx = ex.gt_passage_index
    for lang, candidates in (("en", ex.candidates_en), ("hi", ex.candidates_hi)):
        for i, passage in enumerate(candidates):
            if not passage:
                continue
            for chunk in _chunk_text(passage):
                texts.append(chunk)
                records.append(ChunkRecord(query_id=ex.query_id, lang=lang, is_selected=(i == selected_idx), text=chunk))

model_small = SentenceTransformer("intfloat/multilingual-e5-small")
model_base = SentenceTransformer("intfloat/multilingual-e5-base")

cand_texts = [f"passage: {t}" for t in texts]
vecs_small = model_small.encode(cand_texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
vecs_base = model_base.encode(cand_texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)

# Concatenate normalized vectors (each vector normalized, so concat has dimension 384+768 = 1152)
vecs_combined = np.hstack([vecs_small * 0.5, vecs_base * 0.5])
# normalize combined
vecs_combined = vecs_combined / np.linalg.norm(vecs_combined, axis=1, keepdims=True)

dim = vecs_combined.shape[1]
index = faiss.IndexHNSWFlat(dim, 16, faiss.METRIC_INNER_PRODUCT)
index.hnsw.efConstruction = 64
index.hnsw.efSearch = 64
index.add(np.array(vecs_combined, dtype=np.float32))

hits_1, hits_3, hits_5 = 0, 0, 0
r_ranks = []

for ex in answerable:
    q_en = f"query: {ex.query_en}"
    q_hi = f"query: {ex.query_hi}"
    
    vs_en = model_small.encode(q_en, normalize_embeddings=True)
    vb_en = model_base.encode(q_en, normalize_embeddings=True)
    vc_en = np.hstack([vs_en * 0.5, vb_en * 0.5])
    vc_en = (vc_en / np.linalg.norm(vc_en)).reshape(1, -1)
    
    vs_hi = model_small.encode(q_hi, normalize_embeddings=True)
    vb_hi = model_base.encode(q_hi, normalize_embeddings=True)
    vc_hi = np.hstack([vs_hi * 0.5, vb_hi * 0.5])
    vc_hi = (vc_hi / np.linalg.norm(vc_hi)).reshape(1, -1)
    
    _, idxs_en = index.search(np.array(vc_en, dtype=np.float32), 50)
    _, idxs_hi = index.search(np.array(vc_hi, dtype=np.float32), 50)
    
    r_en = next((r+1 for r, i in enumerate(idxs_en[0]) if records[i].query_id == ex.query_id and records[i].is_selected), None)
    r_hi = next((r+1 for r, i in enumerate(idxs_hi[0]) if records[i].query_id == ex.query_id and records[i].is_selected), None)
    
    best = min((r for r in (r_en, r_hi) if r is not None), default=None)
    r_ranks.append(1.0 / best if best else 0.0)
    
    if best == 1: hits_1 += 1
    if best and best <= 3: hits_3 += 1
    if best and best <= 5: hits_5 += 1

print(f"COMBINED E5-Small + E5-Base:")
print(f"Recall@1: {hits_1/50:.4f} | Recall@3: {hits_3/50:.4f} | Recall@5: {hits_5/50:.4f} | MRR: {np.mean(r_ranks):.4f}")
