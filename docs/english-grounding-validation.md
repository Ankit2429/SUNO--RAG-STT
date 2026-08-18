# English Grounding Validation

**Date:** 2026-08-18  
**Scope:** English evidence grounding plus five-language evaluator verification.

## Verified behavior

| Check | Result |
|---|---|
| English source-backed question | `GROUNDED` through the same evidence gate used by Hindi, Kannada, Tamil, and Marathi |
| English out-of-context question | `REFUSED` with no invented answer |
| Harness regression | 7/7 harness tests passed, including both English cases |
| Full suite | 18 test files / 80 tests passed |
| Five-language benchmark | 1,000 requests; English 200/200 grounded; zero harness errors |
| Desktop visual review | Five-language evidence-first console rendered without layout regressions |
| Mobile visual review | 390 px width retained legible header, metric stack, live-input entry, and high-contrast controls |

English now produces cited grounded answers for source-supported queries. It is no longer labeled or routed as transcription-only. Across all five focused languages, out-of-context or insufficient-evidence questions retain the existing fail-closed refusal behavior.
