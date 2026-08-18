import { afterEach, describe, expect, it, vi } from "vitest";
import { EVALUATION_MANIFEST } from "@shared/evaluationManifest";
import { hybridRetrieve, retrievalInternals } from "./retrieval";

describe("bounded language inventory routing", () => {
  const savedQdrantUrl = process.env.QDRANT_URL;
  const savedQdrantKey = process.env.QDRANT_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.QDRANT_URL = savedQdrantUrl;
    process.env.QDRANT_API_KEY = savedQdrantKey;
  });

  it.each(["en-IN", "doi-IN", "ks-IN"])("fails closed locally for unindexed %s evidence instead of calling remote retrieval", async languageCode => {
    const retrieval = await hybridRetrieve("What is a corporation?", languageCode);

    expect(retrieval).toEqual({ evidence: [], scores: new Map(), mode: "local_no_evidence" });
  });

  it("marks Kannada and the fourteen compatible MSMARCO-XI languages as indexed evidence", () => {
    expect(EVALUATION_MANIFEST.languages).toHaveLength(14);
    expect(EVALUATION_MANIFEST.languages).toContain("kn");
    expect(EVALUATION_MANIFEST.languages).toEqual(expect.arrayContaining(["as", "bn", "gu", "hi", "ml", "mr", "ne", "or", "pa", "sa", "ta", "te", "ur"]));
  });

  it.each([
    ["kn-IN", "ಕಾರ್ಪೊರೇಟ್ ಚೆಕ್ ಎಂದರೇನು?"],
    ["gu-IN", "શું એક કોર્પોરેશન છે?"],
    ["ml-IN", "ഒരു കോർപ്പറേഷൻ എന്താണ്?"],
    ["as-IN", "কৰ্পোৰেচন কি?"],
    ["ur-IN", "کارپوریشن کیا ہے؟"],
  ])("serves a representative %s query from the bounded in-process evidence cache", async (languageCode, query) => {
    const retrieval = await hybridRetrieve(query, languageCode);

    expect(retrieval.mode).toBe("local_hot");
    expect(retrieval.evidence.length).toBeGreaterThan(0);
    expect(retrieval.evidence.every(chunk => chunk.language === languageCode.split("-")[0])).toBe(true);
  });

  it("does not fast-return unrelated Kannada L1 candidates for a question with no local lexical support", async () => {
    const retrieval = retrievalInternals.retrieveHot("ಭಾರತದ ರಾಜಧಾನಿ ಯಾವುದು?", "kn-IN");

    expect(retrieval).toBeNull();
  });

  it("returns a bounded cloud-timeout refusal instead of waiting on a slow unsupported fallback", async () => {
    process.env.QDRANT_URL = "https://qdrant.example";
    process.env.QDRANT_API_KEY = "test-key";
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));

    const retrieval = await hybridRetrieve("ಭಾರತದ ರಾಜಧಾನಿ ಯಾವುದು?", "kn-IN", { cloudTimeoutMs: 25 });

    expect(retrieval).toEqual({ evidence: [], scores: new Map(), mode: "cloud_timeout" });
  });
});
