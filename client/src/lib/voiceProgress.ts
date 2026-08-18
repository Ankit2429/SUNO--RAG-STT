export type VoiceOutputProgress = {
  label: string;
  title: string;
  detail: string;
  activeStep: 0 | 1 | 2;
};

export function resolveVoiceOutputProgress(processingHint: string | null, awaitingResponse: boolean): VoiceOutputProgress | null {
  if (!processingHint && !awaitingResponse) return null;
  const hint = (processingHint || "").toLowerCase();
  if (hint.includes("encoding") || hint.includes("captured")) {
    return { label: "PACKAGING AUDIO", title: "Your clip is ready. Sending it now.", detail: processingHint || "Preparing the short recording for protected server-side transcription.", activeStep: 0 };
  }
  if (hint.includes("browser transcript")) {
    return { label: "MATCHING EVIDENCE", title: "Transcript received. Checking the corpus.", detail: processingHint || "Running the bounded evidence and safety checks.", activeStep: 2 };
  }
  return { label: "SARVAM TRANSCRIBING", title: "Your speech reached the server.", detail: processingHint || "Sarvam is transcribing the clip; external transcription may take a few seconds.", activeStep: 1 };
}
