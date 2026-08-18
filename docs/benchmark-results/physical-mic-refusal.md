# Physical-Microphone Validation — Safe Hindi Refusal

**Validation date:** 2026-08-18  
**Evidence source:** User-supplied live-evaluator screenshot `pasted_file_lXI9ou_image.png` retained in this task’s attachments.

The user completed an off-corpus Hindi question through the browser microphone. The interface reports a Sarvam automatic-detection confidence rather than typed input.

| Field | Observed result |
|---|---|
| Spoken transcript | `भारत की राजधानी क्या है?` |
| Detected route | `HI-IN / DEVANAGARI` |
| Sarvam auto-detect confidence | `100%` |
| Final status | `REFUSED` |
| Evidence cited | `0 cited` |
| Internal RAG duration | `0.33 ms` |
| Refusal reason | Retrieved passages did not meet the evidence-sufficiency threshold. |

> **Conclusion:** The real browser microphone → Sarvam transcription route completed successfully, and the evidence guardrail correctly refused an unsupported capital-of-India question instead of generating an ungrounded answer.
