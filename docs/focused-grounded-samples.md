# Focused Grounded Speaking Prompts

**SvaraProof** now shows five speaking aids directly above its microphone control. Hindi, Kannada, Tamil, and Marathi prompts are retained from real AI4Bharat/MSMARCO-XI indexed language artifacts and were revalidated through the post-transcription voice route. English remains a speech-recognition check only because the focused live corpus has no English evidence shard.

| Language | Speak this prompt | Validation result |
|---|---|---|
| Hindi | निगम किस कानून द्वारा शासित होता है? | Grounded; 6 retrieved evidence records |
| Kannada | ಕಂಪನಿಯು ಯಾವ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತ ನಡೆಸುತ್ತದೆ? | Grounded; 4 retrieved evidence records |
| Tamil | நிறுவனம் எந்த சட்டங்களால் நிர்வகிக்கப்படுகிறது? | Grounded; 2 retrieved evidence records |
| Marathi | कॉर्पोरेशन कोणत्या कायद्यांद्वारे शासित आहे? | Grounded; 6 retrieved evidence records |
| English | What is a corporation? | Transcription-only; no grounded answer is promised |

The earlier Kannada capital-of-India question transcribed and detected successfully, but did not have directly supporting Kannada MSMARCO-XI evidence. Its **REFUSED** result was therefore the intended fail-closed outcome, not a microphone or transcription failure. The visible sample rail avoids this ambiguity by giving evaluators prompts validated against the indexed corpus.

The verifier now requires exact content-token overlap when selecting answer sentences and discards generic Indic question particles and Hindi auxiliary forms. This prevents unrelated retrieved snippets from appearing in an otherwise grounded answer. The documented validation summary is available at [`benchmark-results/focused-grounded-sample-validation.json`](./benchmark-results/focused-grounded-sample-validation.json), and the preserved local post-transcription runtime output—including the returned evidence IDs for all four grounded prompts—is available at [`benchmark-results/focused-grounded-sample-runtime.json`](./benchmark-results/focused-grounded-sample-runtime.json).

The refusal boundary was also tested with one unsupported fictional-question prompt in each of the four evidence-indexed languages. All four returned **REFUSED** even when retrieval returned candidate snippets, confirming that the evidence gate remains active rather than converting a weak lexical match into an answer.

Desktop and 375-pixel mobile reviews confirmed that the sample rail, automatic-detection selector, language overrides, and evidence-bound standby state remain readable. The cards stack in the normal mobile flow; no control is hidden by a fixed overlay.
