# Voice Response and Evidence-Recovery Repair

**Validated:** 18 August 2026. This repair addresses two reported experience issues: the perceived delay after speaking and a generic evidence-refusal message for questions that did not match indexed MSMARCO-XI support.

| Reported issue | Root cause | Repair |
|---|---|---|
| Result appeared late after the user stopped speaking | A controllable 1.3 s silence window preceded the external Sarvam STT call, and the interface did not identify that provider stage | Reduced pause-to-send silence to **0.9 s** and added distinct encoding, external transcription, and corpus-matching status messages |
| Generic “directly supported” answer appeared for non-matching questions | The source-bound guardrail correctly refused unsupported inputs, but its copy was not actionable; punctuation variants could also reduce lexical overlap | Normalized spoken-query punctuation and Unicode dashes, preserved the fail-closed gate, and replaced the generic copy with source-backed next-step guidance |

> **Latency boundary:** Sarvam STT remains an external service and can take seconds. The application now sends speech 0.4 s earlier after a pause and makes this external transcription phase explicit. The measured internal retrieval-and-answer path remains separate and sub-200 ms.

## Fresh verification

| Check | Result | Evidence |
|---|---:|---|
| TypeScript and automated suite | PASS — 15 files, 63 tests | `pnpm check && pnpm test`, 18 Aug 2026 |
| Canonical source-backed prompts | PASS — 4/4 GROUNDED | [Nine-case live harness](./benchmark-results/voice-repair-live-grounded-refusal-9.json) |
| Localized prompt-injection cases | PASS — 5/5 REFUSED | [Nine-case live harness](./benchmark-results/voice-repair-live-grounded-refusal-9.json) |
| Natural Hindi spoken paraphrase | PASS — GROUNDED; evidence-supported corporation-law answer | [Paraphrase run](./benchmark-results/voice-repair-hindi-paraphrase.json) |

The natural Hindi paraphrase **“निगम कौन से कानून द्वारा शासित है”** returned `GROUNDED` with the answer that a corporation is governed by the laws of incorporation in that state. Its measured internal RAG time was recorded in the raw response. [1]

## Post-fix end-to-end Sarvam validation

A fresh four-fixture run through `voiceRag.ask` completed with **4/4 successful transcriptions and no transcription errors**. The Marathi source-supported clip transcribed as **“कॉर्पोरेशन म्हणजे काय?”** and returned `GROUNDED`; the other three clips returned intentional evidence refusals because their spoken content did not meet the corpus evidence gate. [2]

| Locale | Final status | STT | Post-transcription RAG | Server end-to-end |
|---|---:|---:|---:|---:|
| English | REFUSED | 6,637.05 ms | 0.42 ms | 6,637.48 ms |
| Kannada | REFUSED | 4,925.45 ms | 2,002.55 ms | 6,928.01 ms |
| Hindi | REFUSED | 1,022.04 ms | 0.59 ms | 1,022.64 ms |
| Marathi | GROUNDED | 1,162.21 ms | 1.21 ms | 1,163.43 ms |

The fixture report makes the external timing boundary explicit: Sarvam transcription dominates the observed wait, while source lookup and grounded-response construction remain small for the supported Marathi request. The Kannada fixture exercised a cloud-fallback retrieval path and therefore recorded a longer RAG time; it still returned a safe refusal rather than an error.

## Expected user behavior

The system remains intentionally source-bounded. A question unrelated to the indexed AI4Bharat/MSMARCO-XI evidence will return a refusal rather than an invented answer. The refined output now says that transcription completed and the result is an evidence boundary—not a microphone error—and directs the user to the source-backed speaking prompts for a grounded demonstration.

## Reference

[1]: ./benchmark-results/voice-repair-hindi-paraphrase.json "Live browser-transcript parity test of a natural Hindi paraphrase"
[2]: ./benchmark-results/voice-repair-sarvam-e2e-fixtures.json "Post-fix real-audio Sarvam transcription and final-status telemetry"
