import { describe, expect, it } from "vitest";
import { AUTO_DETECT_LANGUAGE, FOCUSED_VOICE_LANGUAGE_CODES } from "@shared/voiceLanguages";
import { browserRecognitionLocale, configureBrowserFallback, noBrowserTranscriptMessage, type BrowserRecognitionPort, VOICE_LANGUAGES } from "./voiceLanguage";

function recognitionPort(): BrowserRecognitionPort {
  return { lang: "", interimResults: true, maxAlternatives: 0, onresult: null, onerror: null, onend: null };
}

describe("browser speech language configuration", () => {
  it("exposes only the requested five voice languages", () => {
    expect(VOICE_LANGUAGES.map(language => language.code)).toEqual(FOCUSED_VOICE_LANGUAGE_CODES);
  });

  it.each(VOICE_LANGUAGES)("returns the selected $label locale for native recognition", language => {
    expect(browserRecognitionLocale(language.code)).toBe(language.code);
  });

  it("uses the browser default recognition locale when server-side Sarvam auto-detection is selected", () => {
    expect(browserRecognitionLocale(AUTO_DETECT_LANGUAGE)).toBe("");
    expect(noBrowserTranscriptMessage(AUTO_DETECT_LANGUAGE)).toContain("select a language override");
  });

  it("identifies the selected language when browser recognition ends without a transcript", () => {
    expect(noBrowserTranscriptMessage("kn-IN")).toContain("Kannada");
  });

  it("applies the selected locale and submits a recognized transcript through the configured handler", () => {
    const recognition = recognitionPort();
    const transcripts: string[] = [];
    const errors: string[] = [];
    configureBrowserFallback(recognition, "mr-IN", { onTranscript: transcript => transcripts.push(transcript), onError: message => errors.push(message), onListeningChange: () => undefined });

    expect(recognition.lang).toBe("mr-IN");
    expect(recognition.interimResults).toBe(false);
    expect(recognition.maxAlternatives).toBe(1);
    recognition.onresult?.({ results: { 0: { 0: { transcript: " कॉर्पोरेशन म्हणजे काय? " } } } });
    recognition.onend?.();

    expect(transcripts).toEqual(["कॉर्पोरेशन म्हणजे काय?"]);
    expect(errors).toEqual([]);
  });

  it("surfaces browser errors and a selected-language empty completion error", () => {
    const erroredRecognition = recognitionPort();
    const providerErrors: string[] = [];
    configureBrowserFallback(erroredRecognition, "hi-IN", { onTranscript: () => undefined, onError: message => providerErrors.push(message), onListeningChange: () => undefined });
    erroredRecognition.onerror?.({ error: "not-allowed" });
    erroredRecognition.onend?.();
    expect(providerErrors).toEqual(["Browser speech recognition stopped: not-allowed. Check microphone permission and the selected language, then retry."]);

    const emptyRecognition = recognitionPort();
    const emptyErrors: string[] = [];
    configureBrowserFallback(emptyRecognition, "kn-IN", { onTranscript: () => undefined, onError: message => emptyErrors.push(message), onListeningChange: () => undefined });
    emptyRecognition.onend?.();
    expect(emptyErrors).toEqual([noBrowserTranscriptMessage("kn-IN")]);
  });
});
