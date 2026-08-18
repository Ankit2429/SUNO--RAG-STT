# Sarvam Automatic Language Detection — Implementation Note

Sarvam’s official Saaras v3 guidance states that sending `unknown` as the REST `language_code` enables automatic language detection. The speech-to-text response returns the detected BCP-47 code when detection succeeds; it may return `null` if no language is detected. The REST reference documents `unknown` as the automatic-detection value.

SvaraProof therefore submits `unknown` by default for the primary server-side Sarvam route, retains the returned detected locale and `language_probability`, and exposes Hindi, Kannada, English, Tamil, and Marathi as explicit overrides. Automatic routing now requires a Sarvam language probability of **at least 0.80** and a detected locale inside that focused five-language scope. A missing, unknown, lower-confidence, or out-of-scope result returns a structured `REFUSED` response before retrieval, with an instruction to select a supported override and record again. This prevents an uncertain or unsupported classification from silently entering the wrong evidence shard.

Browser-native recognition does not expose Sarvam’s provider confidence, so its fallback requires an explicit locale override. The primary Sarvam microphone route remains the automatic-detection path.

## Microphone compatibility repair

Chromium’s `MediaRecorder` reports a valid Opus recording as `audio/webm;codecs=opus`, while Sarvam’s multipart file validator accepts the base MIME type `audio/webm` but rejects parameterized values. The server now strips MIME parameters only for the outbound multipart `Blob`, preserving the WebM file extension and the client’s original capture metadata. This resolves the post-recording provider error without changing audio bytes or exposing credentials client-side.

## Validation

A Chromium MediaRecorder lifecycle check with a **synthetic fake microphone device** ran **two complete record → stop → send cycles** against the public evaluator, using an explicit Hindi override. Both returned `GROUNDED` structured runs with no capture error or transcription failure. The raw report is stored at [`docs/benchmark-results/browser-microphone-cycle-2.json`](./benchmark-results/browser-microphone-cycle-2.json). This validates capture, encoding, upload, and recovery logic; a physical-microphone check remains pending because the sandbox has no user-accessible live input device.

The browser-originated automatic-detection validation returned non-error structured outcomes for all four controlled fixtures. English and Marathi exceeded the 0.80 threshold; the known Kannada-to-Gujarati misclassification at 0.76 and a Hindi detection at 0.761 were both withheld as `REFUSED` before retrieval. The raw report is stored at [`docs/benchmark-results/browser-origin-auto-detect-confidence-gated-4.json`](./benchmark-results/browser-origin-auto-detect-confidence-gated-4.json).

Sources: [Sarvam: How to specify language codes](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/how-to/specify-language-codes); [Sarvam REST Speech-to-Text reference](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe).

## Visual verification

The automatic-detection control was reviewed in the live evaluator at desktop (1280×720) and mobile (375×812) breakpoints. The default state visibly identifies automatic detection, explains that Sarvam selects the predominant spoken language, retains the five explicit overrides, and remains readable without clipping in both reviewed layouts.
