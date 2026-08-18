# SvaraProof Final Internal Validation

**Validation date:** 18 August 2026. This report records the final internally executable validation before the single real-device check. It distinguishes **post-transcription RAG latency** from Sarvam speech-to-text latency, and it does not treat sandbox or fixture checks as a substitute for a physical user microphone.

| Validation area | Result | Preserved evidence |
|---|---:|---|
| TypeScript and regression suite | PASS — 15 files, 59 tests | Console run recorded 18 August 2026 |
| Canonical MSMARCO-XI grounded prompts | PASS — 4/4 GROUNDED | [Final internal RAG validation](./benchmark-results/final-internal-rag-validation.json) |
| Localized injection refusals | PASS — 5/5 REFUSED | [Final internal RAG validation](./benchmark-results/final-internal-rag-validation.json) |
| Post-transcription benchmark | PASS — 115 cold and 115 warm samples, 0 failures | [115-case benchmark](./benchmark-results/final-post-transcription-115-benchmark.json) |
| Browser MediaRecorder lifecycle | PASS — 2/2 fake-device record → stop → send cycles, 0 errors | [Lifecycle report](./benchmark-results/final-browser-microphone-cycle-2.json) |
| Automatic detection via local Sarvam adapter | PASS — 4/4 transcripts returned, 0 transcription errors | [Auto-detect report](./benchmark-results/final-auto-detect-local-adapter.json) |
| Explicit focused locales via local Sarvam adapter | PASS — 4/4 transcripts returned, 0 transcription errors | [Explicit-locale report](./benchmark-results/final-explicit-locale-local-adapter.json) |

## Grounded-answer and guardrail checks

The four source-backed prompts for **Hindi, Kannada, Tamil, and Marathi** each returned `GROUNDED` through the live public post-transcription route. Their evidence identifiers were preserved in the raw report: `abcd00370bf28170563f`, `d6b5794de38c4a3f1099`, `fe7d01189b5d4b12b986`, and `d68b9fe31a57d0054b70`, respectively. This confirms that the focused prompt rail remains connected to real indexed MSMARCO-XI evidence after the L1 lexical-qualification and exact-token grounding changes. [1]

The final validation initially exposed a multilingual prompt-injection gap: the English pattern was fail-closed, whereas equivalent Hindi, Kannada, Tamil, and Marathi wording could enter retrieval. The safety gate was extended with focused-language patterns, direct regression tests were added, and the same live nine-case run was repeated. All five localized injection requests then returned `REFUSED` with the structured injection-gate reason; all four canonical source-backed questions remained `GROUNDED`. [1]

> **Safety boundary:** The result of an unsupported or injection-style prompt is a structured refusal, not an invented answer. This behavior is intentional and is shown in the response status, refusal reason, and evidence count.

## Latency results

The internal 115-query benchmark remains comfortably within the stated 200 ms target for the **post-transcription retrieval-and-answer path**. It intentionally excludes microphone capture, browser upload, and Sarvam transcription, which are externally variable and separately reported by the console. [2]

| Path | P50 | P70 | P100 | Samples | Failures |
|---|---:|---:|---:|---:|---:|
| Cold post-transcription RAG | 0.30 ms | 0.34 ms | 1.52 ms | 115 | 0 |
| Warm post-transcription RAG | 0.18 ms | 0.22 ms | 0.45 ms | 115 | 0 |

## Voice-path checks and scope

Two Chromium fake-microphone cycles reached a terminal response without a recording, transcription, or console error. Both responses were `REFUSED` because the synthetic clip transcribed only a short, unsupported fragment; this is the expected evidence-bound outcome, not a microphone failure. [3]

The local Sarvam-adapter run returned non-empty transcripts for all four available fixtures. Automatic detection identified English, Hindi, and Marathi as expected. The Kannada fixture was classified as `gu-IN`, which is outside the focused five-language scope; the harness correctly returned a refusal rather than routing a potentially mismatched request. The explicit Kannada selection avoided this detection ambiguity and completed its transcription path. [4] [5]

An additional public-ingress observation is retained for transparency: two long 25-second fixtures received HTTP 403 before the application returned a harness record, while the shorter Hindi and Marathi fixtures completed. The same four inputs completed locally through the application and Sarvam adapter, indicating that this observation belongs to public-ingress payload handling rather than the RAG or Sarvam adapter logic. It is not used as a claim of successful real-device validation. [6]

## Remaining final validation boundary

The only work that cannot be executed inside this environment is a **physical device microphone** run. The final user check must provide two real clips: one canonical Hindi grounded question and one unsupported Hindi question. Those two responses will preserve the last required real-device telemetry and confirm that a user’s own microphone has no post-recording error.

## References

[1]: ./benchmark-results/final-internal-rag-validation.json "Nine-case grounded-answer and localized prompt-injection validation"
[2]: ./benchmark-results/final-post-transcription-115-benchmark.json "115-case cold and warm post-transcription retrieval benchmark"
[3]: ./benchmark-results/final-browser-microphone-cycle-2.json "Two-cycle browser MediaRecorder lifecycle regression"
[4]: ./benchmark-results/final-auto-detect-local-adapter.json "Sarvam automatic-detection run through the local application adapter"
[5]: ./benchmark-results/final-explicit-locale-local-adapter.json "Explicit focused-locale Sarvam transcription validation"
[6]: ./benchmark-results/final-auto-detect-public-ingress-observation.json "Public-ingress automatic-detection observation"
