import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

os.environ["EVAL_EMBEDDER_MODULE"] = "eval.http_target"
os.environ["EVAL_GENERATOR_MODULE"] = "eval.http_target"
os.environ["RAG_PROJECT_ROOT"] = "d:/antigravity projects/SUNO--RAG-STT"

from eval import dataset, index_build
import numpy as np

examples = dataset.load_examples(num_answerable=50, num_unanswerable=50, seed=42)
index, records = index_build.build_index(examples)

from eval import target
embed_one = target.get_embedder().embed_one

answerable = [ex for ex in examples if ex.is_answerable]

ranks_en = []
ranks_hi = []
ranks_best = []

for ex in answerable:
    vec_en = embed_one(ex.query_en).reshape(1, -1)
    vec_hi = embed_one(ex.query_hi).reshape(1, -1)
    
    scores_en, idxs_en = index.search(vec_en, 50)
    scores_hi, idxs_hi = index.search(vec_hi, 50)
    
    r_en = next((r+1 for r, i in enumerate(idxs_en[0]) if records[i].query_id == ex.query_id and records[i].is_selected), None)
    r_hi = next((r+1 for r, i in enumerate(idxs_hi[0]) if records[i].query_id == ex.query_id and records[i].is_selected), None)
    
    best = min((r for r in (r_en, r_hi) if r is not None), default=999)
    ranks_en.append(r_en)
    ranks_hi.append(r_hi)
    ranks_best.append(best)
    
    if best > 5:
        print(f"QID: {ex.query_id} | Best Rank: {best} (EN: {r_en}, HI: {r_hi}) | Query: {ex.query_en}")

print("\nRank distribution:")
for k in range(1, 15):
    count = sum(1 for b in ranks_best if b <= k)
    print(f"Recall@{k}: {count}/50 = {count/50:.4f}")
