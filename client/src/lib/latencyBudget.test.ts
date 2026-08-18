import { describe, expect, it } from "vitest";
import { buildInternalLatencyBudget } from "./latencyBudget";

describe("buildInternalLatencyBudget", () => {
  it("keeps speech-to-text outside the internal 200 ms budget while grouping real harness stages", () => {
    const budget = buildInternalLatencyBudget({
      requestId: "run-1",
      transcript: "question",
      detectedLanguage: "hi-IN",
      detectedScript: "Devanagari",
      answer: { status: "GROUNDED", answer: "answer", evidenceIds: [], confidenceBand: "HIGH", refusalReason: null },
      evidence: [],
      trace: [
        { stage: "query_route", status: "OK", durationMs: 1.25, detail: "route" },
        { stage: "parallel_retrieve", status: "OK", durationMs: 17.5, detail: "retrieve" },
        { stage: "fuse", status: "OK", durationMs: 0.75, detail: "fuse" },
        { stage: "rerank", status: "OK", durationMs: 2, detail: "rerank" },
        { stage: "evidence_gate", status: "OK", durationMs: 0.4, detail: "gate" },
        { stage: "generate", status: "OK", durationMs: 1.1, detail: "generate" },
        { stage: "verify", status: "OK", durationMs: 0.2, detail: "verify" },
        { stage: "return", status: "OK", durationMs: 0.1, detail: "return" },
      ],
      latency: { sttMs: 1500, ragMs: 23.3, endToEndMs: 1523.3 },
    });

    expect(budget).toMatchObject({ retrievalMs: 21.5, safetyMs: 0.7, answerMs: 1.1, sttMs: 1500, internalMs: 23.3, underBudget: true });
  });
});
