import { createHash, randomUUID } from "node:crypto";
import { isSarvamLanguageCode, languageForCode, SARVAM_LANGUAGE_CODES } from "@shared/voiceLanguages";

type SarvamResponse = {
  request_id?: string | null;
  transcript?: string;
  language_code?: string | null;
  language_probability?: number | null;
};

export type TranscriptionResult = {
  transcript: string;
  languageCode: string;
  script: string;
  languageProbability: number | null;
  autoDetected: boolean;
  providerRequestId: string | null;
  idempotencyKey: string;
};

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const SUPPORTED_LANGUAGE_HINTS = new Set<string>(["unknown", ...SARVAM_LANGUAGE_CODES]);

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value.replace(/^data:[^;]+;base64,/, ""), "base64"));
}

function scriptFor(languageCode: string): string {
  return isSarvamLanguageCode(languageCode) ? languageForCode(languageCode)?.script || "Unknown" : "Unknown";
}

function pause(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function transcribeWithSarvam(input: {
  audioBase64: string;
  mimeType: string;
  languageHint?: string;
}): Promise<TranscriptionResult> {
  const secret = process.env.SARVAM_API_KEY;
  if (!secret) throw new Error("Sarvam transcription is not configured on the server.");
  const bytes = base64ToBytes(input.audioBase64);
  if (!bytes.byteLength) throw new Error("The recorded audio is empty.");
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("The recording exceeds the 4 MB upload guardrail.");
  const languageHint = SUPPORTED_LANGUAGE_HINTS.has(input.languageHint || "") ? input.languageHint! : "unknown";
  // MediaRecorder commonly reports `audio/webm;codecs=opus`; Sarvam validates the
  // multipart file MIME against a base-type allowlist, so strip media parameters.
  const providerMimeType = input.mimeType.split(";", 1)[0].trim().toLowerCase();

  const idempotencyKey = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  const extension = providerMimeType.includes("ogg") ? "ogg" : providerMimeType.includes("wav") ? "wav" : "webm";
  let lastError = "Sarvam did not return a transcription.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const form = new FormData();
    const audio = new Uint8Array(bytes.byteLength);
    audio.set(bytes);
    form.set("file", new Blob([audio.buffer], { type: providerMimeType }), `voice-${randomUUID()}.${extension}`);
    form.set("model", "saaras:v3");
    form.set("mode", "transcribe");
    form.set("language_code", languageHint);
    let response: Response;
    try {
      response = await fetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: { "api-subscription-key": secret, "x-idempotency-key": idempotencyKey },
        body: form,
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      lastError = timedOut ? "Sarvam transcription timed out. Please retry your question." : `Sarvam network failure: ${error instanceof Error ? error.message : "unknown"}`;
      if (attempt === 2) break;
      await pause(120 * 2 ** attempt);
      continue;
    }
    const payload = (await response.json().catch(() => ({}))) as SarvamResponse & { error?: { message?: string } };
    if (response.ok && payload.transcript?.trim()) {
      const languageCode = payload.language_code || "unknown";
      const languageProbability = typeof payload.language_probability === "number" && payload.language_probability >= 0 && payload.language_probability <= 1
        ? payload.language_probability
        : null;
      return {
        transcript: payload.transcript.trim(),
        languageCode,
        script: scriptFor(languageCode),
        languageProbability,
        autoDetected: languageHint === "unknown",
        providerRequestId: payload.request_id ?? null,
        idempotencyKey,
      };
    }
    lastError = payload.error?.message || (response.ok ? "Sarvam returned an empty transcript. Speak clearly for at least one second, then try again." : `Sarvam responded with ${response.status}.`);
    if ((!RETRYABLE_STATUS.has(response.status) && !(response.ok && !payload.transcript?.trim())) || attempt === 2) break;
    await pause(120 * 2 ** attempt);
  }
  throw new Error(lastError);
}
