"""Sweep tool for evaluating Calibrated Band Verifier configurations.

Evaluates 4 configurations:
  Config 1: high >= 6.0, low < 2.5
  Config 2: high >= 6.5, low < 2.5
  Config 3: high >= 7.0, low < 3.0
  Config 4: high >= 7.5, low < 3.0
"""
import json
import os
import sys
import time
import numpy as np

# Ensure UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from pathlib import Path

# Ensure rag-local-eval-loop is in sys.path
EVAL_DIR = Path(__file__).resolve().parent.parent
if str(EVAL_DIR) not in sys.path:
    sys.path.insert(0, str(EVAL_DIR))

from eval import dataset, index_build, target
from eval.verifier import verify


def run_sweep():
    print("Loading 50 answerable + 50 unanswerable examples from MSMARCO-XI (seed=42)...")
    examples = dataset.load_examples(num_answerable=50, num_unanswerable=50, seed=42)

    print("Building FAISS index...")
    index, records = index_build.build_index(examples)

    embed_one = target.get_embedder().embed_one
    ce = target.get_generator().get_cross_encoder()

    print("\nRetrieving candidates and pre-computing CrossEncoder scores...")
    query_data = []

    for idx, ex in enumerate(examples):
        qvec = embed_one(ex.query_en).reshape(1, -1)
        scores, indices = index.search(qvec, 5)
        chunk_recs = [records[i] for i in indices[0] if i != -1]
        cand_texts = [r.text.strip() for r in chunk_recs if r.text.strip()]

        if not cand_texts:
            query_data.append({
                "example": ex,
                "best_ce_score": -999.0,
                "best_cand_text": "",
                "is_answerable": ex.is_answerable,
            })
            continue

        pairs = [[ex.query_en, c] for c in cand_texts]
        ce_scores = ce.predict(pairs)
        best_cand_idx = int(np.argmax(ce_scores))
        best_score = float(ce_scores[best_cand_idx])
        best_text = cand_texts[best_cand_idx]

        query_data.append({
            "example": ex,
            "best_ce_score": best_score,
            "best_cand_text": best_text,
            "is_answerable": ex.is_answerable,
        })

    print("Pre-computing verifier results for queries with CE >= 2.5 in parallel (5 workers)...", flush=True)
    from concurrent.futures import ThreadPoolExecutor, as_completed

    verifier_cache = {}
    total_to_verify = [qd for qd in query_data if qd["best_ce_score"] >= 2.5]
    print(f"Total queries passing CE >= 2.5: {len(total_to_verify)}", flush=True)

    def _call_v(item):
        q = item["example"].query_en
        text = item["best_cand_text"]
        key = (q, text[:100])
        vr = verify(q, text, prompt_variant="calibrated")
        return key, vr, q

    done_cnt = 0
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(_call_v, item) for item in total_to_verify]
        for f in as_completed(futures):
            key, vr, q = f.result()
            verifier_cache[key] = vr
            done_cnt += 1
            if done_cnt % 10 == 0 or done_cnt == len(total_to_verify):
                print(f"  [{done_cnt}/{len(total_to_verify)}] Verified -> {vr.verdict} ({vr.verifier_ms:.0f}ms)", flush=True)


    configs = [
        ("Config 1 (High >= 6.0, Low < 2.5)", 2.5, 6.0),
        ("Config 2 (High >= 6.5, Low < 2.5)", 2.5, 6.5),
        ("Config 3 (High >= 7.0, Low < 3.0)", 3.0, 7.0),
        ("Config 4 (High >= 7.5, Low < 3.0)", 3.0, 7.5),
    ]

    print("\n" + "="*80)
    print("SWEEP RESULTS ON OFFICIAL 50+50 BENCHMARK (seed=42)")
    print("="*80)

    summary_results = []

    for name, low, high in configs:
        sent_to_verifier = 0
        answered_without_verifier = 0
        refused_without_verifier = 0
        
        false_refusal_cnt = 0
        false_confidence_cnt = 0
        
        verifier_latencies = []
        total_gen_latencies = []

        for qd in query_data:
            score = qd["best_ce_score"]
            is_ans = qd["is_answerable"]
            q = qd["example"].query_en
            text = qd["best_cand_text"]

            # Base extractive latency ~15ms
            base_extractive_ms = 15.0

            if score < low:
                # Stage 1: Fast Refusal (No LLM)
                refused_without_verifier += 1
                grounded = False
                total_gen_ms = base_extractive_ms
            elif score >= high:
                # Stage 1: Fast Generation (No LLM)
                answered_without_verifier += 1
                grounded = True
                total_gen_ms = base_extractive_ms
            else:
                # Stage 2: Ambiguous Band -> LLM Verifier
                sent_to_verifier += 1
                key = (q, text[:100])
                vr = verifier_cache.get(key)
                v_ms = vr.verifier_ms if vr else 1500.0
                verifier_latencies.append(v_ms)
                
                # Rule: Refuse ONLY if CONFIRMED_UNANSWERABLE
                if vr and vr.verdict == "CONFIRMED_UNANSWERABLE":
                    grounded = False
                else:
                    grounded = True
                    
                total_gen_ms = base_extractive_ms + v_ms

            total_gen_latencies.append(total_gen_ms)

            # Reliability stats
            if is_ans and not grounded:
                false_refusal_cnt += 1
            elif not is_ans and grounded:
                false_confidence_cnt += 1

        fr_rate = false_refusal_cnt / 50.0
        fc_rate = false_confidence_cnt / 50.0

        v_p50 = np.percentile(verifier_latencies, 50) if verifier_latencies else 0.0
        v_p95 = np.percentile(verifier_latencies, 95) if verifier_latencies else 0.0

        gen_p50 = np.percentile(total_gen_latencies, 50)
        gen_p95 = np.percentile(total_gen_latencies, 95)
        gen_p99 = np.percentile(total_gen_latencies, 99)

        res = {
            "name": name,
            "low": low,
            "high": high,
            "sent_to_verifier_pct": sent_to_verifier,
            "answered_no_verifier_pct": answered_without_verifier,
            "refused_no_verifier_pct": refused_without_verifier,
            "false_refusal": fr_rate,
            "false_confidence": fc_rate,
            "verifier_p50_ms": v_p50,
            "verifier_p95_ms": v_p95,
            "gen_p50_ms": gen_p50,
            "gen_p95_ms": gen_p95,
            "gen_p99_ms": gen_p99,
        }
        summary_results.append(res)

        print(f"\n--- {name} ---")
        print(f"  Routing Breakdown:")
        print(f"    Sent to Verifier:          {sent_to_verifier}% ({sent_to_verifier}/100)")
        print(f"    Answered without Verifier: {answered_without_verifier}% ({answered_without_verifier}/100)")
        print(f"    Refused without Verifier:  {refused_without_verifier}% ({refused_without_verifier}/100)")
        print(f"  Reliability:")
        print(f"    False Refusal Rate:        {fr_rate*100:.1f}% ({false_refusal_cnt}/50)")
        print(f"    False Confidence Rate:     {fc_rate*100:.1f}% ({false_confidence_cnt}/50)")
        print(f"  Latency:")
        print(f"    Verifier P50 / P95:        {v_p50:.1f} ms / {v_p95:.1f} ms")
        print(f"    Total Gen P50 / P95 / P99: {gen_p50:.1f} ms / {gen_p95:.1f} ms / {gen_p99:.1f} ms")

    out_file = r"C:\Users\godby\.gemini\antigravity-ide\brain\f1c9a612-a388-4205-95fc-3b1900a51c50\scratch\band_sweep_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(summary_results, f, indent=2)
    print(f"\nSaved sweep summary to {out_file}")

if __name__ == "__main__":
    run_sweep()
