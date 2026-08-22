import fs from "node:fs";

const content = fs.readFileSync("server/rag/hotCorpus.ts", "utf8");

const queryIds = [
  "1102432", "1102431", "90836", "55665", "205107",
  "1060386", "1090356", "168868", "300122", "290643",
  "197590", "265552", "227261", "227029", "166290"
];

for (const qid of queryIds) {
  const reg = new RegExp(`"text":\\s*"([^"]+)",\\s*"language":\\s*"en"[^}]*"queryId":\\s*"${qid}"`, "g");
  const match = reg.exec(content);
  if (match) {
    console.log(`\n=== queryId: ${qid} (EN) ===`);
    console.log(match[1]);
  } else {
    // Check Hindi or Assamese if EN snippet is not in hotCorpus for that qid
    const regAny = new RegExp(`"text":\\s*"([^"]+)",\\s*"language":\\s*"([^"]+)"[^}]*"queryId":\\s*"${qid}"`, "g");
    const m = regAny.exec(content);
    if (m) {
      console.log(`\n=== queryId: ${qid} (${m[2]}) ===`);
      console.log(m[1].slice(0, 150));
    }
  }
}
