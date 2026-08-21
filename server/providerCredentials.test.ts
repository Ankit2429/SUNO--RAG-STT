import { describe, expect, it } from "vitest";

const transientNetworkCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const causeCode = (error.cause as { code?: string } | undefined)?.code;
  return (
    error.name === "TimeoutError" ||
    transientNetworkCodes.has(causeCode ?? "") ||
    /fetch failed|network|aborted due to timeout|timed out/i.test(error.message)
  );
}

async function fetchWithTransientRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === attempts) break;
      await new Promise(resolve => setTimeout(resolve, 350 * attempt));
    }
  }

  throw lastError;
}

const qdrantUrl = process.env.QDRANT_URL?.replace(/\/$/, "");
const qdrantApiKey = process.env.QDRANT_API_KEY;
const sarvamApiKey = process.env.SARVAM_API_KEY;

describe("server-only provider credentials", () => {
  it("authenticates to the configured Qdrant collection endpoint", async () => {
    expect(qdrantUrl).toMatch(/^https:\/\//);
    expect(qdrantApiKey).toBeTruthy();

    const response = await fetchWithTransientRetry(`${qdrantUrl}/collections`, {
      headers: { "api-key": qdrantApiKey! },
    });

    expect(response.status, "Qdrant must accept the server-side api-key").not.toBe(401);
    expect(response.status, "Qdrant must accept the server-side api-key").not.toBe(403);
    expect(response.ok).toBe(true);
  }, 50_000);

  it("authenticates to Sarvam without submitting billable audio", async () => {
    expect(sarvamApiKey).toBeTruthy();

    const audio = new Blob([new Uint8Array([0])], { type: "audio/webm" });
    const form = new FormData();
    form.append("file", audio, "credential-check.webm");
    form.append("model", "saaras:v3");
    form.append("mode", "transcribe");
    form.append("language_code", "unknown");

    const response = await fetchWithTransientRetry("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": sarvamApiKey! },
      body: form,
    });

    expect(response.status, "Sarvam must not reject the server-side api key").not.toBe(403);
    expect(response.status).toBeGreaterThanOrEqual(400);
  }, 50_000);
});
