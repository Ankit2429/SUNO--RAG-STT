import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eval import dataset
from sentence_transformers import CrossEncoder

examples = dataset.load_examples(num_answerable=3, num_unanswerable=3, seed=42)

model_name = "cross-encoder/nli-deberta-v3-xsmall"
print(f"Loading {model_name}...")
nli = CrossEncoder(model_name)

for ex in examples:
    print("=" * 60)
    print(f"QID: {ex.query_id} | Answerable: {ex.is_answerable}")
    print(f"Query EN: {ex.query_en}")
    
    # NLI hypothesis: "This text answers the question: {query}" or direct premise-hypothesis
    for i, cand in enumerate(ex.candidates_en):
        if not cand:
            continue
        scores = nli.predict([[cand, f"This text provides the answer for: {ex.query_en}"]])
        # scores: [contradiction, entailment, neutral]
        import numpy as np
        probs = np.exp(scores[0]) / np.sum(np.exp(scores[0]))
        if probs[1] > 0.30 or i == ex.gt_passage_index:
            print(f"  Cand {i} (is_sel={i==ex.gt_passage_index}): Entailment={probs[1]:.4f}, Contradiction={probs[0]:.4f}, Neutral={probs[2]:.4f}")
            print(f"    Text: {cand[:100]}...")
