import type { RAGRun } from "@shared/rag";

export type VoiceRecoveryMessage = {
  error: string | null;
  info: string | null;
};

export function resolveVoiceRecovery(run: RAGRun): VoiceRecoveryMessage {
  if (run.transcriptionError) {
    return { error: run.transcriptionError, info: null };
  }

  if (run.answer.status === "ERROR") {
    return {
      error: run.answer.refusalReason || "The voice pipeline stopped before it could return a grounded result. Check the microphone and try again.",
      info: null,
    };
  }

  const languageRefused = run.trace.some(event => event.stage === "detect_language" && event.status === "REFUSED");
  if (languageRefused) {
    const confidence = run.detectedLanguageConfidence === null || run.detectedLanguageConfidence === undefined
      ? ""
      : ` (${Math.round(run.detectedLanguageConfidence * 100)}% confidence)`;
    return {
      error: null,
      info: `Automatic detection could not confirm the spoken language${confidence}. Select a language override and record again.`,
    };
  }

  const evidenceRefused = run.answer.status === "REFUSED" && run.trace.some(event => event.stage === "evidence_gate" && event.status === "REFUSED");
  if (evidenceRefused) {
    return {
      error: null,
      info: "Speech was transcribed successfully, but no directly matching MSMARCO-XI passage was found. This is an evidence boundary, not a microphone error. Try a source-backed prompt or rephrase using terms from the indexed corpus.",
    };
  }

  if (run.detectedLanguageConfidence !== null && run.detectedLanguageConfidence !== undefined) {
    return {
      error: null,
      info: `Sarvam detected ${run.detectedLanguage} • ${Math.round(run.detectedLanguageConfidence * 100)}% confidence`,
    };
  }

  return { error: null, info: null };
}
