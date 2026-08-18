import { describe, expect, it } from "vitest";
import { AUTO_SEND_MIN_CAPTURE_MS, AUTO_SEND_SILENCE_MS, updatePauseToSendState, VOICE_ACTIVITY_THRESHOLD } from "./voiceCaptureTiming";

describe("pause-to-send voice capture timing", () => {
  it("marks speech activity and clears any pending silence timer", () => {
    expect(updatePauseToSendState({ level: VOICE_ACTIVITY_THRESHOLD, now: 900, recordingStartedAt: 0, speechDetected: false, silenceStartedAt: 500 }))
      .toEqual({ speechDetected: true, silenceStartedAt: null, shouldSend: false });
  });

  it("does not send before the minimum capture duration or without speech", () => {
    expect(updatePauseToSendState({ level: 0, now: AUTO_SEND_MIN_CAPTURE_MS - 1, recordingStartedAt: 0, speechDetected: true, silenceStartedAt: 10 }).shouldSend).toBe(false);
    expect(updatePauseToSendState({ level: 0, now: AUTO_SEND_MIN_CAPTURE_MS + AUTO_SEND_SILENCE_MS + 1, recordingStartedAt: 0, speechDetected: false, silenceStartedAt: null }).shouldSend).toBe(false);
  });

  it("sends only after a bounded quiet pause following detected speech", () => {
    const pauseStarted = AUTO_SEND_MIN_CAPTURE_MS + 20;
    expect(updatePauseToSendState({ level: 0, now: pauseStarted, recordingStartedAt: 0, speechDetected: true, silenceStartedAt: null }).shouldSend).toBe(false);
    expect(updatePauseToSendState({ level: 0, now: pauseStarted + AUTO_SEND_SILENCE_MS - 1, recordingStartedAt: 0, speechDetected: true, silenceStartedAt: pauseStarted }).shouldSend).toBe(false);
    expect(updatePauseToSendState({ level: 0, now: pauseStarted + AUTO_SEND_SILENCE_MS, recordingStartedAt: 0, speechDetected: true, silenceStartedAt: pauseStarted }).shouldSend).toBe(true);
  });
});
