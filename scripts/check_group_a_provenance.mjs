import fs from "fs";

const data = JSON.parse(fs.readFileSync("docs/benchmark-results/in-process-100-eval.json", "utf-8"));

console.log("=== GROUP A PROVENANCE DIAGNOSTIC ===");
for (const r of data.resultsA) {
  console.log(`[${r.id}] qid:${r.qid} lang:${r.lang}`);
  console.log(`  Query: "${r.question}"`);
  console.log(`  Status: ${r.status} | ProvMatch: ${r.provenanceMatch} | isCorrect: ${r.isCorrect}`);
  console.log(`  EvidenceIds: [${r.evidenceIds.join(", ")}]`);
  console.log("");
}
