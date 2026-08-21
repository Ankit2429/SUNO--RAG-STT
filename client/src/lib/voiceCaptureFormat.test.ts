import { describe, expect, it } from "vitest";
import { isSarvamCompatibleAudioMimeType, normalizeAudioForSarvam, normalizeAudioMimeType, recorderSupportSummary, selectRecorderMimeType, validateCapturedAudio } from "./voiceCaptureFormat";

describe("browser voice capture format handling", () => {
  it("prefers the first standards-supported recorder MIME type", () => {
    const selection = selectRecorderMimeType(mimeType => mimeType === "audio/webm;codecs=opus" || mimeType === "audio/ogg");

    expect(selection.requestedMimeType).toBe("audio/webm;codecs=opus");
    expect(recorderSupportSummary(selection.support)).toContain("audio/ogg=yes");
  });

  it("falls through the safe candidate order when WebM is unavailable", () => {
    const selection = selectRecorderMimeType(mimeType => mimeType === "audio/ogg;codecs=opus");

    expect(selection.requestedMimeType).toBe("audio/ogg;codecs=opus");
  });

  it("normalizes MIME parameters and accepts Sarvam-compatible browser formats", async () => {
    const blob = new Blob(["captured audio"], { type: "audio/webm;codecs=opus" });
    const prepared = await normalizeAudioForSarvam(blob);

    expect(normalizeAudioMimeType("audio/x-wav; codecs=1")).toBe("audio/wav");
    expect(isSarvamCompatibleAudioMimeType("audio/ogg;codecs=opus")).toBe(true);
    expect(prepared).toEqual({ blob, mimeType: "audio/webm;codecs=opus", normalized: false });
  });

  it("rejects empty, too-short, non-audio, and oversized browser recordings before upload", () => {
    expect(validateCapturedAudio({ mimeType: "audio/webm", size: 0, durationMs: 1_500 })).toMatch(/No usable audio/);
    expect(validateCapturedAudio({ mimeType: "audio/webm", size: 1_000, durationMs: 699 })).toMatch(/too short/);
    expect(validateCapturedAudio({ mimeType: "video/webm", size: 1_000, durationMs: 1_500 })).toMatch(/valid audio MIME/);
    expect(validateCapturedAudio({ mimeType: "audio/ogg", size: 5 * 1024 * 1024, durationMs: 1_500 })).toMatch(/too large/);
    expect(validateCapturedAudio({ mimeType: "audio/ogg", size: 1_000, durationMs: 1_500 })).toBeNull();
  });
});
