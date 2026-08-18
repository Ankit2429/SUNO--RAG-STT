import { describe, expect, it } from "vitest";
import { hybridRetrieve } from "./retrieval";

describe("bounded language inventory routing", () => {
  it.each(["en-IN", "kn-IN"])("fails closed locally for unindexed %s evidence instead of calling remote retrieval", async languageCode => {
    const retrieval = await hybridRetrieve("What is a corporation?", languageCode);

    expect(retrieval).toEqual({ evidence: [], scores: new Map(), mode: "cloud" });
  });
});
