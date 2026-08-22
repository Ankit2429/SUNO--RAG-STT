import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

os.environ["EVAL_EMBEDDER_MODULE"] = "eval.http_target"
os.environ["EVAL_GENERATOR_MODULE"] = "eval.http_target"
os.environ["RAG_PROJECT_ROOT"] = "d:/antigravity projects/SUNO--RAG-STT"

from eval import dataset, index_build, pipeline

from sentence_transformers import SentenceTransformer
import numpy as np
import re

examples = dataset.load_examples(num_answerable=3, num_unanswerable=3, seed=42)
index, records = index_build.build_index(examples)

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

for ex in examples:
    print("=" * 60)
    print(f"QID: {ex.query_id} | Answerable: {ex.is_answerable}")
    print(f"Query EN: {ex.query_en}")
    print(f"Query HI: {ex.query_hi}")
    print(f"GT Answer: {ex.gt_answer_en}")
    
    # Search index
    q_vec = model.encode(ex.query_en, normalize_embeddings=True).reshape(1, -1)
    scores, indices = index.search(q_vec, 5)
    
    for rank, (score, idx) in enumerate(zip(scores[0], indices[0])):
        rec = records[idx]
        print(f"  Hit {rank+1} (score={score:.4f}, qid={rec.query_id}, lang={rec.lang}, is_sel={rec.is_selected}): {rec.text[:100]}...")
