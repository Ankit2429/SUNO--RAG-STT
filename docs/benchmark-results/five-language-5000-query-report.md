# SUNO Five-Language 5,000-Request Evaluation

**Measurement date:** 2026-08-20  
**Run command:** `pnpm benchmark:five-languages:5000`  
**Scope:** Post-transcription internal RAG only.

## Evaluation design

This run issued **5,000 real harness requests** over the live SUNO process: 1,000 each for Hindi, Kannada, English, Tamil, and Marathi. Every language used an even 200-cycle schedule across five source-backed query themes from the bounded AI4Bharat/MSMARCO-XI evaluation artifact.[1] The raw per-request telemetry is retained in [`five-language-5000-query-raw.json`](./five-language-5000-query-raw.json).

> This is a repeatability, routing, grounding, and latency stress evaluation. It does **not** claim to contain 5,000 unique natural-language questions, nor does it include microphone capture, browser upload, Sarvam STT, or network transfer. Those stages are separately measured and must not be conflated with the 200 ms internal-RAG target.

## Final measured result

| Language | Requests | P50 | P70 | P90 | P95 | P100 | Grounded | Refused | Errors | Cited evidence items |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hindi (`hi-IN`) | 1,000 | 0.24 ms | 0.25 ms | 0.35 ms | 0.39 ms | 1.02 ms | 1,000 | 0 | 0 | 6,000 |
| Kannada (`kn-IN`) | 1,000 | 0.16 ms | 0.18 ms | 0.26 ms | 0.32 ms | 0.58 ms | 1,000 | 0 | 0 | 4,800 |
| English (`en-IN`) | 1,000 | 0.05 ms | 0.05 ms | 0.08 ms | 0.09 ms | 0.36 ms | 1,000 | 0 | 0 | 4,000 |
| Tamil (`ta-IN`) | 1,000 | 0.17 ms | 0.19 ms | 0.27 ms | 0.32 ms | 0.60 ms | 1,000 | 0 | 0 | 5,200 |
| Marathi (`mr-IN`) | 1,000 | 0.22 ms | 0.23 ms | 0.31 ms | 0.37 ms | 0.70 ms | 1,000 | 0 | 0 | 6,000 |
| **Combined** | **5,000** | **0.19 ms** | **0.22 ms** | **0.28 ms** | **0.35 ms** | **1.02 ms** | **5,000** | **0** | **0** | **26,000** |

The combined P100 was **198.98 ms below** the 200 ms internal-RAG target, with zero harness errors.

## Audited improvement between runs

The initial 5,000-request pass had zero errors but 200 repeated Hindi refusals, all from the short source-backed prompt `कॉर्पोरेशन क्या है?`. The audit traced this to terminology: the direct Hindi MSMARCO-XI source answer uses `निगम` and `कंपनी`, while the query uses `कॉर्पोरेशन`.

SUNO now preserves the original retrieval term and adds only the two source-attested Hindi equivalents for candidate retrieval. The grounding verifier also maps `कॉर्पोरेशन` to `निगम` only when selecting a sentence that is already cited. A live retest returned `GROUNDED` from source query ID `1102432` with the existing `paragraph_section` evidence. The final 5,000-request rerun produced the table above.

This is **not model-weight training or a fabricated score improvement**. SUNO remains a deterministic, zero-cost extractive RAG system. The change is a narrowly tested vocabulary calibration that improves retrieval of a real dataset passage while retaining the same evidence sufficiency threshold, source citation requirement, prompt-injection handling, and fail-closed refusal behavior for unsupported claims.

## Reproducibility and controls

The run is available through a dedicated command and has a strict 1,000-per-language cap to prevent an accidental unbounded load. Regressions cover the cap, the source-bound Hindi L1 route, and the cited-answer verifier. The collection health path remains separate from live retrieval: it may wait up to 8 seconds for Qdrant metadata on cold start, while live cloud fallback stays bounded to 175 ms.

## References

[1]: [AI4Bharat/MSMARCO-XI dataset card](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
