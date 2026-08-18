import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeWithSarvam } from "./sarvam";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.SARVAM_API_KEY;
const audioBase64 = Buffer.from("synthetic-browser-audio-frame").toString("base64");

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.SARVAM_API_KEY;
  else process.env.SARVAM_API_KEY = originalApiKey;
});

describe("transcribeWithSarvam", () => {
  it.each(["en-IN", "kn-IN", "hi-IN", "mr-IN"] as const)("forwards the selected %s locale to Sarvam", async languageHint => {
    process.env.SARVAM_API_KEY = "test-key";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("language_code")).toBe(languageHint);
      expect(form.get("model")).toBe("saaras:v3");
      expect(form.get("mode")).toBe("transcribe");
      expect(form.get("file")).toBeInstanceOf(Blob);
      return new Response(JSON.stringify({ transcript: "A supported question", language_code: languageHint, request_id: "request-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await transcribeWithSarvam({ audioBase64, mimeType: "audio/webm;codecs=opus", languageHint });

    expect(result.languageCode).toBe(languageHint);
    expect(result.transcript).toBe("A supported question");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns Sarvam’s non-retryable audio error for UI display", async () => {
    process.env.SARVAM_API_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Failed to read the file, please check the audio format." } }), { status: 400, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    await expect(transcribeWithSarvam({ audioBase64, mimeType: "audio/webm;codecs=opus", languageHint: "kn-IN" })).rejects.toThrow("Failed to read the file, please check the audio format.");
  });
});
