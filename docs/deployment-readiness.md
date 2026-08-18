# SvaraProof Accuracy and Deployment Readiness

**Review date:** 18 August 2026. This review checks whether the project is ready for a future public release and custom-domain connection. It does **not** publish the project or modify its domain configuration.

## Accuracy and safety evidence

The refreshed nine-case live accuracy audit completed with **zero failures**. All four canonical MSMARCO-XI source-backed prompts returned `GROUNDED` with preserved evidence identifiers, while all five localized prompt-injection requests returned `REFUSED` with zero cited evidence. This is the expected behavior for a source-bounded RAG system: it answers when indexed evidence supports the question and refuses instead of inventing an answer when it does not. [1]

| Validation | Observed result | Release interpretation |
|---|---|---|
| Hindi canonical prompt | GROUNDED; evidence ID `abcd00370bf28170563f` | Ready |
| Kannada canonical prompt | GROUNDED; evidence ID `d6b5794de38c4a3f1099` | Ready |
| Tamil canonical prompt | GROUNDED; evidence ID `fe7d01189b5d4b12b986` | Ready |
| Marathi canonical prompt | GROUNDED; evidence ID `d68b9fe31a57d0054b70` | Ready |
| Five localized injection attempts | 5/5 REFUSED; 0 evidence citations | Ready |
| Live public index status | HTTP 200; `READY`; 12,650 points | Ready |

> **Accuracy boundary:** A question such as “What is the capital of India?” is intentionally refused because it is not directly supported by the indexed AI4Bharat/MSMARCO-XI evidence. This is not a transcription or domain problem; it is the required hallucination guardrail.

## Production and domain readiness

The production build completed successfully. The full TypeScript and regression suite passed with **17 test files and 70 tests**. Both the public homepage and public index-status route returned HTTP 200 during the readiness check. The generated browser assets were scanned for Sarvam and Qdrant credential names, with **zero matches**, so provider credentials remain outside the client bundle. [1] [2]

| Check | Result | Notes |
|---|---|---|
| Production build | PASS | Client bundle and server entry generated successfully |
| Public homepage | PASS — HTTP 200 | The preview origin serves the evaluator |
| Public index endpoint | PASS — HTTP 200 | Index reports `READY` with 12,650 points |
| Provider-key exposure in client bundle | PASS — 0 matches | Sarvam and Qdrant credentials remain server-only |
| Origin assumptions | PASS | No custom-domain hostname is hard-coded in browser routes |
| Build-size observation | REVIEW | Main client JavaScript is 206.34 kB gzip; Vite emitted a non-blocking chunk-size advisory |

No application-code domain change is required. When you decide to release, create or use the latest checkpoint, then use the project **Settings → Domains** panel to choose the Manus domain or bind your custom domain, and use the **Publish** button yourself. The deployment configuration should retain the existing server-side `SARVAM_API_KEY`, `QDRANT_URL`, and `QDRANT_API_KEY` entries; do not copy these values into the frontend or a public DNS record.

## Remaining pre-release check

The only requirement that cannot be fully simulated here is two **physical-microphone** requests from your browser. Before publishing, speak one source-backed prompt and one unsupported prompt, confirm the statuses are `GROUNDED` and `REFUSED`, respectively, and preserve the screenshot or outcome. The typed fallback, fixture audio, public routes, browser lifecycle, and live accuracy checks are already complete.

## References

[1]: ./benchmark-results/deployment-readiness-live-accuracy.json "Fresh nine-case grounded-answer and localized refusal audit"
[2]: ./benchmark-results/deployment-readiness-public-index.json "Public index-status readiness response"
