# SvaraProof Five-Language 1,000-Query Benchmark

**Measurement date:** 2026-08-18  
**Command:** `pnpm benchmark:five-languages`  
**Scope:** Post-transcription retrieval, grounding, answer assembly, and harness handling only. Sarvam STT, microphone capture, browser upload, and public-network transfer are excluded from the internal RAG target.

This run completed **1,000 sequential harness measurements**, comprising **200 requests each** for Hindi, Kannada, English, Tamil, and Marathi. The schedule interleaved **five real MSMARCO-XI query themes per language** for **40 repetitions per theme**. It is therefore a broad **latency and reliability repetition benchmark**, not a claim of 1,000 distinct-question accuracy evaluation. The fixture themes map to source query IDs `1102432`, `1102431`, `90836`, `55665`, and `205107` in the bounded project corpus derived from AI4Bharat/MSMARCO-XI.[1]

| Language | Requests | P50 | P70 | P100 | Grounded | Refused | Errors | Evidence citations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hindi (`hi-IN`) | 200 | 0.20 ms | 0.22 ms | 3.87 ms | 160 | 40 | 0 | 1,200 |
| Kannada (`kn-IN`) | 200 | 0.15 ms | 0.17 ms | 0.65 ms | 200 | 0 | 0 | 960 |
| English (`en-IN`) | 200 | 0.01 ms | 0.01 ms | 0.35 ms | 0 | 200 | 0 | 0 |
| Tamil (`ta-IN`) | 200 | 0.16 ms | 0.18 ms | 0.60 ms | 200 | 0 | 0 | 1,040 |
| Marathi (`mr-IN`) | 200 | 0.19 ms | 0.21 ms | 0.70 ms | 200 | 0 | 0 | 1,200 |
| **Combined** | **1,000** | **0.16 ms** | **0.20 ms** | **3.87 ms** | **760** | **240** | **0** | **4,400** |

> **Result:** The combined post-transcription internal RAG P100 is **3.87 ms**, which is **196.13 ms below** the 200 ms internal target. The run has **zero harness errors**.

The 200 English outcomes are intentional safe refusals: English remains **STT-only** in the focused evaluator and is not represented by the indexed local evidence language path. The 40 Hindi refusals all arise from the repeated `hi-1102432` corporation-definition fixture; they are safe, zero-invention refusals rather than system errors. Kannada, Tamil, and Marathi completed all 200 requests per language with grounded, cited evidence. The status distribution demonstrates that failures to meet evidence sufficiency are represented as explicit refusals instead of fabricated answers.

The raw result file is [`five-language-1000-query-raw.json`](./five-language-1000-query-raw.json). It contains all 1,000 per-request records, including language, fixture ID, repetition, query text, status, evidence count, internal RAG duration, and retrieval route. Its persisted record count was independently checked after the run.

## Interpretation

The benchmark clears the stated **internal RAG latency** requirement across all focused routes. It does **not** represent the user-perceived voice round trip, because a physical microphone and Sarvam STT precede this measured section of the pipeline. Separately captured voice-path timing must be used when assessing end-user delay.

The result is intentionally conservative in its correctness behavior. A `REFUSED` outcome is not counted as an error when no sufficient indexed evidence exists; this is the fail-closed guardrail working as designed. A separate diverse-query evaluation would be required to estimate semantic answer recall beyond the five source-backed query themes repeated here.

## Reference

[1]: [AI4Bharat/MSMARCO-XI dataset card](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
