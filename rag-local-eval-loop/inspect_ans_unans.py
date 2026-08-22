import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eval import dataset

examples = dataset.load_examples(num_answerable=50, num_unanswerable=50, seed=42)

ans = [ex for ex in examples if ex.is_answerable]
unans = [ex for ex in examples if not ex.is_answerable]

print("=== SAMPLE ANSWERABLE EXAMPLES ===")
for ex in ans[:5]:
    sel = ex.candidates_en[ex.gt_passage_index] if ex.gt_passage_index is not None else ""
    print(f"Q: {ex.query_en}")
    print(f"A: {ex.gt_answer_en}")
    print(f"Passage: {sel[:120]}...\n")

print("=== SAMPLE UNANSWERABLE EXAMPLES ===")
for ex in unans[:5]:
    print(f"Q: {ex.query_en}")
    print(f"A: {ex.gt_answer_en}")
    print(f"Candidates count: {len(ex.candidates_en)}")
    print(f"Candidate 0: {ex.candidates_en[0][:120]}...\n")
