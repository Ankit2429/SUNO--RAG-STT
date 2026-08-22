import fs from "node:fs";

const content = fs.readFileSync("server/rag/hotCorpus.ts", "utf8");
const matches = [...content.matchAll(/"queryId":\s*"(\d+)"/g)];
const ids = [...new Set(matches.map(m => m[1]))];
console.log("Total unique queryIds:", ids.length);
console.log("Sample queryIds:", ids.slice(0, 20));

// Extract snippets per queryId
const items = [];
for (const id of ids) {
  const reg = new RegExp(`"text":\\s*"([^"]+)",\\s*"language":\\s*"([^"]+)",[^}]*"queryId":\\s*"${id}"`, "g");
  const m = reg.exec(content);
  if (m) {
    items.push({ queryId: id, language: m[2], snippet: m[1].slice(0, 100) });
  }
}
console.log("\nSample Items:", JSON.stringify(items.slice(0, 15), null, 2));
