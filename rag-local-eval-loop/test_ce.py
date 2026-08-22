import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eval import dataset
from sentence_transformers import CrossEncoder

examples = dataset.load_examples(num_answerable=3, num_unanswerable=3, seed=42)

model_name = "cross-encoder/ms-marco-MiniLM-L-6-v2"
print(f"Loading {model_name}...")
ce = CrossEncoder(model_name)

for ex in examples:
    print("=" * 60)
    print(f"QID: {ex.query_id} | Answerable: {ex.is_answerable}")
    print(f"Query EN: {ex.query_en}")
    
    # Score candidate passages with cross-encoder
    pairs = [[ex.query_en, cand] for cand in ex.candidates_en if cand]
    scores = ce.predict(pairs)
    
    best_idx = int(scores.argmax())
    best_score = float(scores[best_idx])
    
    print(f"  Best Candidate Index: {best_idx} | Score: {best_score:.4f}")
    print(f"  Candidate Text: {ex.candidates_en[best_idx][:120]}...")
    print(f"  Is Selected: {best_idx == ex.gt_passage_index}")
