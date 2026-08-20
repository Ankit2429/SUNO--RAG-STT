# SUNO Dataset Retrieval Provenance Audit — 2026-08-20

## Conclusion

SUNO is **retrieving from AI4Bharat/MSMARCO-XI evidence**. The audit confirmed the live collection, the in-process retrieval cache, the metadata carried to cited output, and a real routed answer. It also found and corrected one presentation defect: the index-health UI was reporting `ERROR / 0 points` because its 2-second health-probe timeout was shorter than a healthy Qdrant Cloud collection response observed during the audit.

> The defect affected **only index-status reporting**. It did not disable the L1 cache or relax the bounded 175 ms Qdrant deadline used by live voice retrieval.

## Live index verification

The application’s live `voiceRag.indexStatus` response is now `READY` for the collection below.

| Item | Verified value |
|---|---|
| Dataset provenance | `ai4bharat/MSMARCO-XI` [1] |
| Qdrant collection | `msmarco_xi_evaluation_v1` |
| Qdrant points | **12,650** |
| Index version | `msmarco-xi-evaluation-v2` |
| Embedding mode | 384-dimensional zero-cost Unicode n-gram dense embedding |
| Runtime architecture | 565-passage L1 dense + lexical evidence cache, then Qdrant Cloud L2 full five-strategy index |
| Indexed manifest languages | 14: Assamese, Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Nepali, Odia, Punjabi, Sanskrit, Tamil, Telugu, and Urdu |
| Chunk families | Semantic sentence window, paragraph/section, answer-centered, fixed-window fallback, and query-linked evaluation |

## Direct cited-answer verification

The live public transcript route was called with the Marathi question below using explicit `mr-IN` routing:

> `प्रामाणिकपणा किंवा सचोटीची व्याख्या काय आहे?`

The route returned `GROUNDED` and selected exactly one cited passage. Its source metadata was `ai4bharat/MSMARCO-XI`; the source query ID was `205107`; the chunk strategy was `paragraph_section`; and the retrieved source sentence was:

> `सत्यनिष्ठा म्हणजे वर्तणूक; प्रामाणिकपणा म्हणजे तथ्यांचे पालन करणे.`

The structured trace recorded a 2.02 ms L1 retrieval stage and stated that real MSMARCO-XI evidence was retrieved from the in-process language cache. This is direct runtime provenance, rather than a static documentation claim.

## Corrected health reporting

| Before audit | Cause | Correction | Preserved behavior |
|---|---|---|---|
| `ERROR / 0 points` in index status | Direct healthy Qdrant collection response took 2.39 seconds, exceeding the dedicated 2-second health probe; an idle collection can require an additional cold-start allowance | Health probe uses its own separately bounded 8-second timeout and is covered by a regression test | Live user retrieval still keeps the strict 175 ms cloud fallback deadline; a slow remote fallback safely refuses rather than extending answer latency |

## Fresh regression and benchmark evidence

| Validation | Result |
|---|---:|
| TypeScript | Pass |
| Tests | 19 files / **87 tests** pass |
| Production build | Pass |
| Five-language post-transcription requests | 1,000 |
| Harness errors | 0 |
| Combined P50 / P70 / P90 / P95 / P100 | **0.19 / 0.24 / 0.38 / 0.43 / 1.55 ms** |
| P100 distance below 200 ms internal target | **198.45 ms** |

All English, Kannada, Tamil, and Marathi benchmark fixtures were grounded and cited. The 40 Hindi `REFUSED` outcomes remain the deliberately repeated short-form evidence-boundary fixture, not retrieval errors. A refusal is the correct result when the retrieved evidence does not clear the grounding gate.

## References

[1]: [AI4Bharat/MSMARCO-XI dataset card](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
