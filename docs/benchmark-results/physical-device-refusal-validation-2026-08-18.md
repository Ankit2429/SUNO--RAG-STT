# Physical-Device Validation — Safe Refusal

**Validation date:** 2026-08-18  
**Evidence source:** User-supplied evaluator screenshot `pasted_file_lXI9ou_image.png` retained in this task’s attachments.

The user performed the Hindi off-corpus test through the live evaluator. The visible output reports `TRANSCRIPT / HI-IN / DEVANAGARI` and `SARVAM AUTO-DETECT CONFIDENCE / 100%`, which establishes that the microphone-to-transcription route completed and language detection succeeded.

| Field | Observed result |
|---|---|
| Spoken transcript | `भारत की राजधानी क्या है?` |
| Meaning | “What is the capital of India?” |
| Final status | `REFUSED` |
| Evidence cited | `0 cited` |
| Internal RAG duration | `0.33 ms` |
| Refusal reason | Retrieved passages did not meet the evidence-sufficiency threshold. |

> **Conclusion:** This is an expected fail-closed result. The question is not supported by the bounded MSMARCO-XI evidence index, so SUNO correctly refuses instead of inventing an answer.

## Related, but not microphone evidence

A separate user-supplied Marathi screenshot (`pasted_file_GG74O2_image.png`) shows a `GROUNDED` response with one citation and 0.47 ms internal RAG timing. Its header explicitly reads `TYPED-INPUT`, so it is preserved as a successful typed-path demonstration only and **does not satisfy** the remaining physical-microphone grounded-result requirement.
