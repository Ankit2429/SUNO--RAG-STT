import { describe, expect, it } from "vitest";
import { buildClientDiagnostics, detectBrowser, isSarvamCompatibleAudioMimeType, normalizeAudioForSarvam, normalizeAudioMimeType, recorderSupportSummary, selectRecorderMimeType, validateCapturedAudio } from "./voiceCaptureFormat";

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

  it("detects browser brands accurately from navigator properties and userAgent", () => {
    expect(detectBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", { brave: { isBrave: () => Promise.resolve() } })).toBe("Brave");
    expect(detectBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0")).toBe("Edge");
    expect(detectBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0")).toBe("Firefox");
    expect(detectBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBe("Chrome");
  });

  it("formats client diagnostics with all required fields without exposing confidential data", () => {
    const diag = buildClientDiagnostics({
      browser: "Brave",
      selectedMimeType: "audio/webm;codecs=opus",
      blobMimeType: "audio/webm;codecs=opus",
      blobSize: 12400,
      durationMs: 1250,
      supportSummary: "audio/webm;codecs=opus=yes, audio/webm=yes",
      isMediaRecorderSupported: true,
    });

    expect(diag.browser).toBe("Brave");
    expect(diag.isEmpty).toBe(false);
    expect(diag.summaryString).toContain("[Diagnostics] browser: Brave");
    expect(diag.summaryString).toContain("selectedMime: audio/webm;codecs=opus");
    expect(diag.summaryString).toContain("blobMime: audio/webm;codecs=opus");
    expect(diag.summaryString).toContain("blobSize: 12400 bytes");
    expect(diag.summaryString).toContain("duration: 1250 ms");
    expect(diag.summaryString).toContain("isEmpty: NO");
    expect(diag.summaryString).toContain("mediaRecorderSupported: yes");
  });
});
