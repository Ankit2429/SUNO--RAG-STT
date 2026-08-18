import { AUTO_DETECT_LANGUAGE, FOCUSED_SARVAM_STT_LANGUAGES, languageForCode, type FocusedVoiceLanguageCode } from "@shared/voiceLanguages";

export const VOICE_LANGUAGES = FOCUSED_SARVAM_STT_LANGUAGES;

export type VoiceLanguageCode = FocusedVoiceLanguageCode | typeof AUTO_DETECT_LANGUAGE;

export function browserRecognitionLocale(languageCode: VoiceLanguageCode): string {
  // An empty locale lets the browser use its configured recognition language when
  // Sarvam's server-side primary path is in automatic-detection mode.
  return languageCode === AUTO_DETECT_LANGUAGE ? "" : languageCode;
}

export function voiceLanguageLabel(languageCode: VoiceLanguageCode): string {
  return languageCode === AUTO_DETECT_LANGUAGE ? "automatic language detection" : languageForCode(languageCode)?.label ?? "selected";
}

export function noBrowserTranscriptMessage(languageCode: VoiceLanguageCode): string {
  return languageCode === AUTO_DETECT_LANGUAGE
    ? "No browser-native transcript was returned. Speak a complete question, then retry or select a language override."
    : `No browser-native transcript was returned. Speak a complete ${voiceLanguageLabel(languageCode)} question, then retry.`;
}

export type BrowserRecognitionEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
export type BrowserRecognitionPort = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  abort?: () => void;
  stop?: () => void;
  onresult: ((event: BrowserRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function configureBrowserFallback(
  recognition: BrowserRecognitionPort,
  languageCode: VoiceLanguageCode,
  handlers: { onTranscript: (transcript: string) => void; onError: (message: string) => void; onListeningChange: (listening: boolean) => void },
): void {
  let resultReceived = false;
  let errorReceived = false;
  recognition.lang = browserRecognitionLocale(languageCode);
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = event => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (!transcript) return;
    resultReceived = true;
    handlers.onTranscript(transcript);
  };
  recognition.onerror = event => {
    errorReceived = true;
    handlers.onListeningChange(false);
    handlers.onError(`Browser speech recognition stopped: ${event.error}. Check microphone permission${languageCode === AUTO_DETECT_LANGUAGE ? " or select a language override" : " and the selected language"}, then retry.`);
  };
  recognition.onend = () => {
    handlers.onListeningChange(false);
    if (!resultReceived && !errorReceived) handlers.onError(noBrowserTranscriptMessage(languageCode));
  };
}
