import { describe, expect, it } from "vitest";
import { resolveVoiceOutputProgress } from "./voiceProgress";

describe("resolveVoiceOutputProgress", () => {
  it("keeps the output panel idle until an audio or transcript request exists", () => {
    expect(resolveVoiceOutputProgress(null, false)).toBeNull();
  });

  it("surfaces packaging before the external request begins", () => {
    expect(resolveVoiceOutputProgress("Audio captured • packaging secure clip for immediate Sarvam submission.", false)).toMatchObject({ label: "PACKAGING AUDIO", activeStep: 0 });
  });

  it("surfaces external transcription while Sarvam is pending", () => {
    expect(resolveVoiceOutputProgress("Secure clip sent • Sarvam is transcribing your speech.", true)).toMatchObject({ label: "SARVAM TRANSCRIBING", activeStep: 1 });
  });

  it("surfaces corpus matching for the browser fallback", () => {
    expect(resolveVoiceOutputProgress("Browser transcript received • matching against bounded MSMARCO-XI evidence.", true)).toMatchObject({ label: "MATCHING EVIDENCE", activeStep: 2 });
  });
});
