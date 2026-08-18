import type { PercentileSummary } from "@shared/rag";

export function summarizeLatency(samples: number[], failureCount = 0): PercentileSummary {
  const sorted = [...samples].filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (p: number) => {
    if (!sorted.length) return 0;
    return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] * 100) / 100;
  };
  return {
    p50: percentile(0.5),
    p70: percentile(0.7),
    p90: percentile(0.9),
    p95: percentile(0.95),
    p100: percentile(1),
    sampleCount: sorted.length,
    failureCount,
  };
}
