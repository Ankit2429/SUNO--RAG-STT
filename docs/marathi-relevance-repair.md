# Marathi Routing and Answer-Relevance Repair — 2026-08-18

## Observed issue

The captured Marathi microphone run had a usable Devanagari transcript, but Sarvam Automatic Detection reported **61%** confidence. The existing 80% confidence gate correctly stopped the request before retrieval. This was a language-routing refusal, not an evidence failure.

A subsequent explicit-`mr-IN` check exposed a separate quality issue: the deterministic answer assembler joined two cited sentences. The primary sentence discussed honesty, while the second was a corporation sentence that did not answer the question.

## Correction

The confidence gate remains unchanged. When a focused language is detected below the 80% threshold, the output now clearly states that retrieval was not run and provides a one-click **SELECT MARATHI & RETRY** action. The action selects `mr-IN`, clears the failed run, and prompts the user to record again with explicit routing.

The evidence synthesizer now returns one strongest cited sentence instead of concatenating nearby passages. Its lexical selection excludes generic Marathi connective terms and normalizes the Marathi integrity synonym and common inflections solely for evidence ranking. The returned answer remains an exact cited sentence; no generated facts are added.

## Verified explicit Marathi result

| Item | Verified result |
|---|---|
| Prompt | `प्रामाणिकपणा किंवा सचोटीची व्याख्या काय आहे?` |
| Explicit route | `mr-IN` |
| Outcome | `GROUNDED` |
| Returned answer | `सत्यनिष्ठा म्हणजे वर्तणूक; प्रामाणिकपणा म्हणजे तथ्यांचे पालन करणे.` |
| Evidence | One cited MSMARCO-XI Marathi passage, query ID `205107` |
| Internal RAG time | 2.40 ms |

## Regression and benchmark validation

| Check | Result |
|---|---:|
| TypeScript | Pass |
| Full tests | 18 files / 83 tests pass |
| Production build | Pass |
| Five-language benchmark | 1,000 requests, 0 harness errors |
| Combined RAG P50 / P70 / P100 | 0.21 / 0.27 / 3.57 ms |
| Marathi benchmark | 200/200 grounded, P100 0.77 ms |

The unchanged 40 Hindi benchmark refusals are the documented short-form evidence-boundary fixture; they remain safe refusals rather than errors. The benchmark measures post-transcription internal RAG and excludes microphone capture, Sarvam speech-to-text, network transfer, and browser upload.

No publishing or domain action was performed.

## Reference

[1]: [AI4Bharat/MSMARCO-XI dataset card](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
