import fs from "fs";

const data = JSON.parse(fs.readFileSync("docs/benchmark-results/in-process-100-eval.json", "utf-8"));

console.log("=== GROUP A FAILURES ===");
for (const r of data.resultsA) {
  if (!r.isCorrect) {
    console.log(`[${r.id}] qid:${r.qid} lang:${r.lang}`);
    console.log(`  Query: "${r.question}"`);
    console.log(`  Status: ${r.status} | ProvMatch: ${r.provenanceMatch}`);
    console.log(`  Answer: "${r.answer?.slice(0, 100)}"`);
    console.log(`  Evidence: [${r.evidenceIds.join(", ")}]`);
    console.log("");
  }
}

console.log("=== GROUP B FALSE CITATIONS ===");
for (const r of data.resultsB) {
  if (r.isFalseCitation) {
    console.log(`[${r.id}] lang:${r.lang}`);
    console.log(`  Query: "${r.question}"`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Answer: "${r.answer?.slice(0, 100)}"`);
    console.log(`  Evidence: [${r.evidenceIds.join(", ")}]`);
    console.log("");
  }
}
