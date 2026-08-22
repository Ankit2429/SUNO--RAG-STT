import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eval import dataset
from transformers import pipeline

examples = dataset.load_examples(num_answerable=3, num_unanswerable=3, seed=42)

model_name = "deepset/minilm-uncased-squad2"
print(f"Loading {model_name}...")
qa = pipeline("question-answering", model=model_name)

for ex in examples:
    print("=" * 60)
    print(f"QID: {ex.query_id} | Answerable: {ex.is_answerable}")
    print(f"Query EN: {ex.query_en}")
    
    # Test QA model on all English candidate passages
    for i, cand in enumerate(ex.candidates_en):
        if not cand:
            continue
        try:
            res = qa(question=ex.query_en, context=cand)
            score = res["score"]
            answer = res["answer"]
            if score > 0.05:
                print(f"  Cand {i} (score={score:.4f}, is_sel={i==ex.gt_passage_index}): {answer} | Context: {cand[:80]}...")
        except Exception as e:
            pass
