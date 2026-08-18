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

The required four locales were then exercised directly against the live `voiceRag.ask` route using real WAV fixtures. The run returned a nonempty transcript and no Sarvam transcription error for every target locale. English used a short Open Speech Repository Harvard-sentence fixture. Kannada used a 25-second, CC BY-SA 4.0 public Bengaluru street-recording segment. Hindi and Marathi used the existing controlled fixtures.

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

## Reference

Sarvam documents the selected BCP-47 language codes, WebM support, completed nonempty `MediaRecorder` blobs, and the 30-second REST limit in its [STT reference](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe) and [recording FAQ](https://docs.sarvam.ai/api/speech-to-text/faq).
