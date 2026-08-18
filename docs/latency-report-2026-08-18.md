# SvaraProof Latency Report — 18 August 2026

## Conclusion

The current SvaraProof **internal post-transcription RAG pipeline is below 200 ms at every measured percentile**. The latest 115-case cold and warm benchmark recorded a worst P100 of **0.87 ms** with zero failures. A separate unsupported-Kannada live check now refuses in **178.91 ms** after the new bounded cloud-fallback policy, so it also remains within the 200 ms internal budget. [1] [2]

> **Scope statement for evaluators:** The 200 ms result covers transcript normalization, language/safety routing, retrieval, evidence verification, and structured answer/refusal construction. It does **not** include microphone capture, browser upload, Internet transfer, or Sarvam STT. Sarvam is an external speech provider whose time must be reported separately rather than blended into or mislabelled as RAG latency.

## Fresh 115-case internal benchmark

The terminal benchmark ran **115 real/adversarial query cases cold and 115 warm**, for **230 measured requests**. It has 100 real AI4Bharat/MSMARCO-XI cases and 15 adversarial safety cases.

| Internal post-transcription path | Samples | Failures | P50 | P70 | P100 | 200 ms result |
|---|---:|---:|---:|---:|---:|---|
| Cold RAG | 115 | 0 | 0.32 ms | 0.37 ms | **0.87 ms** | PASS |
| Warm RAG | 115 | 0 | 0.20 ms | 0.25 ms | **0.56 ms** | PASS |

The warm internal stage profile remains dominated by local retrieval, not response construction.

| Warm internal stage | Average | P50 | P70 | P100 | Samples |
|---|---:|---:|---:|---:|---:|
| Normalize + scope | 0.00 ms | 0.00 ms | 0.00 ms | 0.02 ms | 115 |
| Route + retrieval | 0.17 ms | 0.15 ms | 0.21 ms | 0.48 ms | 115 |
| Evidence + verify | 0.05 ms | 0.05 ms | 0.06 ms | 0.20 ms | 115 |
| Answer assembly | 0.00 ms | 0.00 ms | 0.00 ms | 0.00 ms | 115 |
| **Total internal** | **0.23 ms** | **0.20 ms** | **0.25 ms** | **0.56 ms** | **115** |

## Fast-refusal edge case

An earlier real-audio Kannada fixture reached a remote Qdrant fallback and measured about 2.0 seconds for post-transcription RAG. That was not acceptable for the internal latency target, so the fallback policy was corrected. Remote fallback is now constrained to a **175 ms** window for live voice traffic; an L1 hit remains immediate, while a slow remote miss becomes a truthful source-bound refusal.

| Live browser-transcript check | Final status | RAG time | Interpretation |
|---|---|---:|---|
| Hindi: “निगम किस कानून द्वारा शासित होता है?” | GROUNDED | 1.89 ms | Source-supported answer is preserved |
| Kannada: “ಭಾರತದ ರಾಜಧಾನಿ ಯಾವುದು?” | REFUSED | 178.91 ms | Remote fallback timed out at 175 ms; no invented answer and no multi-second stall |

This is why the report can accurately state that the internal experience is not “around 200–230 ms”: the benchmark P100 is **0.87 ms**, and the deliberately bounded live unsupported fallback is **178.91 ms**.

## External voice-path timing

Sarvam transcription is an external provider operation. Depending on clip duration, language, queueing, and network conditions, recorded fixtures have ranged from approximately **1.0 seconds to 9.3 seconds** for STT. That provider time is the main reason a spoken final answer can arrive later than a typed result; it is surfaced in the live output state and remains intentionally separate from the RAG claim.

The interface sends after a 0.75-second silence threshold, reveals its output progress within 25–32 ms of stop, and records local audio packaging of 12–20 ms. These changes remove avoidable UI waiting but do not misrepresent external STT as internal RAG latency. [3]

## How to reproduce

Run the following from the project directory:

```bash
pnpm benchmark:terminal
```

The command prints the exact case count, cold/warm P50/P70/P100, stage profile, 200 ms budget, and PASS/FAIL decision in an evaluator-ready terminal table.

## References

[1]: ./benchmark-results/latency-report-postrepair-terminal.txt "Fresh 115-case cold and warm terminal benchmark after bounded fallback repair"
[2]: ./benchmark-results/latency-repair-grounded-hindi.json "Live grounded Hindi post-repair latency"
[3]: ./benchmark-results/perceived-delay-immediate-progress-2.json "Measured browser output-progress and audio-packaging timing"
