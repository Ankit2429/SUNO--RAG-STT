import fs from "node:fs";

const content = fs.readFileSync("server/rag/hotCorpus.ts", "utf8");

// Parse objects using regex
const regex = /{\s*"id":\s*"([^"]+)",\s*"text":\s*"([^"]+)",\s*"language":\s*"([^"]+)",\s*"strategy":\s*"([^"]+)",\s*"parentId":\s*"([^"]+)",\s*"queryId":\s*"([^"]+)"/g;

const chunks = [];
let m;
while ((m = regex.exec(content)) !== null) {
  chunks.push({
    id: m[1],
    text: m[2],
    language: m[3],
    strategy: m[4],
    parentId: m[5],
    queryId: m[6],
  });
}

console.log("Extracted chunks:", chunks.length);

const targetQueryIds = [
  "1102432", // Corporation
  "1102431", // Rachel Carson
  "90836",   // Low sodium low potassium diet
  "55665",   // Ship cargo / bilge
  "205107",  // Honesty / truthfulness
  "1060386", // Atmospheric pressure
  "168868",  // PTSD post-traumatic stress
  "227261",  // World population projection
  "227029",  // NHL conference divisions
  "166290",  // Skin ringworm
];

const results = [];
for (const qid of targetQueryIds) {
  const matching = chunks.filter(c => c.queryId === qid);
  results.push({
    queryId: qid,
    count: matching.length,
    languages: [...new Set(matching.map(c => c.language))],
    samples: matching.slice(0, 3),
  });
}

console.log("Selected 10 items:", JSON.stringify(results, null, 2));
fs.writeFileSync("scripts/selected_10_msmarco.json", JSON.stringify(results, null, 2));
