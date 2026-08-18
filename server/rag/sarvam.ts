import { createHash, randomUUID } from "node:crypto";
import { isSarvamLanguageCode, languageForCode, SARVAM_LANGUAGE_CODES } from "@shared/voiceLanguages";

type SarvamResponse = {
  request_id?: string | null;
  transcript?: string;
  language_code?: string | null;
};

export type TranscriptionResult = {
  transcript: string;
  languageCode: string;
  script: string;
  providerRequestId: string | null;
  idempotencyKey: string;
};

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const RETRYABLE_STATUS = new Set([429, 503]);
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

  const idempotencyKey = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  const extension = input.mimeType.includes("ogg") ? "ogg" : input.mimeType.includes("wav") ? "wav" : "webm";
  let lastError = "Sarvam did not return a transcription.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const form = new FormData();
    const audio = new Uint8Array(bytes.byteLength);
    audio.set(bytes);
    form.set("file", new Blob([audio.buffer], { type: input.mimeType }), `voice-${randomUUID()}.${extension}`);
    form.set("model", "saaras:v3");
    form.set("mode", "transcribe");
    form.set("language_code", languageHint);
    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": secret, "x-idempotency-key": idempotencyKey },
      body: form,
      signal: AbortSignal.timeout(25_000),
    }).catch(error => {
      throw new Error(`Sarvam network failure: ${error instanceof Error ? error.message : "unknown"}`);
    });
    const payload = (await response.json().catch(() => ({}))) as SarvamResponse & { error?: { message?: string } };
    if (response.ok && payload.transcript?.trim()) {
      const languageCode = payload.language_code || "unknown";
      return {
        transcript: payload.transcript.trim(),
        languageCode,
        script: scriptFor(languageCode),
        providerRequestId: payload.request_id ?? null,
        idempotencyKey,
      };
    }
    lastError = payload.error?.message || (response.ok ? "Sarvam returned an empty transcript. Speak clearly for at least one second, then try again." : `Sarvam responded with ${response.status}.`);
    if (!RETRYABLE_STATUS.has(response.status) || attempt === 2) break;
    await pause(120 * 2 ** attempt);
  }
  throw new Error(lastError);
}
