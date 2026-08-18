# Renewed Comprehensive Verification — SvaraProof

**Measured:** 18 August 2026, 07:21 UTC. This is a fresh verification pass requested after the prior final internal validation. It reconfirms application correctness, evidence behavior, bounded guardrails, post-transcription latency, and the browser recording lifecycle.

| Area | Fresh result | Evidence |
|---|---:|---|
| TypeScript | PASS — no compilation errors | `pnpm check` run, 18 Aug 2026 |
| Automated regression suite | PASS — 15 files, 59 tests | `pnpm test` run, 18 Aug 2026 |
| Canonical grounded queries | PASS — 4/4 GROUNDED | [Nine-case live harness](./benchmark-results/renewed-live-grounded-refusal-9.json) |
| Localized injection requests | PASS — 5/5 REFUSED | [Nine-case live harness](./benchmark-results/renewed-live-grounded-refusal-9.json) |
| 115-case post-transcription benchmark | PASS — 0 cold failures and 0 warm failures | [Fresh percentile telemetry](./benchmark-results/renewed-post-transcription-115.json) |
| Browser MediaRecorder lifecycle | PASS — 2/2 terminal responses, 0 errors | [Lifecycle telemetry](./benchmark-results/renewed-browser-microphone-cycle-2.json) |
| Explicit Sarvam routing | PASS — 4/4 available focused fixtures transcribed, 0 transcription errors | [Explicit-locale telemetry](./benchmark-results/renewed-explicit-locale-sarvam.json) |
| Desktop console rendering | PASS — evaluator loaded with no build or TypeScript errors | Screenshot captured 18 Aug 2026 |

## Fresh latency measurements

The 115-query latency run measures the **internal post-transcription RAG path**: normalization, safety and scope gates, retrieval, evidence verification, and structured answer/refusal construction. It does not include physical recording or external Sarvam STT, which are separately displayed by the console.

| Run | Samples | Failures | P50 | P70 | P100 | 200 ms target |
|---|---:|---:|---:|---:|---:|---:|
| Cold | 115 | 0 | **0.25 ms** | **0.34 ms** | **0.87 ms** | PASS |
| Warm | 115 | 0 | **0.16 ms** | **0.19 ms** | **0.34 ms** | PASS |

> The worst fresh internal benchmark result was **0.87 ms**, which remains below the 200 ms post-transcription target.

## Guardrail and voice observations

The live harness returned source-backed answers in Hindi, Kannada, Tamil, and Marathi, each retaining its expected evidence identifier. It also rejected the five localized prompt-injection variants with zero evidence citations and the explicit injection-gate reason. [1]

The browser MediaRecorder test reached a structured `REFUSED` terminal state in both cycles without any capture, transcription, or pipeline error. The fake clip’s text was unsupported by the corpus, so the refusal is an expected grounding outcome rather than a microphone failure. [2]

The explicit-locale Sarvam route returned transcripts for English, Kannada, Hindi, and Marathi with no transcription errors. Provider STT time remained separate from the RAG benchmark and varied by fixture, as expected for an external speech service. [3]

The only validation still unavailable inside the sandbox is a real physical microphone run in the user’s browser. It remains intentionally open rather than being misrepresented by fixture or fake-device checks.

## References

[1]: ./benchmark-results/renewed-live-grounded-refusal-9.json "Fresh live grounded-answer and localized injection-refusal telemetry"
[2]: ./benchmark-results/renewed-browser-microphone-cycle-2.json "Fresh two-cycle browser MediaRecorder lifecycle telemetry"
[3]: ./benchmark-results/renewed-explicit-locale-sarvam.json "Fresh explicit-locale Sarvam transcription telemetry"
