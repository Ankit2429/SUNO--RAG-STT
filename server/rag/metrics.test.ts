import { describe, expect, it } from "vitest";
import { summarizeLatency } from "./metrics";

describe("latency statistics", () => {
  it("reports P50, P70, and P100 with the actual sample and failure counts", () => {
    expect(summarizeLatency([12, 18, 23, 29, 31, 45, 70, 102, 150, 190], 2)).toEqual({
      p50: 31,
      p70: 70,
      p100: 190,
      sampleCount: 10,
      failureCount: 2,
    });
  });
});
