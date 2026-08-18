# Dataset-First Fast Path Update

## What changed

SvaraProof now surfaces the real **AI4Bharat/MSMARCO-XI** corpus before a question is asked, rather than leaving provenance buried in a technical panel. The new corpus rail shows the bounded index, its fourteen grounded-answer language shards, the in-process L1 cache, and the auditable source-record total. A post-run evidence-path rail then states whether the request was served by local MSMARCO-XI evidence, the remote vector layer, a safe refusal, or no run at all.

The local cache is bucketed by language, reuses precomputed embeddings and token sets, and is queried before Qdrant. This preserves the existing real-evidence and fail-closed rules while avoiding unnecessary cross-region work for representative grounded queries. The interface never calls a refusal a cache hit, and it never represents Sarvam transcription time as part of the internal 200 ms retrieval budget.

## Verification

The updated project type-check and test suite passed with **12 test files and 55 tests**. The retrieval tests cover representative local evidence routes across the expanded multilingual corpus and the client tests cover the dataset-path status mapping. Desktop and 390 px mobile full-page previews were reviewed after the update: the corpus rail, language selector, microphone controls, evidence-path state, and latency ledger remain visible without horizontal overflow. On mobile, the rail intentionally stacks into a compact audit sequence.

The final visual pass added an ownable SvaraProof signal mark and a stronger wordmark hierarchy at the console masthead. It replaces the former empty output area with a source-bound standby plate: an evidence signal rail, explicit audio-to-evidence-to-verification stages, and a statement that no output exists until the corpus supports it. The lower evidence bay mirrors that standby plate, while the audit trace opens by default with an armed four-stage rail. The idle trace names audio validation, transcription, evidence retrieval, and verification/return, and states that refusals and recovery paths are traced as well. The completed lower-page composition was rechecked at 1280 px and 390 px viewports without horizontal overflow.

## Latency scope

The latest internal post-transcription benchmark over 115 guarded cases recorded warm P50/P70/P100 of **0.32 / 0.37 / 0.60 ms**. This measure covers the internal retrieval-and-answer flow, not human speech, microphone encoding, browser permission, or the external Sarvam STT call. The latency ledger makes that separation visible for each run.
