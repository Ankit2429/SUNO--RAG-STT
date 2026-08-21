import { afterEach, describe, expect, it, vi } from "vitest";
import { EVALUATION_MANIFEST } from "@shared/evaluationManifest";
import { getIndexCapability, hybridRetrieve, retrievalInternals } from "./retrieval";

describe("bounded language inventory routing", () => {
  const savedQdrantUrl = process.env.QDRANT_URL;
  const savedQdrantKey = process.env.QDRANT_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.QDRANT_URL = savedQdrantUrl;
    process.env.QDRANT_API_KEY = savedQdrantKey;
  });

  it.each(["doi-IN", "ks-IN"])("fails closed locally for unindexed %s evidence instead of calling remote retrieval", async languageCode => {
    const retrieval = await hybridRetrieve("What is a corporation?", languageCode);

    expect(retrieval).toEqual({ evidence: [], scores: new Map(), mode: "local_no_evidence" });
  });

  it("serves the source-linked English corporation prompt from bounded local companion evidence", async () => {
    const retrieval = await hybridRetrieve("What is a corporation?", "en-IN");

    expect(retrieval.mode).toBe("local_hot");
    expect(retrieval.evidence.length).toBeGreaterThan(0);
    expect(retrieval.evidence.every(chunk => chunk.language === "en")).toBe(true);
    expect(retrieval.evidence.some(chunk => chunk.queryId === "1102432")).toBe(true);
  });

  it("routes the short Hindi corporation wording to its direct MSMARCO-XI source evidence", () => {
    const retrieval = retrievalInternals.retrieveHot("कॉर्पोरेशन क्या है?", "hi-IN");

    expect(retrieval?.mode).toBe("local_hot");
    expect(retrieval?.evidence.some(chunk => chunk.queryId === "1102432")).toBe(true);
  });

  it("keeps a Tamil cargo-ship definition attached to its direct MSMARCO-XI evidence", () => {
    const retrieval = retrievalInternals.retrieveHot("சரக்குக் கப்பலின் கீழ்ப்பகுதி என்ன என்று அழைக்கப்படுகிறது?", "ta-IN");

    expect(retrieval?.mode).toBe("local_hot");
    expect(retrieval?.evidence[0]?.queryId).toBe("55665");
  });

  it("keeps a Tamil possessive integrity paraphrase attached to its direct MSMARCO-XI evidence", () => {
    const retrieval = retrievalInternals.retrieveHot("நேர்மையின் பொருள் என்ன?", "ta-IN");

    expect(retrieval?.mode).toBe("local_hot");
    expect(retrieval?.evidence[0]?.queryId).toBe("205107");
  });

  it.each([
    ["hi-IN", "मालवाहक जहाज़ के निचले भाग को क्या कहते हैं?", "55665"],
    ["kn-IN", "ಕಾರ್ಪೊರೇಷನ್ ಯಾವ ಕಾನೂನುಗಳ ಮೂಲಕ ನಿಯಂತ್ರಿತವಾಗುತ್ತದೆ?", "1102432"],
    ["mr-IN", "मालवाहू जहाजाच्या तळाच्या भागाला काय म्हणतात?", "55665"],
  ])("keeps the repaired %s paraphrase attached to direct MSMARCO-XI evidence", (languageCode, query, queryId) => {
    const retrieval = retrievalInternals.retrieveHot(query, languageCode);

    expect(retrieval?.mode).toBe("local_hot");
    expect(retrieval?.evidence[0]?.queryId).toBe(queryId);
  });

  it("adds the aligned companion only after source-linked Hindi evidence passes local retrieval", async () => {
    const retrieval = await hybridRetrieve("कॉर्पोरेशन किन कानूनों के तहत काम करता है?", "hi-IN");

    expect(retrieval.mode).toBe("local_hot");
    expect(retrieval.evidence.some(chunk => chunk.queryId === "1102432" && chunk.language === "hi")).toBe(true);
    expect(retrieval.evidence.some(chunk => chunk.id === "en-companion-1102432")).toBe(true);
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
    ["as-IN", "সৌৰ পেনেল বোৰ কি?"],
    ["ur-IN", "شمسی پینل کیا ہیں؟"],
  ])("serves a representative %s query from the bounded in-process evidence cache", async (languageCode, query) => {
    const retrieval = await hybridRetrieve(query, languageCode);

    expect(retrieval.mode).toBe("local_hot");
    expect(retrieval.evidence.length).toBeGreaterThan(0);
    expect(retrieval.evidence.every(chunk => chunk.language === languageCode.split("-")[0] || chunk.id.startsWith("en-companion-"))).toBe(true);
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

  it("caps live cloud fallback at the internal RAG budget while preserving the shorter benchmark budget", () => {
    expect(retrievalInternals.liveCloudFallbackTimeoutMs).toBe(35);
    expect(retrievalInternals.effectiveCloudTimeoutMs(175)).toBe(35);
    expect(retrievalInternals.effectiveCloudTimeoutMs()).toBe(35);
    expect(retrievalInternals.effectiveCloudTimeoutMs(25)).toBe(25);
  });

  it("reports a healthy full Qdrant collection through a separately bounded metadata probe", async () => {
    process.env.QDRANT_URL = "https://qdrant.example";
    process.env.QDRANT_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: { points_count: 12_650 } }), { status: 200 })));

    const capability = await getIndexCapability();

    expect(retrievalInternals.indexHealthTimeoutMs).toBe(8_000);
    expect(capability).toMatchObject({ health: "READY", points: 12_650, collection: "msmarco_xi_evaluation_v1" });
  });
});
