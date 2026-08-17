import { describe, expect, it } from "vitest";

const qdrantUrl = process.env.QDRANT_URL?.replace(/\/$/, "");
const qdrantApiKey = process.env.QDRANT_API_KEY;
const sarvamApiKey = process.env.SARVAM_API_KEY;

describe("server-only provider credentials", () => {
  it("authenticates to the configured Qdrant collection endpoint", async () => {
    expect(qdrantUrl).toMatch(/^https:\/\//);
    expect(qdrantApiKey).toBeTruthy();

    const response = await fetch(`${qdrantUrl}/collections`, {
      headers: { "api-key": qdrantApiKey! },
    });

    expect(response.status, "Qdrant must accept the server-side api-key").not.toBe(401);
    expect(response.status, "Qdrant must accept the server-side api-key").not.toBe(403);
    expect(response.ok).toBe(true);
  }, 15_000);

  it("authenticates to Sarvam without submitting billable audio", async () => {
    expect(sarvamApiKey).toBeTruthy();

    const audio = new Blob([new Uint8Array([0])], { type: "audio/webm" });
    const form = new FormData();
    form.append("file", audio, "credential-check.webm");
    form.append("model", "saaras:v3");
    form.append("mode", "transcribe");
    form.append("language_code", "unknown");

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": sarvamApiKey! },
      body: form,
    });

    expect(response.status, "Sarvam must not reject the server-side api key").not.toBe(403);
    expect(response.status).toBeGreaterThanOrEqual(400);
  }, 15_000);
});
