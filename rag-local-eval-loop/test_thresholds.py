import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eval import dataset
from sentence_transformers import SentenceTransformer, CrossEncoder
import faiss
import numpy as np

examples = dataset.load_examples(num_answerable=50, num_unanswerable=50, seed=42)

model = SentenceTransformer("intfloat/multilingual-e5-small")
ce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

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

cand_texts = [f"passage: {t}" for t in texts]
doc_vecs = model.encode(cand_texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)

dim = doc_vecs.shape[1]
index = faiss.IndexHNSWFlat(dim, 16, faiss.METRIC_INNER_PRODUCT)
index.hnsw.efConstruction = 64
index.hnsw.efSearch = 64
index.add(np.array(doc_vecs, dtype=np.float32))

scores_ans = []
scores_unans = []

for ex in examples:
    q_en = f"query: {ex.query_en}"
    q_hi = f"query: {ex.query_hi}"
    
    v_en = model.encode(q_en, normalize_embeddings=True).reshape(1, -1)
    v_hi = model.encode(q_hi, normalize_embeddings=True).reshape(1, -1)
    
    _, idxs_en = index.search(np.array(v_en, dtype=np.float32), 5)
    _, idxs_hi = index.search(np.array(v_hi, dtype=np.float32), 5)
    
    top_chunks = [records[i].text for i in idxs_en[0]] + [records[i].text for i in idxs_hi[0]]
    # dedup
    top_chunks = list(dict.fromkeys(top_chunks))[:5]
    
    pairs = [[ex.query_en, c] for c in top_chunks]
    ce_scores = ce.predict(pairs)
    max_score = float(np.max(ce_scores))
    
    if ex.is_answerable:
        scores_ans.append((ex, max_score))
    else:
        scores_unans.append((ex, max_score))

print("\n--- Answerable Query CE Scores ---")
print(f"Min: {min(s[1] for s in scores_ans):.2f}, Median: {np.median([s[1] for s in scores_ans]):.2f}, Max: {max(s[1] for s in scores_ans):.2f}")
for ex, s in sorted(scores_ans, key=lambda x: x[1])[:10]:
    print(f"  Score: {s:6.2f} | QID: {ex.query_id} | Q: {ex.query_en}")

print("\n--- Unanswerable Query CE Scores ---")
print(f"Min: {min(s[1] for s in scores_unans):.2f}, Median: {np.median([s[1] for s in scores_unans]):.2f}, Max: {max(s[1] for s in scores_unans):.2f}")
for ex, s in sorted(scores_unans, key=lambda x: x[1], reverse=True)[:10]:
    print(f"  Score: {s:6.2f} | QID: {ex.query_id} | Q: {ex.query_en}")

# Threshold sweep
print("\n--- Threshold Sweep ---")
for thresh in np.arange(0.0, 7.0, 0.5):
    # False refusal: answerable but score < thresh
    fr = sum(1 for _, s in scores_ans if s < thresh) / len(scores_ans)
    # False confidence: unanswerable but score >= thresh
    fc = sum(1 for _, s in scores_unans if s >= thresh) / len(scores_unans)
    print(f"Thresh: {thresh:4.1f} -> False Refusal: {fr*100:4.1f}% ({sum(1 for _, s in scores_ans if s < thresh)}/50) | False Confidence: {fc*100:4.1f}% ({sum(1 for _, s in scores_unans if s >= thresh)}/50)")
