import { describe, expect, it } from "vitest";
import { EVALUATION_MANIFEST } from "@shared/evaluationManifest";
import { hybridRetrieve } from "./retrieval";

describe("bounded language inventory routing", () => {
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
    ["kn-IN", "ಕಾರ್ಪೊರೇಷನ್ ಎಂದರೇನು?"],
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
});
