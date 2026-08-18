import type { FocusedVoiceLanguageCode } from "./voiceLanguages";

export type FocusedVoiceSample = {
  languageCode: FocusedVoiceLanguageCode;
  languageLabel: string;
  prompt: string;
  evidenceMode: "grounded" | "transcription_only";
  provenance: string;
};

/**
 * Prompts retained from the real MSMARCO-XI evaluation/query artifact used by
 * the focused evaluator. They are a speaking aid, never simulated answers.
 */
export const FOCUSED_VOICE_SAMPLES: readonly FocusedVoiceSample[] = [
  { languageCode: "hi-IN", languageLabel: "Hindi", prompt: "निगम किस कानून द्वारा शासित होता है?", evidenceMode: "grounded", provenance: "MSMARCO-XI Hindi indexed evidence query" },
  { languageCode: "kn-IN", languageLabel: "Kannada", prompt: "ಕಂಪನಿಯು ಯಾವ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತ ನಡೆಸುತ್ತದೆ?", evidenceMode: "grounded", provenance: "MSMARCO-XI Kannada indexed evidence query" },
  { languageCode: "en-IN", languageLabel: "English", prompt: "What is a corporation?", evidenceMode: "transcription_only", provenance: "Speech-recognition check only" },
  { languageCode: "ta-IN", languageLabel: "Tamil", prompt: "நிறுவனம் எந்த சட்டங்களால் நிர்வகிக்கப்படுகிறது?", evidenceMode: "grounded", provenance: "MSMARCO-XI Tamil indexed evidence query" },
  { languageCode: "mr-IN", languageLabel: "Marathi", prompt: "कॉर्पोरेशन कोणत्या कायद्यांद्वारे शासित आहे?", evidenceMode: "grounded", provenance: "MSMARCO-XI Marathi indexed evidence query" },
];
