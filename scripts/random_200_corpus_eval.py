import os
import sys
import time
import json
import random
import httpx
import numpy as np
import pyarrow.parquet as pq
from pathlib import Path
from huggingface_hub import hf_hub_download

print("================================================================================")
print("PHASE 10: RANDOM 200-QUERY FULL-CORPUS MULTILINGUAL EVALUATION")
print("================================================================================\n")

random.seed(1337)

hinval_path = Path(hf_hub_download(repo_id="ai4bharat/MSMARCO-XI", repo_type="dataset", filename="validation/hinval.parquet"))
print(f"Loading from {hinval_path.name}...")
pf = pq.ParquetFile(hinval_path)

all_answerable = []
all_unanswerable = []

for batch in pf.iter_batches(batch_size=5000):
  rows = batch.to_pylist()
  for r in rows:
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
        "query_id": r["query_id"],
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
        "query_id": r["query_id"],
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

# Sample 100 answerable and 100 unanswerable randomly
sample_ans = random.sample(all_answerable, 100)
sample_unans = random.sample(all_unanswerable, 100)
eval_set = sample_ans + sample_unans
random.shuffle(eval_set)

print(f"Total sampled evaluation set: {len(eval_set)} (100 Answerable + 100 Unanswerable)\n")

client = httpx.Client(base_url="http://127.0.0.1:3000", timeout=30.0)

# Metrics
recalls = {1: 0, 3: 0, 5: 0}
mrr = 0.0
total_ans_eval = 0

false_refusals = 0
false_confidences = 0
correct_answers = 0
correct_refusals = 0

latencies_embed = []
latencies_gen = []
latencies_total = []

for i, ex in enumerate(eval_set):
  t0 = time.perf_counter()
  
  # Embed candidates
  all_cands = ex["cands_en"] + ex["cands_hi"]
  t_emb0 = time.perf_counter()
  resp_cands = client.post("/api/eval/embed", json={"texts": all_cands})
  cands_vecs = np.asarray(resp_cands.json()["vectors"], dtype=np.float32)
  
  # Embed query
  resp_q = client.post("/api/eval/embed-one", json={"text": ex["query"]})
  q_vec = np.asarray(resp_q.json()["vector"], dtype=np.float32)
  t_emb1 = time.perf_counter()
  latencies_embed.append((t_emb1 - t_emb0) * 1000.0)
  
  # Rank
  scores = cands_vecs @ q_vec
  ranked = np.argsort(-scores)
  
  top_5_idx = ranked[:5]
  top_contexts = [{"text": all_cands[idx], "score": float(scores[idx]), "id": f"cand-{idx}"} for idx in top_5_idx]
  
  # Generation / Synthesis
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
      false_refusals += 1
    else:
      correct_answers += 1
  else:
    if is_grounded:
      false_confidences += 1
    else:
      correct_refusals += 1

  if (i + 1) % 50 == 0:
    print(f"Processed {i + 1}/{len(eval_set)} queries...")

def p(arr, q):
  return np.percentile(arr, q)

print("\n" + "=" * 80)
print("RANDOM 200-QUERY FULL-CORPUS BENCHMARK RESULTS")
print("=" * 80)

print(f"\nRETRIEVAL (Across {total_ans_eval} Answerable Queries):")
print(f"  Recall@1:  {recalls[1] / total_ans_eval:.4f} ({recalls[1]}/{total_ans_eval})")
print(f"  Recall@3:  {recalls[3] / total_ans_eval:.4f} ({recalls[3]}/{total_ans_eval})")
print(f"  Recall@5:  {recalls[5] / total_ans_eval:.4f} ({recalls[5]}/{total_ans_eval})")
print(f"  MRR:       {mrr / total_ans_eval:.4f}")

print(f"\nRELIABILITY & GROUNDING:")
print(f"  False Refusal Rate:    {false_refusals / 100:.4f} ({false_refusals}/100 answerable)")
print(f"  False Confidence Rate: {false_confidences / 100:.4f} ({false_confidences}/100 unanswerable)")
print(f"  Correct Grounded Rate: {correct_answers / 100:.4f} ({correct_answers}/100 answerable)")
print(f"  Correct Refusal Rate:  {correct_refusals / 100:.4f} ({correct_refusals}/100 unanswerable)")

print(f"\nLATENCY METRICS (ms across 200 real requests):")
print(f"  Stage                 P50       P70       P90       P95       P100      MAX")
print(f"  -------------------------------------------------------------------------")
print(f"  Query+Cand Embed     {p(latencies_embed, 50):6.2f}    {p(latencies_embed, 70):6.2f}    {p(latencies_embed, 90):6.2f}    {p(latencies_embed, 95):6.2f}    {p(latencies_embed, 100):6.2f}    {np.max(latencies_embed):6.2f}")
print(f"  Evidence Gate + Gen  {p(latencies_gen, 50):6.2f}    {p(latencies_gen, 70):6.2f}    {p(latencies_gen, 90):6.2f}    {p(latencies_gen, 95):6.2f}    {p(latencies_gen, 100):6.2f}    {np.max(latencies_gen):6.2f}")
print(f"  Total HTTP RAG Loop  {p(latencies_total, 50):6.2f}    {p(latencies_total, 70):6.2f}    {p(latencies_total, 90):6.2f}    {p(latencies_total, 95):6.2f}    {p(latencies_total, 100):6.2f}    {np.max(latencies_total):6.2f}")
print("=" * 80)
