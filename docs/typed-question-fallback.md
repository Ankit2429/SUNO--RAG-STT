# Typed-Question Fallback

SvaraProof remains **microphone-first**, but the live-input panel now includes a small typed-question fallback for evaluator use and for testing when external speech transcription is slow. Typed text goes through the same `askBrowserTranscript` harness route as a browser-derived transcript, so it receives the same focused-language routing, injection and safety gates, retrieval, evidence verifier, structured output, and latency ledger.

| Test | Input | Result | Internal RAG time |
|---|---|---:|---:|
| Source-supported Hindi | `निगम किस कानून द्वारा शासित होता है?` | GROUNDED with evidence `abcd00370bf28170563f` | 1.57 ms |
| Unsupported Hindi | `भारत की राजधानी क्या है?` | REFUSED, zero cited evidence | 1.02 ms |

The typed fallback does **not** bypass source grounding. It is suitable for showing the post-transcription retrieval target without the variable Sarvam STT step, while the microphone flow remains available for the required real voice demonstration.

## Use

Select the same language you would use for speech, enter a question in **TYPE A QUESTION**, and click **CHECK TEXT**. The structured-output panel will show the text, final `GROUNDED` or `REFUSED` status, evidence count, and RAG time.

## References

[1]: ./benchmark-results/typed-input-grounded.json "Live typed Hindi grounded response"
[2]: ./benchmark-results/typed-input-refusal.json "Live typed Hindi safe-refusal response"
