# Physical-Microphone Validation — Grounded Hindi Answer

**Validation date:** 2026-08-18  
**Evidence source:** User-supplied live-evaluator screenshot `pasted_file_kdOsuR_image.png` retained in this task’s attachments.

The user completed the source-backed Hindi run through the browser microphone. The output explicitly reports Sarvam automatic speech-language detection rather than typed input.

| Field | Observed result |
|---|---|
| Spoken prompt | `निगम किस कानून द्वारा शासित होता है?` |
| Detected route | `HI-IN / DEVANAGARI` |
| Sarvam auto-detect confidence | `100%` |
| Final status | `GROUNDED` |
| Evidence cited | `1 cited` |
| Confidence band | `MEDIUM` |
| Internal RAG duration | `0.46 ms` |
| Displayed answer | `निगम तब उस राज्य में निगमण के कानूनों द्वारा शासित होता है।` |

> **Conclusion:** The real browser microphone → Sarvam transcription → Hindi retrieval → cited grounded-answer route completed successfully. The answer remained evidence-bound and the measured post-transcription RAG duration was inside the 200 ms internal target.
