# Immediate Voice Output Progress Repair

**Validated:** 18 August 2026. The reported screenshot showed a correct Hindi refusal with **0.64 ms** RAG time, confirming that the wait perceived after speaking was not retrieval. The long portion occurs before the final response, while the browser packages the clip and Sarvam performs external transcription.

## Repair

The structured-output panel now changes immediately when recording ends. It progresses through three explicit states: **Packaging Audio**, **Sarvam Transcribing**, and **Matching Evidence**. This makes the post-speech wait observable and distinguishes external STT from the fast internal RAG path rather than leaving the answer area in a standby state.

| Interaction point | Before | After |
|---|---|---|
| Recording ends | Output stayed on “Awaiting voice” while the clip was encoded and submitted | Output immediately shows **LIVE RUN / Packaging Audio** |
| Sarvam request begins | Only the input-area label changed | Output shows **Sarvam Transcribing** and explains the external timing boundary |
| Browser fallback transcript arrives | Generic pending state | Output shows **Matching Evidence** before the evidence gate returns |
| Final response | Grounded/refused result shown | Unchanged; RAG timing remains displayed separately |

The pause-to-send behavior now uses a **0.75-second** silence threshold, so the app sends a clip 0.55 seconds earlier than the original 1.3-second threshold. It cannot make Sarvam’s external STT operation itself instantaneous, but it now avoids making that provider wait appear like a stalled UI.

## Verification

The new progress-state resolver has four dedicated unit tests covering idle, audio-packaging, Sarvam-transcribing, and browser-evidence-matching states. The complete suite passes: **16 test files and 67 tests**, with TypeScript clean. Desktop visual verification confirms the console remains stable after the output-panel update.

The final two-cycle browser fake-microphone audit observed the output panel in its `SARVAM TRANSCRIBING` state **25 ms** and **32 ms** after the user’s stop action. Local audio packaging measured **12 ms** and **20 ms**, respectively. Both cycles completed without capture, transcription, or pipeline errors. [1]

## Reference

[1]: ./benchmark-results/perceived-delay-immediate-progress-2.json "Two-cycle browser lifecycle audit with immediate output-state and packaging telemetry"
[2]: ./benchmark-results/perceived-delay-output-progress-visual-verification.md "Desktop visual-verification record"
