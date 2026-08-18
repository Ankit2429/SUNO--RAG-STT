import { describe, expect, it } from "vitest";
import { resolveEvidencePath } from "./evidencePath";

describe("resolveEvidencePath", () => {
  it("labels a real local cache hit without suggesting that evidence was generated", () => {
    const result = resolveEvidencePath([{ stage: "parallel_retrieve", status: "OK", durationMs: 1, detail: "Real MSMARCO-XI evidence retrieved from the in-process L1 language cache; remote vector search skipped." }]);
    expect(result).toMatchObject({ kind: "local_hot", label: "L1 LOCAL EVIDENCE", tone: "green" });
  });

  it("labels an evidence refusal as no-supporting-evidence rather than an answer path", () => {
    const result = resolveEvidencePath([{ stage: "parallel_retrieve", status: "OK", durationMs: 0, detail: "No bounded MSMARCO-XI evidence is available for this locale or query; remote retrieval skipped for a truthful refusal." }]);
    expect(result).toMatchObject({ kind: "no_evidence", tone: "orange" });
  });
});
