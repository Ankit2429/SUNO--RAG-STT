import fs from "node:fs";

const exclusionSet = new Set();

// 1. Read hotCorpus.ts queryIds
const hotContent = fs.readFileSync("server/rag/hotCorpus.ts", "utf8");
const hotIds = [...hotContent.matchAll(/"queryId":\s*"(\d+)"/g)].map(m => m[1]);
hotIds.forEach(id => exclusionSet.add(id));

// 2. Read benchmark.ts queries
const benchContent = fs.readFileSync("server/rag/benchmark.ts", "utf8");
const benchMatches = [...benchContent.matchAll(/"query":\s*"([^"]+)"/g)].map(m => m[1]);
benchMatches.forEach(q => exclusionSet.add(q.toLowerCase()));

// 3. Read previous live test scripts
const scriptsDir = "scripts";
const files = fs.readdirSync(scriptsDir);
for (const file of files) {
  if (file.endsWith(".mjs") || file.endsWith(".json")) {
    const text = fs.readFileSync(`${scriptsDir}/${file}`, "utf8");
    const m = [...text.matchAll(/"queryId":\s*"(\d+)"/g)].map(x => x[1]);
    m.forEach(id => exclusionSet.add(id));
  }
}

console.log("Total excluded query IDs & terms:", exclusionSet.size);

fs.writeFileSync("scripts/exclusion_set.json", JSON.stringify(Array.from(exclusionSet), null, 2));
