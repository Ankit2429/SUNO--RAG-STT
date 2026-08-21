import { readFile, writeFile } from "node:fs/promises";

const telemetryPath = new URL("../docs/evaluation-results/live-60-case-text-eval.json", import.meta.url);
const outputPath = new URL("../docs/evaluation-results/semantic-accuracy-audit-input.json", import.meta.url);

// These concise canonical statements are the direct English companion passages
// paired with the five audited MSMARCO-XI source-query themes in hotCorpus.ts.
// They are evaluation anchors only: SUNO's production path still returns the
// selected cited passage and never calls an LLM to generate an answer.
const canonicalEvidenceBySourceQueryId = {
  "1102432": "A corporation is a legal entity created by incorporation. It is governed by the incorporation laws of the country or state in which it is formed.",
  "1102431": "Rachel Carson wrote The Obligation to Endure to warn about indiscriminate pesticide use and its lasting effects on the environment, wildlife, and people.",
  "90836": "A chart of foods low in potassium identifies food choices and serving sizes that fit a low-potassium diet.",
  "55665": "The lower side of a cargo ship is its bottom or hull; the bilge is the lowest internal area where water can collect.",
  "205107": "Honesty and integrity mean being truthful, reliable, and guided by sound moral principles.",
};

const telemetry = JSON.parse(await readFile(telemetryPath, "utf8"));
const auditInput = telemetry.results
  .filter((result) => result.category === "grounded" && result.observedStatus === "GROUNDED")
  .map((result) => ({
    id: result.id,
    languageCode: result.languageCode,
    question: result.transcript,
    expectedSourceQueryId: result.sourceQueryId,
    citedSourceQueryIds: result.citedQueryIds,
    canonicalSourceEvidence: canonicalEvidenceBySourceQueryId[result.sourceQueryId],
    displayedAnswer: result.answer,
  }));

if (auditInput.length !== 50) {
  throw new Error(`Expected 50 grounded answers in final telemetry, found ${auditInput.length}.`);
}
if (auditInput.some((item) => !item.canonicalSourceEvidence)) {
  throw new Error("A grounded audit item does not have a canonical source-evidence anchor.");
}

await writeFile(outputPath, `${JSON.stringify(auditInput, null, 2)}\n`, "utf8");
console.log(`Prepared ${auditInput.length} multilingual semantic-audit items at ${outputPath.pathname}`);
