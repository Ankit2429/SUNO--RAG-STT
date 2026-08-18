# Multilingual Voice Transcription Repair Validation

## Scope

The evaluator now defaults to **Sarvam automatic language detection**: it submits the provider’s documented `unknown` `language_code` value and uses the returned BCP-47 locale for the guarded retrieval route. **Hindi, Kannada, English, Tamil, and Marathi** are available as explicit overrides. Browser-native fallback uses the browser’s default recognition locale while automatic detection is selected, or the exact focused override when one is chosen.

The capture route rejects clips shorter than 0.7 seconds or smaller than 512 bytes before upload, confirms the completed capture duration and payload size, and surfaces Sarvam’s returned error detail to the user when transcription cannot proceed. The server adapter now retries bounded network failures, timeouts, empty provider responses, and transient HTTP `408`, `425`, `429`, and `5xx` responses before returning a structured error. The browser fallback explains when it ends without producing a transcript.

## Automated contract coverage

The Sarvam adapter test suite verifies that explicit locale hints are carried into multipart requests, that `audio/webm;codecs=opus` is normalized to Sarvam’s accepted `audio/webm` multipart MIME type, that Sarvam’s `unknown` sentinel is forwarded for automatic detection and returns the provider-detected locale and confidence, that a transient `502` is retried, and that a non-retryable audio-format failure remains actionable. Harness coverage also asserts that a low-confidence automatic detection is refused before retrieval. The complete suite passed with **12 test files and 59 tests**.

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

The browser fallback uses a tested controller, `configureBrowserFallback`, shared directly by the console. Its tests assert that the five focused explicit locales return their exact BCP-47 code to native browser recognition, that automatic mode leaves browser recognition on its default locale, that a recognized transcript is forwarded through the configured handler, that provider errors remain actionable, and that a completed fallback with no result gives a recovery path. To avoid routing an unverified browser locale into evidence retrieval, the UI directs automatic-mode fallback users to either the primary Sarvam route or a Hindi, Kannada, English, Tamil, or Marathi override. The current project suite passes with **14 test files and 50 tests**.

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

## Observed actual-browser 300-request replay

An additional larger replay used **75 sequential repetitions per locale** across the same four real-audio fixtures, for **300 attempted Chromium page-context public-ingress requests**. Sequential execution intentionally avoids an artificial client-side burst, but the longer run still exposes provider-side variability. The aggregate percentiles below are calculated across the 297 successful requests; all attempted trials remain in the raw artifact.

| Metric | P50 | P70 | P100 | Successful sample count |
|---|---:|---:|---:|---:|
| Browser page-context round trip | 2,242.00 ms | 2,576.60 ms | 22,609.70 ms | 297 |
| Server end to end | 2,190.84 ms | 2,508.18 ms | 22,559.72 ms | 297 |
| Sarvam STT | 2,190.54 ms | 2,507.89 ms | 22,559.25 ms | 297 |
| Post-transcription RAG | 0.31 ms | 0.35 ms | 1.02 ms | 297 |

The run recorded **3 provider transcription failures** (1.0% of attempts) after the adapter’s bounded retries: two Marathi (`mr-IN`) trials and one English (`en-IN`) trial. Those trials returned the structured harness `ERROR` reason **“Speech-to-text failed after bounded retries”** and did not enter the RAG stage (`ragMs: 0`). The 297 successful trials returned 148 `GROUNDED` and 149 fail-closed evidence-sufficiency `REFUSED` outcomes, with no successful-trial harness error. This is therefore preserved as an **observed reliability-stress result**, not a replacement for the clean 200-request benchmark. Its raw per-trial record is committed at [`docs/benchmark-results/browser-origin-target-language-300-observed.json`](./benchmark-results/browser-origin-target-language-300-observed.json).

> The 300-request replay confirms that the internal post-transcription RAG segment remains far below the 200 ms target even under a longer provider exposure window. It also shows that literal voice-to-answer latency and rare failure behavior are dominated by external Sarvam STT. The observed full-path P100 should not be presented as an internal retrieval performance regression.

## Browser-originated automatic-detection validation

After making automatic detection the default, the normal Chromium page-context public-ingress runner made one real-audio request for each controlled English, Kannada, Hindi, and Marathi fixture with `languageHint: "unknown"`. The final confidence-gated validation returned **4/4 structured, non-error responses** through the same browser origin used by evaluators. Automatic evidence routing requires a Sarvam `language_probability` of **0.80 or greater**; lower-confidence classifications stop with a structured refusal before retrieval rather than producing an answer from a possibly wrong language shard.

| Fixture locale | Sarvam detected locale | Result | Interpretation |
|---|---|---|---|
| `en-IN` | `en-IN` / 0.999 | `REFUSED` | Detection passed confidence; the evidence gate withheld an unsupported answer. |
| `kn-IN` | `gu-IN` / 0.760 | `REFUSED` | The known misclassification is below threshold and is withheld before retrieval; select the Kannada override. |
| `hi-IN` | `hi-IN` / 0.761 | `REFUSED` | Correct locale but below the conservative routing threshold; select Hindi override. |
| `mr-IN` | `mr-IN` / 0.954 | `GROUNDED` | Correct, sufficiently confident automatic detection. |

This is a functional route validation rather than a language-identification accuracy claim. The saved raw artifact is [`docs/benchmark-results/browser-origin-auto-detect-confidence-gated-4.json`](./benchmark-results/browser-origin-auto-detect-confidence-gated-4.json). When a user knows the language and sees an incorrect or withheld detected locale, the focused Hindi, Kannada, English, Tamil, or Marathi selector is the accuracy-preserving fallback; answers remain constrained by the evidence gate.

## Browser MediaRecorder recovery check

The reported post-recording failure was reproduced with Chromium’s synthetic fake microphone device. The recorded `audio/webm;codecs=opus` upload reached Sarvam but was rejected because its multipart MIME allowlist expects `audio/webm` without parameters. SvaraProof now normalizes only the outbound multipart file type to `audio/webm` and retains the original capture format locally. A browser-level regression then completed **two sequential record → stop → send cycles** with no capture error, no transcription error, and a `GROUNDED` structured response for each cycle. The raw report is committed at [`docs/benchmark-results/browser-microphone-cycle-2.json`](./benchmark-results/browser-microphone-cycle-2.json). This validates the browser lifecycle and provider handoff, but it does not claim a physical live-microphone test; that requires a user-accessible input device outside this sandbox.

## Client-side latency reduction

The 200-request browser-originated reference run shows that median server timing is dominated by Sarvam transcription: **1,469.75 ms STT** out of **1,470.25 ms server end to end** (99.96%), while median post-transcription RAG is **0.35 ms**. The latest optimization therefore targets the controllable capture and transfer path rather than claiming an external-provider inference improvement.

SvaraProof now records at 32 kbps Opus rather than 48 kbps, avoids periodic MediaRecorder chunk emission, and sends after detected speech is followed by a 1.3-second quiet pause. **STOP & SEND** remains available. The pause rule never sends silent audio and never sends before one second of capture. A public Chromium fake-device validation completed two sequential capture → send → grounded-response cycles after this change; the returned internal RAG times were **0.85 ms** and **0.65 ms**. These changes reduce user wait and audio-transfer size, but Sarvam STT remains the material voice-to-answer latency constraint.

Desktop and 375-pixel mobile viewport checks confirm that the evidence-first header, automatic-detection default, and live-input entry remain readable after the latency-control update. On mobile, the voice controls follow the compact corpus rail in normal page flow rather than being hidden behind a fixed overlay.

### Post-capture-optimization browser replay

To confirm that the optimization did not degrade the guarded service path, the Chromium page-context runner was repeated with **100 sequential real-audio fixture requests** after the client changes. All **100** completed without an infrastructure failure. The separate percentile measurements were as follows.

| Metric | P50 | P70 | P100 | Sample count |
|---|---:|---:|---:|---:|
| Browser page-context round trip | 1,894.80 ms | 2,195.60 ms | 5,599.20 ms | 100 |
| Server end to end | 1,839.26 ms | 2,144.58 ms | 4,760.77 ms | 100 |
| Sarvam STT | 1,837.89 ms | 2,144.48 ms | 4,760.39 ms | 100 |
| Post-transcription RAG | 0.53 ms | 0.83 ms | 1.65 ms | 100 |

The raw report is [`docs/benchmark-results/browser-origin-target-language-100-post-capture-optimization.json`](./benchmark-results/browser-origin-target-language-100-post-capture-optimization.json). This replay starts after prerecorded fixtures are available, so it verifies browser transport, public ingress, Sarvam, and the guarded RAG route; it does **not** measure MediaRecorder capture time or the new pause-to-send behavior. The higher STT percentiles versus the earlier 100-request replay are provider-time variation, not a retrieval regression: the internal post-transcription path remains well under the 200 ms target.

### Actionable live recovery states

The live console now resolves every completed voice run into one of three explicit recovery states: a transcription failure is displayed as a capture/pipeline error; a structured pipeline error is displayed with its server-provided recovery reason; and a low-confidence automatic-language refusal asks the speaker to choose an explicit locale and repeat the recording. Successful automatic identification continues to display the detected locale and confidence. The mapping is covered by four focused regressions in `voiceRecovery.test.ts`, in addition to the microphone lifecycle and Sarvam adapter suites.

## Reference

Sarvam documents the selected BCP-47 language codes, WebM support, completed nonempty `MediaRecorder` blobs, and the 30-second REST limit in its [STT reference](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe) and [recording FAQ](https://docs.sarvam.ai/api/speech-to-text/faq).
