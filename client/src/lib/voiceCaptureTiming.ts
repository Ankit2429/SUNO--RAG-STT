export const VOICE_ACTIVITY_THRESHOLD = 0.1;
export const AUTO_SEND_MIN_CAPTURE_MS = 1_000;
export const AUTO_SEND_SILENCE_MS = 1_300;

export type PauseToSendState = {
  speechDetected: boolean;
  silenceStartedAt: number | null;
  shouldSend: boolean;
};

export function updatePauseToSendState(input: {
  level: number;
  now: number;
  recordingStartedAt: number;
  speechDetected: boolean;
  silenceStartedAt: number | null;
}): PauseToSendState {
  if (input.level >= VOICE_ACTIVITY_THRESHOLD) {
    return { speechDetected: true, silenceStartedAt: null, shouldSend: false };
  }

  if (!input.speechDetected || input.now - input.recordingStartedAt < AUTO_SEND_MIN_CAPTURE_MS) {
    return { speechDetected: input.speechDetected, silenceStartedAt: null, shouldSend: false };
  }

  const silenceStartedAt = input.silenceStartedAt ?? input.now;
  return {
    speechDetected: true,
    silenceStartedAt,
    shouldSend: input.now - silenceStartedAt >= AUTO_SEND_SILENCE_MS,
  };
}
