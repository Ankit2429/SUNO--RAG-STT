import { describe, expect, it } from "vitest";
import { runBenchmark } from "./benchmark";

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
    expect(report.postTranscriptionTargetMs).toBe(200);
  });
});
