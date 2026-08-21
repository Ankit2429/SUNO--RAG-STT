export const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

// Match SUNO's existing manual STOP & SEND threshold. The separate pause-to-send
// control remains at one second before automatic submission is eligible.
export const MIN_CAPTURE_DURATION_MS = 700;
export const MIN_CAPTURE_BYTES = 512;
export const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;

export type RecorderMimeSupport = {
  mimeType: string;
  supported: boolean;
};

export type RecorderMimeSelection = {
  requestedMimeType: string | null;
  support: RecorderMimeSupport[];
};

export function selectRecorderMimeType(isTypeSupported: (mimeType: string) => boolean): RecorderMimeSelection {
  const support = RECORDER_MIME_CANDIDATES.map(mimeType => ({ mimeType, supported: isTypeSupported(mimeType) }));
  return { requestedMimeType: support.find(candidate => candidate.supported)?.mimeType || null, support };
}

export function normalizeAudioMimeType(value: string | null | undefined): string {
  const baseType = (value || "").split(";", 1)[0].trim().toLowerCase();
  if (baseType === "audio/x-wav" || baseType === "audio/wave") return "audio/wav";
  return baseType;
}

export function isSarvamCompatibleAudioMimeType(value: string | null | undefined): boolean {
  return new Set(["audio/webm", "audio/ogg", "audio/wav"]).has(normalizeAudioMimeType(value));
}

export function recorderSupportSummary(support: RecorderMimeSupport[]): string {
  return support.map(candidate => `${candidate.mimeType}=${candidate.supported ? "yes" : "no"}`).join(", ");
}

export function validateCapturedAudio(input: { mimeType: string; size: number; durationMs: number }): string | null {
  const mimeType = normalizeAudioMimeType(input.mimeType);
  if (!mimeType.startsWith("audio/")) return "The browser did not provide a valid audio MIME type. Try the current Chrome, Edge, Brave, or Firefox release.";
  if (input.durationMs < MIN_CAPTURE_DURATION_MS) return "Recording was too short. Speak for at least one second before selecting STOP & SEND.";
  if (input.size < MIN_CAPTURE_BYTES) return "No usable audio was captured. Check microphone permission, speak clearly, and try again.";
  if (input.size > MAX_CAPTURE_BYTES) return "Recording is too large for the short-audio safety limit. Keep the clip under 30 seconds.";
  return null;
}

type DecodedAudio = {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(channel: number): Float32Array;
};

function encodeWav(audio: DecodedAudio): ArrayBuffer {
  const channels = Math.max(1, Math.min(2, audio.numberOfChannels));
  const dataSize = audio.length * channels * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  const samples = Array.from({ length: channels }, (_, channel) => audio.getChannelData(channel));
  let offset = 44;
  for (let index = 0; index < audio.length; index += 1) {
    for (const channel of samples) {
      const sample = Math.max(-1, Math.min(1, channel[index] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

/**
 * Only non-Sarvam recorder output is decoded locally and re-encoded as PCM WAV.
 * This keeps normal WebM/Ogg Edge/Chrome/Brave capture on the existing direct path.
 */
export async function normalizeAudioForSarvam(blob: Blob): Promise<{ blob: Blob; mimeType: string; normalized: boolean }> {
  const sourceMimeType = normalizeAudioMimeType(blob.type);
  if (isSarvamCompatibleAudioMimeType(sourceMimeType)) {
    return { blob, mimeType: blob.type, normalized: false };
  }

  const BrowserAudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!BrowserAudioContext) throw new Error("This browser cannot normalize the recorded audio. Use a current Chrome, Edge, Brave, or Firefox release.");
  const context = new BrowserAudioContext();
  try {
    const audio = await context.decodeAudioData((await blob.arrayBuffer()).slice(0));
    return { blob: new Blob([encodeWav(audio)], { type: "audio/wav" }), mimeType: "audio/wav", normalized: true };
  } catch {
    throw new Error("The browser recorded an unsupported audio format and could not normalize it. Try a current Chrome, Edge, Brave, or Firefox release.");
  } finally {
    await context.close().catch(() => undefined);
  }
}
