# Multilingual Capability Policy

## Voice input

The console accepts all **23 Saaras v3 speech-to-text locales**: English plus 22 Indian languages. Each selection is sent as its BCP-47 code to the server-side Sarvam adapter and browser-native fallback where the browser supports that locale. Sarvam documents this 23-language set and the locale codes in its model reference.[1]

| Capability | Current behavior |
|---|---|
| Voice transcription | 23 Sarvam Saaras v3 locales are selectable. |
| Browser-native fallback | Uses the same selected BCP-47 locale; browser coverage varies by platform. |
| Grounded answers | The bounded MSMARCO-XI evaluation index contains Assamese, Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Nepali, Odia, Punjabi, Sanskrit, Tamil, Telugu, and Urdu evidence. |
| Transcription-only locales | English and the remaining selectable Sarvam locales transcribe, then safely refuse an answer when the bounded index lacks supporting evidence. |

## Latency scope

Sarvam’s REST endpoint is synchronous for audio files under 30 seconds, whereas the console’s internal 200 ms budget applies to the post-transcription retrieval, evidence, and answer path. The console must always show STT separately and must not represent provider transcription or human speaking time as being inside the internal retrieval budget.[2]

The updated internal benchmark ran 115 guarded post-transcription cases against the expanded multilingual local evidence cache. Its cold P50/P70/P100 was **0.39 / 0.42 / 1.38 ms** and its warm P50/P70/P100 was **0.32 / 0.37 / 0.60 ms**, with zero failures. This supports the under-200-ms claim for the internal retrieval-and-answer path only; the separately measured Sarvam STT path remains the limiting factor for voice-to-answer latency.

## Reliability policy

The live-input controller treats microphone capture, Sarvam submission, and browser-native fallback as one mutually exclusive activity. A failed device stream, recorder error, empty browser-recognition completion, or transient remote retrieval failure returns the console to an actionable terminal state. Remote retrieval failures resolve to a fail-closed evidence refusal rather than a generic application error. A generated fourteen-language L1 cache serves representative evidence locally before the cross-region Qdrant path is considered.

## Visual verification — 2026-08-18

The refreshed **SvaraProof / Voice Evidence Console** was checked at 1440 px and 390 px widths. The wide console preserves the intended evidence-first hierarchy: live input, structured output, citations, latency ledger, trace, and method/index. At the mobile breakpoint, these zones stack without clipping the language selector, microphone controls, browser fallback route, or latency ledger. The latency panel remains intentionally empty before a run and states that no timing is invented; it activates only from an actual trace or audit result.

## Sources

[1] [Sarvam Models — Language Support Overview](https://docs.sarvam.ai/api/getting-started/models)

[2] [Sarvam Speech-to-Text Overview — API Types and Limits](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview)
