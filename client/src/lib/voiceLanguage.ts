export const VOICE_LANGUAGES = [
  { code: "en-IN", label: "English", nativeLabel: "English" },
  { code: "kn-IN", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { code: "hi-IN", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "mr-IN", label: "Marathi", nativeLabel: "मराठी" },
] as const;

export type VoiceLanguageCode = (typeof VOICE_LANGUAGES)[number]["code"];

export function browserRecognitionLocale(languageCode: VoiceLanguageCode): string {
  return languageCode;
}

export function voiceLanguageLabel(languageCode: VoiceLanguageCode): string {
  return VOICE_LANGUAGES.find(language => language.code === languageCode)?.label ?? "selected";
}

export function noBrowserTranscriptMessage(languageCode: VoiceLanguageCode): string {
  return `No browser-native transcript was returned. Speak a complete ${voiceLanguageLabel(languageCode)} question, then retry.`;
}

export type BrowserRecognitionEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
export type BrowserRecognitionPort = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
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
    handlers.onError(`Browser speech recognition stopped: ${event.error}. Check the selected language and microphone permission, then retry.`);
  };
  recognition.onend = () => {
    handlers.onListeningChange(false);
    if (!resultReceived && !errorReceived) handlers.onError(noBrowserTranscriptMessage(languageCode));
  };
}
