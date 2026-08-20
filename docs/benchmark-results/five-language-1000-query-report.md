# SUNO Five-Language 1,000-Query Benchmark

**Measurement date:** 2026-08-20 (fresh dataset-provenance rerun)  
**Command:** `pnpm benchmark:five-languages`  
**Scope:** Post-transcription retrieval, grounding, answer assembly, and harness handling only. Sarvam STT, microphone capture, browser upload, and public-network transfer are excluded from the internal RAG target.

This fresh run completed **1,000 sequential harness measurements**, comprising **200 requests each** for Hindi, Kannada, English, Tamil, and Marathi. The schedule interleaved **five real MSMARCO-XI query themes per language** for **40 repetitions per theme**. It is therefore a reliability and latency repetition benchmark, not a claim of 1,000 distinct-question accuracy evaluations. The fixture themes map to source query IDs `1102432`, `1102431`, `90836`, `55665`, and `205107` in the bounded corpus derived from AI4Bharat/MSMARCO-XI.[1]

## Five-language internal-RAG results

| Language | Requests | P50 | P70 | P90 | P95 | P100 | Grounded | Refused | Errors | Evidence citations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hindi (`hi-IN`) | 200 | 0.24 ms | 0.30 ms | 0.46 ms | 0.52 ms | 1.55 ms | 160 | 40 | 0 | 1,200 |
| Kannada (`kn-IN`) | 200 | 0.17 ms | 0.20 ms | 0.36 ms | 0.42 ms | 0.77 ms | 200 | 0 | 0 | 960 |
| English (`en-IN`) | 200 | 0.05 ms | 0.06 ms | 0.08 ms | 0.15 ms | 0.38 ms | 200 | 0 | 0 | 800 |
| Tamil (`ta-IN`) | 200 | 0.19 ms | 0.22 ms | 0.37 ms | 0.40 ms | 0.56 ms | 200 | 0 | 0 | 1,040 |
| Marathi (`mr-IN`) | 200 | 0.23 ms | 0.25 ms | 0.39 ms | 0.45 ms | 0.67 ms | 200 | 0 | 0 | 1,200 |
| **Combined** | **1,000** | **0.19 ms** | **0.24 ms** | **0.38 ms** | **0.43 ms** | **1.55 ms** | **960** | **40** | **0** | **5,200** |

> **Result:** The combined internal-RAG P50/P70/P90/P95/P100 is **0.19 / 0.24 / 0.38 / 0.43 / 1.55 ms**. P100 is **198.45 ms below** the 200 ms internal target, with **zero harness errors**.

English, Kannada, Tamil, and Marathi completed all 200 benchmark requests as grounded, cited outputs. The 40 Hindi refusals are the intentionally repeated short-form `hi-1102432` evidence-boundary fixture. They are safe zero-invention refusals rather than harness errors.

## Complementary cold/warm harness audit

The terminal audit runs **115 query cases** (100 real AI4Bharat/MSMARCO-XI cases and 15 adversarial safety cases) once cold and once warm, producing 230 measurements.

| Path | Samples | P50 | P70 | P90 | P95 | P100 | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cold internal RAG | 115 | 0.31 ms | 0.36 ms | 0.41 ms | 0.46 ms | 0.85 ms | 0 |
| Warm internal RAG | 115 | 0.20 ms | 0.24 ms | 0.28 ms | 0.32 ms | 0.36 ms | 0 |

| Warm-stage aggregate | Average | P50 | P70 | P90 | P95 | P100 | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| Normalize + scope | 0.00 ms | 0.00 ms | 0.00 ms | 0.00 ms | 0.00 ms | 0.01 ms | 0 |
| Route + retrieval | 0.12 ms | 0.11 ms | 0.14 ms | 0.19 ms | 0.21 ms | 0.25 ms | 0 |
| Evidence + verify | 0.07 ms | 0.08 ms | 0.09 ms | 0.11 ms | 0.15 ms | 0.21 ms | 0 |
| Answer assembly | 0.00 ms | 0.00 ms | 0.00 ms | 0.00 ms | 0.00 ms | 0.16 ms | 0 |
| **Total internal** | **0.19 ms** | **0.20 ms** | **0.24 ms** | **0.28 ms** | **0.32 ms** | **0.36 ms** | **0** |

The raw five-language telemetry is stored in [`five-language-1000-query-raw.json`](./five-language-1000-query-raw.json). It contains all 1,000 requests, including language, fixture ID, repetition, query text, outcome, evidence count, internal RAG time, and retrieval route.

## Interpretation

The fresh benchmark clears the stated **internal RAG latency** requirement across every focused route. It is not a user-perceived voice-round-trip measurement because microphone capture, upload, Sarvam STT, and network transfer precede this path. A `REFUSED` outcome is not counted as an error when the evidence-sufficiency gate prevents an unsupported answer.

## Reference

[1]: [AI4Bharat/MSMARCO-XI dataset card](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
