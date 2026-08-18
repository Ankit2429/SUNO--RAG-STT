import { AUTO_DETECT_LANGUAGE, type FocusedVoiceLanguageCode } from "@shared/voiceLanguages";

export type TypedQuestionLanguageResolution = {
  languageCode: FocusedVoiceLanguageCode | typeof AUTO_DETECT_LANGUAGE;
  source: "selected" | "script-inferred" | "unresolved";
};

export type TypedQuestionHarnessInput = {
  transcript: string;
  languageCode: FocusedVoiceLanguageCode | typeof AUTO_DETECT_LANGUAGE;
  script: "typed-input";
};

export type TypedQuestionSubmission = {
  input: TypedQuestionHarnessInput;
  languageSource: TypedQuestionLanguageResolution["source"];
};

export function normalizeTypedQuestion(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateTypedQuestion(value: string): string | null {
  const question = normalizeTypedQuestion(value);
  if (!question) return "Type a question before submitting it to the evidence harness.";
  if (question.length > 2_000) return "Keep the typed question below 2,000 characters.";
  return null;
}

/**
 * Typed input has no Sarvam audio-detection result. When the selector remains
 * on automatic detection, infer only the evaluator's supported script routes.
 * An unresolved script remains fail-closed as `unknown` rather than guessing.
 */
export function resolveTypedQuestionLanguage(
  question: string,
  selectedLanguage: FocusedVoiceLanguageCode | typeof AUTO_DETECT_LANGUAGE,
): TypedQuestionLanguageResolution {
  if (selectedLanguage !== AUTO_DETECT_LANGUAGE) return { languageCode: selectedLanguage, source: "selected" };

  const normalized = normalizeTypedQuestion(question);
  if (/[\u0C80-\u0CFF]/.test(normalized)) return { languageCode: "kn-IN", source: "script-inferred" };
  if (/[\u0B80-\u0BFF]/.test(normalized)) return { languageCode: "ta-IN", source: "script-inferred" };

  if (/[\u0900-\u097F]/.test(normalized)) {
    const looksMarathi = /(?:कोणत्या|आहे|कॉर्पोरेशन)/.test(normalized);
    return { languageCode: looksMarathi ? "mr-IN" : "hi-IN", source: "script-inferred" };
  }

  if (/[A-Za-z]/.test(normalized)) return { languageCode: "en-IN", source: "script-inferred" };
  return { languageCode: AUTO_DETECT_LANGUAGE, source: "unresolved" };
}

/** The sole client-side payload builder for typed questions sent to the RAG harness. */
export function buildTypedQuestionHarnessInput(
  value: string,
  selectedLanguage: FocusedVoiceLanguageCode | typeof AUTO_DETECT_LANGUAGE,
): TypedQuestionSubmission {
  const transcript = normalizeTypedQuestion(value);
  const resolution = resolveTypedQuestionLanguage(transcript, selectedLanguage);
  return {
    input: {
      transcript,
      languageCode: resolution.languageCode,
      script: "typed-input",
    },
    languageSource: resolution.source,
  };
}
