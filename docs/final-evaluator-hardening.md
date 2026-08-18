# SUNO Final Evaluator-Grade Hardening — 2026-08-18

## Scope and outcome

This final pass reviewed the active SUNO evaluator, evidence-routing contract, language recovery path, benchmark contract, production build, and end-user presentation. The review identified and corrected three **evaluator-clarity** defects without changing the retrieval, guardrail, or answer policy:

| Corrected item | Final state |
|---|---|
| Live-language metric | The top rail now accurately states **five** focused grounded voice languages: Hindi, Kannada, English, Tamil, and Marathi. |
| Latency ledger | The interface now shows the full implemented P50/P70/P90/P95/P100 warm internal-RAG series, rather than hiding P90 and P95. |
| Index label | The footer now displays the live manifest-backed index version instead of the stale hard-coded `EVAL-V1` label. |

The review found no active regression in the guarded voice path, source citation display, low-confidence language recovery, typed fallback, or fail-closed evidence policy. The deliberate automatic-language confidence threshold remains at 80%; users should select a language explicitly when Sarvam confidence is lower.

## Final validation matrix

| Validation | Result |
|---|---:|
| Unit and DOM regressions | 19 files / 86 tests pass |
| TypeScript | Pass |
| Production build | Pass |
| Visual desktop review | Pass; evaluator hierarchy, live-input flow, structured output, evidence, and latency panels render correctly |
| Five-language benchmark | 1,000 requests, 0 harness errors |
| Combined five-language P50 / P70 / P90 / P95 / P100 | 0.20 / 0.24 / 0.36 / 0.41 / 3.00 ms |
| Cold/warm audit | 230 requests, 0 failures |
| Cold P100 / warm P100 | 0.85 ms / 0.36 ms |

> **Latency scope:** These figures measure post-transcription internal RAG: transcript normalization, retrieval, grounding checks, deterministic answer assembly, and harness handling. Sarvam STT, microphone capture, browser upload, and network transfer are separately reported and are not represented as under-200 ms internal RAG time.

## Evaluation-ready summary

SUNO provides a real browser-microphone flow that routes audio to server-side Sarvam transcription, retrieves AI4Bharat/MSMARCO-XI evidence through an engineered multi-family chunking and hybrid vector-retrieval path, and returns only a cited deterministic answer or a safe refusal. The active benchmark and the evaluator UI now expose matching percentile evidence, language scope, index version, and failure counts.[1] [2]

## References

[1]: [AI4Bharat/MSMARCO-XI dataset card](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)

[2]: [`five-language-1000-query-report.md`](./benchmark-results/five-language-1000-query-report.md)
