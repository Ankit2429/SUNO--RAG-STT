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

print(f"Total candidate chunks: {len(texts)}")

models_to_test = [
    ("paraphrase-multilingual-MiniLM-L12-v2", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", False),
    ("multilingual-e5-small", "intfloat/multilingual-e5-small", True),
]

for label, model_name, is_e5 in models_to_test:
    print(f"\n--- Testing {label} ({model_name}) ---")
    try:
        model = SentenceTransformer(model_name)
        
        # Candidate texts
        cand_texts = [f"passage: {t}" for t in texts] if is_e5 else texts
        doc_vecs = model.encode(cand_texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
        
        dim = doc_vecs.shape[1]
        index = faiss.IndexHNSWFlat(dim, 16, faiss.METRIC_INNER_PRODUCT)
        index.hnsw.efConstruction = 64
        index.hnsw.efSearch = 64
        index.add(np.array(doc_vecs, dtype=np.float32))
        
        hits_1, hits_3, hits_5 = 0, 0, 0
        r_ranks = []
        
        for ex in answerable:
            q_en = f"query: {ex.query_en}" if is_e5 else ex.query_en
            q_hi = f"query: {ex.query_hi}" if is_e5 else ex.query_hi
            
            v_en = model.encode(q_en, normalize_embeddings=True).reshape(1, -1)
            v_hi = model.encode(q_hi, normalize_embeddings=True).reshape(1, -1)
            
            _, idxs_en = index.search(np.array(v_en, dtype=np.float32), 50)
            _, idxs_hi = index.search(np.array(v_hi, dtype=np.float32), 50)
            
            r_en = next((r+1 for r, i in enumerate(idxs_en[0]) if records[i].query_id == ex.query_id and records[i].is_selected), None)
            r_hi = next((r+1 for r, i in enumerate(idxs_hi[0]) if records[i].query_id == ex.query_id and records[i].is_selected), None)
            
            best = min((r for r in (r_en, r_hi) if r is not None), default=None)
            r_ranks.append(1.0 / best if best else 0.0)
            
            if best == 1: hits_1 += 1
            if best and best <= 3: hits_3 += 1
            if best and best <= 5: hits_5 += 1
            
        print(f"Recall@1: {hits_1/50:.4f} | Recall@3: {hits_3/50:.4f} | Recall@5: {hits_5/50:.4f} | MRR: {np.mean(r_ranks):.4f}")
    except Exception as e:
        print(f"Error testing {label}: {e}")
