# Multilingual Voice Transcription Repair Validation

## Scope

The evaluator now asks the speaker to choose **English (`en-IN`)**, **Kannada (`kn-IN`)**, **Hindi (`hi-IN`)**, or **Marathi (`mr-IN`)** before recording. The selected locale is sent to the server-side Sarvam request and to browser-native speech recognition, eliminating the previous empty browser locale and generic automatic-detection path for the supported live workflow.

The capture route rejects clips shorter than 0.7 seconds or smaller than 512 bytes before upload, confirms the completed capture duration and payload size, and surfaces Sarvam’s returned error detail to the user when transcription cannot proceed. The browser fallback now explains when it ends without producing a transcript.

## Automated contract coverage

The Sarvam adapter test suite verifies that the exact selected `en-IN`, `kn-IN`, `hi-IN`, and `mr-IN` hint is carried into its multipart request. It also verifies that a non-retryable Sarvam audio-format failure is returned as an actionable error. The complete suite passed with **8 test files and 17 tests**.

## Initial Sarvam replay

One controlled replay loop was executed against the live server route on 2026-08-18 using the available real WAV fixtures. Every request completed without a transcription-path failure; Hindi and Marathi both used explicit locale hints and produced nonempty transcripts that reached the guarded RAG harness. A `REFUSED` result below represents a downstream evidence/safety decision, not an STT failure.

| Locale hint | Final harness status | STT ms | RAG ms | End-to-end server ms | Transcription-path failure |
|---|---:|---:|---:|---:|---:|
| `hi-IN` | REFUSED | 4,187.59 | 2.68 | 4,190.40 | No |
| `ta-IN` | GROUNDED | 3,574.17 | 4.75 | 3,578.93 | No |
| `te-IN` | REFUSED | 3,653.72 | 0.86 | 3,654.58 | No |
| `bn-IN` | GROUNDED | 4,985.31 | 0.82 | 4,986.14 | No |
| `mr-IN` | GROUNDED | 3,608.64 | 1.96 | 3,610.61 | No |

The five-request replay recorded no errors. Its STT P50/P70/P100 was **3,653.72 / 4,187.59 / 4,985.31 ms** and its post-transcription RAG P50/P70/P100 was **1.96 / 2.68 / 4.75 ms**. This is a narrow functional validation run, not a new claim that the full Sarvam route meets the separate 200 ms target.

## Required-language Sarvam replay

The required four locales were then exercised directly against the live `voiceRag.ask` route using real audio fixtures. The run returned a nonempty transcript and no Sarvam transcription error for every target locale. English used a short Open Speech Repository Harvard-sentence fixture. Kannada used a CC BY-SA 4.0 public Bengaluru street-recording segment. Hindi and Marathi used the existing controlled fixtures.

| Locale hint | Transcript characters | STT ms | Harness status | Transcription-path outcome |
|---|---:|---:|---|---|
| `en-IN` | 313 | 5,230.60 | ERROR* | Passed |
| `kn-IN` | 63 | 2,824.17 | ERROR* | Passed |
| `hi-IN` | 19 | 1,259.39 | REFUSED | Passed |
| `mr-IN` | 22 | 1,311.81 | GROUNDED | Passed |

> `ERROR*` in the English and Kannada rows was a downstream **“Retrieval service unavailable”** result after a nonempty transcript had already been produced. It is recorded here as a harness condition rather than an STT failure. The test’s pass criterion is the repaired microphone/STT contract: accepted audio, selected locale received by Sarvam, a nonempty transcript, and no `transcriptionError`.

The accompanying `scripts/validate_target_voice_locales.mjs` script reproduces this four-locale check and exits nonzero only for transcription-path failures. The saved execution report showed **4 requests, 0 transcription-path failures**.

## Browser fallback coverage

The browser fallback uses a tested controller, `configureBrowserFallback`, shared directly by the console. Its tests assert that English, Kannada, Hindi, and Marathi return their exact selected BCP-47 locales to native browser recognition; that a recognized transcript is forwarded through the configured handler; that provider errors remain actionable; and that a completed fallback with no result names the selected language. The standard project suite executes those tests and passed with **9 test files and 24 tests**.

## Final public-ingress 100-request replay

The final benchmark was deliberately run through the public preview’s HTTP ingress, not only against `localhost`. It executed 25 sequential passes of each required language, for **100 real-audio requests**. English and Kannada used ten-second WebM/Opus clips at the same 48 kbps profile selected by the browser recorder; Hindi and Marathi used the controlled WAV fixtures. The application round-trip clock starts after an audio clip already exists and ends on the structured response. It therefore includes fixture-client transport, public ingress, server handling, Sarvam STT, retrieval, guardrails, and response serialization; it excludes human recording and browser permission/encoding time.

| Metric | P50 | P70 | P100 | Sample count |
|---|---:|---:|---:|---:|
| Application round trip | 1,921.66 ms | 2,184.12 ms | 5,046.34 ms | 100 |
| Server end to end | 1,872.73 ms | 2,135.17 ms | 4,847.70 ms | 100 |
| Sarvam STT | 1,872.64 ms | 2,135.08 ms | 4,847.60 ms | 100 |
| Post-transcription RAG | 0.14 ms | 1.05 ms | 1.73 ms | 100 |

The run had **0 infrastructure failures**. It returned 25 `GROUNDED` responses and 75 `REFUSED` responses. The refusals are expected fail-closed outcomes where the bounded evidence index does not contain sufficient support for that fixture’s transcript; they are not transcription failures. English and Kannada, which are absent from the five-language bounded collection, now return an immediate evidence-sufficiency refusal rather than entering a known-empty strict-mode Qdrant filter request. The Qdrant bootstrap now creates the required `language` and `strategy` keyword payload indexes, preventing strict-mode filter errors for indexed languages.

> The measured full Sarvam path does **not** meet the 200 ms target: provider STT dominates at a P50 of approximately 1.87 seconds. The independently measured post-transcription RAG segment is within the target at a P100 of 1.73 ms. These figures are reported as observed rather than presented as a target claim.

## Final actual-browser 100-request replay

The Node public-ingress harness above establishes server and ingress behavior, but it is not an actual browser context. To close that gap, a separate Chromium DevTools runner loaded the public evaluator origin and performed every request using the page’s own `fetch()` API. The runner executed **25 sequential repetitions** for each of English, Kannada, Hindi, and Marathi, for **100 requests total**. English and Kannada were real ten-second WebM/Opus clips encoded at the browser recorder’s 48 kbps profile; Hindi and Marathi used the controlled real WAV fixtures.

| Metric | P50 | P70 | P100 | Sample count |
|---|---:|---:|---:|---:|
| Browser page-context round trip | 1,382.70 ms | 1,856.20 ms | 3,191.50 ms | 100 |
| Server end to end | 1,321.07 ms | 1,804.09 ms | 3,120.58 ms | 100 |
| Sarvam STT | 1,320.45 ms | 1,803.95 ms | 3,120.49 ms | 100 |
| Post-transcription RAG | 0.17 ms | 0.59 ms | 1.12 ms | 100 |

The actual-browser run had **0 failures**. It returned 25 `GROUNDED` responses and 75 evidence-sufficiency `REFUSED` responses, with no `ERROR` outcomes. Its raw per-trial telemetry is committed at [`docs/benchmark-results/browser-origin-target-language-100-final.json`](./benchmark-results/browser-origin-target-language-100-final.json).

> This browser-originated timing begins once a prerecorded fixture is available. It **includes** a Chromium page-context request, public ingress, server work, Sarvam transcription, retrieval, guardrails, and returned response. It **excludes** microphone permission, the time a person spends speaking, MediaRecorder encoding, and the audio clip’s production time. The full path therefore remains above the 200 ms target because Sarvam STT alone has a P50 of 1.32 seconds; the post-transcription RAG P100 remains 1.12 ms.

## Expanded actual-browser 200-request replay

To provide a larger, evenly balanced sample, the actual-browser runner was repeated on 2026-08-18 with **50 sequential repetitions per locale**: English, Kannada, Hindi, and Marathi. This yields **200 real-audio requests** through Chromium page-context `fetch()` and public ingress. The same known fixture profile and timing contract were retained, so the result is comparable to the earlier 100-request browser replay and isolates the external transcription provider from the internal RAG latency target.

| Metric | P50 | P70 | P100 | Sample count |
|---|---:|---:|---:|---:|
| Browser page-context round trip | 1,520.60 ms | 1,707.00 ms | 4,413.80 ms | 200 |
| Server end to end | 1,470.25 ms | 1,649.27 ms | 3,456.13 ms | 200 |
| Sarvam STT | 1,469.75 ms | 1,649.19 ms | 3,455.08 ms | 200 |
| Post-transcription RAG | 0.35 ms | 0.44 ms | 2.78 ms | 200 |

The run completed with **0 failures** and no `ERROR` outcomes. It returned 100 `GROUNDED` results and 100 `REFUSED` results. The latter are expected evidence-sufficiency refusals for transcripts whose selected language/index route has no bounded supporting passage; they indicate the fail-closed policy worked rather than a transcription or transport failure. Raw, per-trial evidence is committed at [`docs/benchmark-results/browser-origin-target-language-200-final.json`](./benchmark-results/browser-origin-target-language-200-final.json).

> The full browser-to-answer path remains above 200 ms because external Sarvam transcription has a 1,469.75 ms P50 in this run. The separately measured post-transcription RAG pipeline stays comfortably within the stated 200 ms goal at P50/P70/P100 of 0.35/0.44/2.78 ms. The benchmark deliberately reports both dimensions rather than conflating provider speech-to-text time with the retrieval, guardrail, and grounded-answer path.

## Reference

Sarvam documents the selected BCP-47 language codes, WebM support, completed nonempty `MediaRecorder` blobs, and the 30-second REST limit in its [STT reference](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe) and [recording FAQ](https://docs.sarvam.ai/api/speech-to-text/faq).
