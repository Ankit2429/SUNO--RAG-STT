import { describe, expect, it } from "vitest";
import type { RAGRun } from "@shared/rag";
import { resolveVoiceRecovery } from "./voiceRecovery";

function run(overrides: Partial<RAGRun> = {}): RAGRun {
  return {
    requestId: "run-1",
    transcript: "sample",
    detectedLanguage: "hi-IN",
    detectedScript: "Devanagari",
    answer: { status: "GROUNDED", answer: "Supported answer.", evidenceIds: [], confidenceBand: "HIGH", refusalReason: null },
    evidence: [],
    trace: [],
    latency: { sttMs: 1, ragMs: 1, endToEndMs: 2 },
    ...overrides,
  };
}

describe("resolveVoiceRecovery", () => {
  it("surfaces transcription failures as visible recovery errors", () => {
    expect(resolveVoiceRecovery(run({ transcriptionError: "Sarvam rejected the recording." }))).toEqual({ error: "Sarvam rejected the recording.", info: null });
  });

  it("surfaces structured pipeline errors even when transcription completed", () => {
    const outcome = resolveVoiceRecovery(run({ answer: { status: "ERROR", answer: "", evidenceIds: [], confidenceBand: "NONE", refusalReason: "Retrieval service unavailable." } }));
    expect(outcome.error).toBe("Retrieval service unavailable.");
  });

  it("explains how to recover from low-confidence auto detection", () => {
    const outcome = resolveVoiceRecovery(run({ detectedLanguage: "gu-IN", detectedLanguageConfidence: 0.76, trace: [{ stage: "detect_language", status: "REFUSED", durationMs: 1, detail: "Below threshold." }] }));
    expect(outcome).toEqual({ error: null, info: "Automatic detection could not confirm the spoken language (76% confidence). Select a language override and record again." });
  });

  it("retains a successful detected-language confidence message", () => {
    expect(resolveVoiceRecovery(run({ detectedLanguageConfidence: 0.91 }))).toEqual({ error: null, info: "Sarvam detected hi-IN • 91% confidence" });
  });
});
