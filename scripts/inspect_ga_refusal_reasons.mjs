import fs from "fs";

const data = JSON.parse(fs.readFileSync("docs/benchmark-results/in-process-100-eval.json", "utf-8"));

console.log("=== GROUP A REFUSALS DIAGNOSTIC ===");
for (const r of data.resultsA) {
  if (r.isRefused) {
    console.log(`[${r.id}] qid:${r.qid} lang:${r.lang}`);
    console.log(`  Query: "${r.question}"`);
    console.log(`  RefusalReason: ${r.refusalReason}`);
    console.log("------------------------------------------");
  }
}
