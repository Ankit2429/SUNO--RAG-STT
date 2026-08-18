# Continued Five-Language Verification — 2026-08-18

This acceptance pass followed the successful real-microphone English test with **English explicitly selected**. It combines a clean type check, the complete regression suite, and a fresh 1,000-request post-transcription RAG benchmark. The measured retrieval corpus remains derived from the AI4Bharat/MSMARCO-XI dataset.[1]

## Verification result

| Check | Result | Interpretation |
|---|---:|---|
| TypeScript validation | Pass | `pnpm check` completed without errors. |
| Regression suite | 18 files / 80 tests pass | Covers retrieval, grounding guardrails, Sarvam routing, typed fallback, voice recovery, and the evaluator form flow. |
| Five-language benchmark | 1,000 requests | 200 requests each for Hindi, Kannada, English, Tamil, and Marathi. |
| Harness errors | 0 | No request entered an `ERROR` outcome. |
| Combined internal RAG P50 / P70 / P100 | 0.16 / 0.19 / 1.08 ms | The post-transcription path remains below the 200 ms internal-RAG target. |
| English real-microphone override | Grounded | Explicit `en-IN` selection produced one cited grounded answer in 0.19 ms after Automatic Detection safely rejected a 43%-confidence route.[2] |

> **Scope:** The latency figures above measure the guarded internal path—normalization, retrieval, grounding verification, answer assembly, and harness handling—after a transcript is available. They exclude microphone capture, browser upload, Sarvam transcription, and public-network transfer.

## Fresh benchmark matrix

| Language | Requests | Grounded | Refused | Errors | P50 | P70 | P100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Hindi (`hi-IN`) | 200 | 160 | 40 | 0 | 0.20 ms | 0.21 ms | 1.08 ms |
| Kannada (`kn-IN`) | 200 | 200 | 0 | 0 | 0.15 ms | 0.16 ms | 0.90 ms |
| English (`en-IN`) | 200 | 200 | 0 | 0 | 0.05 ms | 0.05 ms | 0.79 ms |
| Tamil (`ta-IN`) | 200 | 200 | 0 | 0 | 0.15 ms | 0.17 ms | 0.50 ms |
| Marathi (`mr-IN`) | 200 | 200 | 0 | 0 | 0.18 ms | 0.20 ms | 0.33 ms |
| **Combined** | **1,000** | **960** | **40** | **0** | **0.16 ms** | **0.19 ms** | **1.08 ms** |

The 40 Hindi `REFUSED` outcomes are the repeated short-form `hi-1102432` evidence-boundary fixture. They are not harness failures: the system returns no unsupported answer when the bounded evidence does not clear the sufficiency gate. The verified question bank already replaces that short form with the more evidence-specific Hindi corporation-law prompt for acceptance testing.[3]

All supported English, Kannada, Tamil, and Marathi benchmark fixtures completed as grounded, cited answers. The same fail-closed policy continues to reject out-of-context questions and Automatic Detection results below the 80% confidence threshold; selecting a focused language explicitly remains the recommended recovery path when speech detection is uncertain.

## Acceptance guidance

For the most repeatable live test, select the intended language first, then ask one of the source-backed prompts in the verified question bank. For English in particular, use **English** rather than **Automatic Detection**. A question without directly supporting MSMARCO-XI evidence should produce `REFUSED` with no citations; that is the expected safe response, not a defect.

No publishing, domain, or deployment action was performed during this verification pass.

## References

[1]: [AI4Bharat/MSMARCO-XI dataset card](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)

[2]: [`physical-mic-english-explicit.md`](./benchmark-results/physical-mic-english-explicit.md)

[3]: [`verified-five-language-question-bank.md`](./verified-five-language-question-bank.md)
