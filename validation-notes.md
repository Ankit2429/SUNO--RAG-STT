# SUNO Interface Validation Notes

## 2026-08-21 — Original palette and prompt layout restoration

Desktop and 390 px mobile review confirms that the canvas uses the restored warm-cream field with near-black structure and safety-orange primary actions. The Display, Focus, and Audit control group is absent from the hero.

The language route selection is visually and structurally placed directly below the microphone-and-text prompt rail on both breakpoints. The primary record/send controls remain readable, the select control remains fully visible on mobile, and the evaluator disclosure stays reachable below the prompt flow.

## 2026-08-21 — Premium neo-brutalist refinement

Desktop review confirms a more tactile, premium evidence-console presentation: the cream paper field gains restrained depth, the SUNO wordmark receives a layered technical frame, and the prompt rail, language selector, answer surface, and evaluator disclosure share a consistent sharp-border, controlled-shadow material system.

The 390 px mobile review confirms that the larger visual details preserve hierarchy without clipping. Recording and text submission retain full-width touch targets, the language route remains directly beneath the primary rail, and the evidence disclosure is readable and reachable in the single-column flow.

## 2026-08-21 — Observed live query verification

This check exercised the active provider-backed SUNO request path rather than relying only on unit tests. Five source-backed prompts, one each for English, Hindi, Kannada, Tamil, and Marathi, returned `GROUNDED` responses from the live tRPC route with cited `AI4Bharat/MSMARCO-XI` evidence. The observed post-transcription RAG times from those API responses were 0.51 ms (English), 0.65 ms (Hindi), 0.39 ms (Kannada), 0.59 ms (Tamil), and 0.47 ms (Marathi). These numbers measure the internal post-transcription harness segment only; they do not represent end-to-end microphone-to-answer latency.

The rendered browser interface was also exercised using a Kannada question: `ಕಂಪನಿಯು ಯಾವ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತ ನಡೆಸುತ್ತದೆ?` With the Kannada indexed-evidence route selected, it returned `GROUNDED`, showed one cited paragraph-section record (`feb6b72db8`), and displayed 0.39 ms post-transcription RAG. No query-path code change was made because a live failure was not reproduced during this verification.
