import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

os.environ["EVAL_EMBEDDER_MODULE"] = "eval.http_target"
os.environ["EVAL_GENERATOR_MODULE"] = "eval.http_target"
os.environ["RAG_PROJECT_ROOT"] = "d:/antigravity projects/SUNO--RAG-STT"

from eval import dataset, index_build, pipeline
import numpy as np

examples = dataset.load_examples(num_answerable=50, num_unanswerable=50, seed=42)
index, records = index_build.build_index(examples)

from eval import target
embed_one = target.get_embedder().embed_one

answerable = [ex for ex in examples if ex.is_answerable]
print(f"Total answerable queries: {len(answerable)}")

def _search(query_text, top_k=5):
    vec = embed_one(query_text).reshape(1, -1)
    scores, indices = index.search(vec, top_k)
    return scores[0], indices[0]

misses = []
hits_at_1 = 0
hits_at_3 = 0
hits_at_5 = 0

for ex in answerable:
    scores_en, idxs_en = _search(ex.query_en, 5)
    scores_hi, idxs_hi = _search(ex.query_hi, 5)
    
    # Check if gt is in top-k
    # A hit is relevant if records[i].query_id == ex.query_id and records[i].is_selected
    rank_en = next((r+1 for r, i in enumerate(idxs_en) if records[i].query_id == ex.query_id and records[i].is_selected), None)
    rank_hi = next((r+1 for r, i in enumerate(idxs_hi) if records[i].query_id == ex.query_id and records[i].is_selected), None)
    
    best_rank = min((r for r in (rank_en, rank_hi) if r is not None), default=None)
    
    if best_rank == 1:
        hits_at_1 += 1
    if best_rank and best_rank <= 3:
        hits_at_3 += 1
    if best_rank and best_rank <= 5:
        hits_at_5 += 1
    else:
        misses.append({
            "ex": ex,
            "rank_en": rank_en,
            "rank_hi": rank_hi,
            "scores_en": scores_en,
            "idxs_en": idxs_en,
            "scores_hi": scores_hi,
            "idxs_hi": idxs_hi,
        })

print(f"Recall@1: {hits_at_1}/{len(answerable)} = {hits_at_1/len(answerable):.4f}")
print(f"Recall@3: {hits_at_3}/{len(answerable)} = {hits_at_3/len(answerable):.4f}")
print(f"Recall@5: {hits_at_5}/{len(answerable)} = {hits_at_5/len(answerable):.4f}")
print(f"Total Misses: {len(misses)}")

print("\n" + "="*80)
print("DETAILED BREAKDOWN OF MISSES:")
print("="*80)

for m in misses:
    ex = m["ex"]
    print(f"\n--- QID: {ex.query_id} ---")
    print(f"Query EN: {ex.query_en}")
    print(f"Query HI: {ex.query_hi}")
    print(f"GT Passage EN: {ex.candidates_en[ex.gt_passage_index][:150]}...")
    print(f"GT Passage HI: {ex.candidates_hi[ex.gt_passage_index][:150]}...")
    print(f"Rank EN: {m['rank_en']} | Rank HI: {m['rank_hi']}")
    print("Top 5 Retrieved EN:")
    for r, (score, i) in enumerate(zip(m["scores_en"], m["idxs_en"])):
        rec = records[i]
        print(f"  {r+1}. [score={score:.4f}, qid={rec.query_id}, lang={rec.lang}, sel={rec.is_selected}]: {rec.text[:90]}...")
