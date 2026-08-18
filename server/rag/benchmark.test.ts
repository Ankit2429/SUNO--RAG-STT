import { describe, expect, it } from "vitest";
import type { RAGRun } from "@shared/rag";
import { runBenchmark, runFiveLanguageBenchmark } from "./benchmark";

describe("runBenchmark", () => {
  it("reports separate warm and cold results for at least 100 real and adversarial cases", async () => {
    const report = await runBenchmark();

    expect(report.queryCount).toBeGreaterThanOrEqual(100);
    expect(report.datasetQueryCount).toBe(100);
    expect(report.adversarialQueryCount).toBeGreaterThan(0);
    expect(report.cold.sampleCount).toBe(report.queryCount);
    expect(report.warm.sampleCount).toBe(report.queryCount);
    expect(report.cold.p100).toBeGreaterThanOrEqual(report.cold.p50);
    expect(report.warm.p100).toBeGreaterThanOrEqual(report.warm.p50);
    expect(report.coldStageTimings.map(summary => summary.stage)).toEqual(["normalize + scope", "route + retrieval", "evidence + verify", "answer assembly", "total internal"]);
    expect(report.warmStageTimings).toHaveLength(5);
    expect(report.warmStageTimings.every(summary => summary.sampleCount === report.queryCount && summary.p100 >= summary.p50 && summary.averageMs >= 0)).toBe(true);
    expect(report.postTranscriptionTargetMs).toBe(200);
  });

  it("runs an even, auditable five-language schedule with per-language outcomes", async () => {
    let sequence = 0;
    const report = await runFiveLanguageBenchmark({
      queriesPerLanguage: 5,
      runner: async input => ({
        requestId: `test-${sequence += 1}`,
        transcript: input.transcript,
        detectedLanguage: input.languageCode,
        detectedScript: "test",
        answer: { status: "GROUNDED", answer: "test", evidenceIds: ["evidence"], confidenceBand: "HIGH", refusalReason: null },
        evidence: [{ id: "evidence", text: "test", language: input.languageCode.slice(0, 2), source: "ai4bharat/MSMARCO-XI", strategy: "paragraph_section", parentId: "parent", queryId: "query", queryType: "DESCRIPTION", ordinal: 0, selected: true, overlap: 0 }],
        trace: [{ stage: "query_route", status: "OK", durationMs: 0.1, detail: "L1 local evidence" }],
        latency: { sttMs: 0, ragMs: sequence / 10, endToEndMs: sequence / 10 },
      } satisfies RAGRun),
    });

    expect(report.totalQueries).toBe(25);
    expect(report.rawTelemetry).toHaveLength(25);
    expect(report.languages.map(language => language.requestCount)).toEqual([5, 5, 5, 5, 5]);
    expect(report.languages.map(language => language.uniqueFixtureCount)).toEqual([5, 5, 5, 5, 5]);
    expect(report.languages.find(language => language.languageCode === "en-IN")?.statusCounts).toEqual({ GROUNDED: 5, REFUSED: 0, ERROR: 0 });
    expect(report.combinedStatusCounts).toEqual({ GROUNDED: 25, REFUSED: 0, ERROR: 0 });
    expect(report.rawTelemetry.every(sample => sample.route === "L1 local evidence")).toBe(true);
  });
});
