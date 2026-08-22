import os
import sys
import time
import json
import random
import httpx
import numpy as np
import pyarrow.parquet as pq
from pathlib import Path

print("================================================================================")
print("PHASE 4: FRESH RANDOM 500-QUERY GENERALIZATION EVALUATION (SEED 6060)")
print("================================================================================\n")

hinval_path = Path("C:/Users/godby/.cache/huggingface/hub/datasets--ai4bharat--MSMARCO-XI/snapshots/bf5cdc1f26e581e519018e434db14edd1b77602b/validation/hinval.parquet")
pf = pq.ParquetFile(hinval_path)

all_answerable = []
all_unanswerable = []

row_idx = 0
for batch in pf.iter_batches(batch_size=5000):
  rows = batch.to_pylist()
  for r in rows:
    row_idx += 1
    qid = r["query_id"]
    passages = r.get("passages") or {}
    selected = passages.get("is_selected") or []
    cands_en = passages.get("English_passages") or []
    cands_hi = passages.get("Translated_passages") or []
    ans_en = (r.get("Eng_Answer") or "").strip()
    q_hi = (r.get("query") or "").strip()
    q_en = (r.get("Eng_Query") or "").strip()
    
    pos_idx = next((i for i, s in enumerate(selected) if s == 1), None)
    if pos_idx is not None and ans_en.lower() not in {"no answer present.", ""}:
      all_answerable.append({
        "query_id": qid,
        "query": q_hi,
        "query_en": q_en,
        "is_answerable": True,
        "pos_idx": pos_idx,
        "cands_en": cands_en,
        "cands_hi": cands_hi,
        "gt_answer": ans_en
      })
    elif pos_idx is None and ans_en.lower() in {"no answer present.", ""}:
      all_unanswerable.append({
        "query_id": qid,
        "query": q_hi,
        "query_en": q_en,
        "is_answerable": False,
        "pos_idx": None,
        "cands_en": cands_en,
        "cands_hi": cands_hi,
        "gt_answer": None
      })
    if len(all_answerable) >= 2000 and len(all_unanswerable) >= 2000:
      break
  if len(all_answerable) >= 2000 and len(all_unanswerable) >= 2000:
    break

# New random seed 6060
random.seed(6060)
sample_ans = random.sample(all_answerable, 250)
sample_unans = random.sample(all_unanswerable, 250)
eval_set = sample_ans + sample_unans
random.shuffle(eval_set)

print(f"Sampled 500 Evaluation Queries (250 Answerable + 250 Unanswerable, Seed 6060)\n")

client = httpx.Client(base_url="http://127.0.0.1:3000", timeout=30.0)

recalls = {1: 0, 3: 0, 5: 0}
mrr = 0.0
total_ans_eval = 0

false_refusals = []
false_confidences = []
correct_answers = []
correct_refusals = []

latencies_embed = []
latencies_gen = []
latencies_total = []

for i, ex in enumerate(eval_set):
  t0 = time.perf_counter()
  all_cands = ex["cands_en"] + ex["cands_hi"]
  
  t_emb0 = time.perf_counter()
  resp_cands = client.post("/api/eval/embed", json={"texts": all_cands})
  cands_vecs = np.asarray(resp_cands.json()["vectors"], dtype=np.float32)
  
  resp_q = client.post("/api/eval/embed-one", json={"text": ex["query"]})
  q_vec = np.asarray(resp_q.json()["vector"], dtype=np.float32)
  t_emb1 = time.perf_counter()
  latencies_embed.append((t_emb1 - t_emb0) * 1000.0)
  
  scores = cands_vecs @ q_vec
  ranked = np.argsort(-scores)
  
  top_5_idx = ranked[:5]
  top_contexts = [{"text": all_cands[idx], "score": float(scores[idx]), "id": f"cand-{idx}"} for idx in top_5_idx]
  
  t_gen0 = time.perf_counter()
  resp_gen = client.post("/api/eval/generate", json={"query": ex["query"], "contexts": top_contexts})
  t_gen1 = time.perf_counter()
  
  gen_data = resp_gen.json()
  latencies_gen.append(float(gen_data.get("generation_ms", (t_gen1 - t_gen0) * 1000.0)))
  latencies_total.append((time.perf_counter() - t0) * 1000.0)
  
  is_grounded = bool(gen_data.get("grounded", False))
  
  if ex["is_answerable"]:
    total_ans_eval += 1
    gold_en = ex["pos_idx"]
    gold_hi = ex["pos_idx"] + len(ex["cands_en"])
    
    rank = None
    for r, idx in enumerate(ranked):
      if idx == gold_en or idx == gold_hi:
        rank = r + 1
        break
        
    if rank is not None:
      mrr += 1.0 / rank
      if rank <= 1: recalls[1] += 1
      if rank <= 3: recalls[3] += 1
      if rank <= 5: recalls[5] += 1
      
    if not is_grounded:
      false_refusals.append(ex)
    else:
      correct_answers.append(ex)
  else:
    if is_grounded:
      false_confidences.append(ex)
    else:
      correct_refusals.append(ex)

  if (i + 1) % 100 == 0:
    print(f"Processed {i + 1}/500 queries...")

def p(arr, q):
  return np.percentile(arr, q)

print("\n" + "=" * 80)
print("RANDOM 500-QUERY BENCHMARK RESULTS (SEED 6060)")
print("=" * 80)

print(f"\nRETRIEVAL (Across {total_ans_eval} Answerable Queries):")
print(f"  Recall@1:  {recalls[1] / total_ans_eval:.4f} ({recalls[1]}/{total_ans_eval})")
print(f"  Recall@3:  {recalls[3] / total_ans_eval:.4f} ({recalls[3]}/{total_ans_eval})")
print(f"  Recall@5:  {recalls[5] / total_ans_eval:.4f} ({recalls[5]}/{total_ans_eval})")
print(f"  MRR:       {mrr / total_ans_eval:.4f}")

print(f"\nRELIABILITY & GROUNDING:")
print(f"  False Refusal Rate:    {len(false_refusals) / total_ans_eval * 100:.2f}% ({len(false_refusals)}/{total_ans_eval})")
print(f"  False Confidence Rate: {len(false_confidences) / len(sample_unans) * 100:.2f}% ({len(false_confidences)}/{len(sample_unans)})")
print(f"  Correct Grounded Rate: {len(correct_answers) / total_ans_eval * 100:.2f}% ({len(correct_answers)}/{total_ans_eval})")
print(f"  Safe Refusal Rate:     {len(correct_refusals) / len(sample_unans) * 100:.2f}% ({len(correct_refusals)}/{len(sample_unans)})")

print(f"\nLATENCY METRICS (ms across 500 real requests):")
print(f"  Stage                 P50       P70       P90       P95       P100      MAX")
print(f"  -------------------------------------------------------------------------")
print(f"  Query+Cand Embed     {p(latencies_embed, 50):6.2f}    {p(latencies_embed, 70):6.2f}    {p(latencies_embed, 90):6.2f}    {p(latencies_embed, 95):6.2f}    {p(latencies_embed, 100):6.2f}    {np.max(latencies_embed):6.2f}")
print(f"  Evidence Gate + Gen  {p(latencies_gen, 50):6.2f}    {p(latencies_gen, 70):6.2f}    {p(latencies_gen, 90):6.2f}    {p(latencies_gen, 95):6.2f}    {p(latencies_gen, 100):6.2f}    {np.max(latencies_gen):6.2f}")
print(f"  Total HTTP RAG Loop  {p(latencies_total, 50):6.2f}    {p(latencies_total, 70):6.2f}    {p(latencies_total, 90):6.2f}    {p(latencies_total, 95):6.2f}    {p(latencies_total, 100):6.2f}    {np.max(latencies_total):6.2f}")
print("=" * 80)
