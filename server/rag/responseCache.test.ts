import { describe, expect, it } from "vitest";
import type { RAGRun } from "@shared/rag";
import { TypedResponseCache } from "./responseCache";

function groundedRun(): RAGRun {
  return {
    requestId: "original",
    transcript: "What is a corporation?",
    detectedLanguage: "en-IN",
    detectedScript: "Latin",
    answer: { status: "GROUNDED", answer: "A corporation is a business entity.", evidenceIds: ["e-1"], confidenceBand: "HIGH", refusalReason: null },
    evidence: [],
    trace: [],
    latency: { sttMs: 0, ragMs: 1, endToEndMs: 1 },
  };
}

describe("TypedResponseCache", () => {
  it("returns an exact normalized typed query within its short TTL without mutating the stored run", () => {
    let current = 1_000;
    const cache = new TypedResponseCache(100, 4, () => current);
    const original = groundedRun();
    cache.set(" What   is a corporation? ", "en-IN", original);

    const hit = cache.get("what is a corporation?", "en-IN");
    expect(hit?.ageMs).toBe(0);
    expect(hit?.run.answer.evidenceIds).toEqual(["e-1"]);
    hit!.run.answer.evidenceIds.push("changed");
    expect(cache.get("what is a corporation?", "en-IN")?.run.answer.evidenceIds).toEqual(["e-1"]);
  });

  it("does not share entries across languages, cache refusals, or return expired entries", () => {
    let current = 1_000;
    const cache = new TypedResponseCache(50, 4, () => current);
    const grounded = groundedRun();
    cache.set(grounded.transcript, "en-IN", grounded);
    expect(cache.get(grounded.transcript, "hi-IN")).toBeNull();

    cache.set("unsafe", "en-IN", { ...grounded, answer: { ...grounded.answer, status: "REFUSED", evidenceIds: [] } });
    expect(cache.get("unsafe", "en-IN")).toBeNull();

    current += 51;
    expect(cache.get(grounded.transcript, "en-IN")).toBeNull();
  });
});
