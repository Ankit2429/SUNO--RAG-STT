# Focused Five-Language Voice Scope

SvaraProof’s live voice experience is intentionally focused on **Hindi (`hi-IN`)**, **Kannada (`kn-IN`)**, **English (`en-IN`)**, **Tamil (`ta-IN`)**, and **Marathi (`mr-IN`)**. The selector defaults to Sarvam automatic detection and exposes only those five explicit overrides in the user-facing interface.

Automatic detection remains fail-closed. If Sarvam identifies a language outside the five-language scope, SvaraProof stops before retrieval and answer generation, then asks the speaker to select one of the supported overrides. A result below the configured confidence threshold is handled the same way.

The focused list is enforced in the public voice-route input contract and browser fallback controller, not merely hidden in the interface. This keeps the user journey small while retaining evidence-bound answer behavior. English remains transcription-capable but only receives an answer when the bounded evidence policy can support it.

Desktop and 375-pixel mobile checks verified that the hero label reads “5 voice languages,” the automatic-detection guidance uses “5 supported languages,” and the compact mobile layout keeps the live-input panel in normal scroll flow without overlap.
