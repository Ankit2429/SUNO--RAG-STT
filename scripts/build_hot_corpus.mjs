#!/usr/bin/env node
/**
 * Produce the bounded L1 cache from the reproducible MSMARCO-XI chunk artifact.
 * Two paragraph-level evidence passages per parent query retain broad evaluation
 * coverage while avoiding a cross-region Qdrant round trip on common queries.
 */
import { readFile, writeFile } from "node:fs/promises";

const [source, destination = "server/rag/hotCorpus.ts"] = process.argv.slice(2);
if (!source) throw new Error("Usage: node scripts/build_hot_corpus.mjs <chunks.jsonl> [destination]");

const chunks = (await readFile(source, "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean)
  .map(line => JSON.parse(line));

const selected = [];
const perQuery = new Map();
for (const chunk of chunks) {
  if (chunk.strategy !== "paragraph_section") continue;
  const key = `${chunk.language}:${chunk.queryId}`;
  const count = perQuery.get(key) || 0;
  if (count >= 2) continue;
  perQuery.set(key, count + 1);
  selected.push({
    id: chunk.id,
    text: chunk.text,
    language: chunk.language,
    strategy: chunk.strategy,
    parentId: chunk.parentId,
    queryId: chunk.queryId,
    queryType: chunk.queryType,
    ordinal: chunk.ordinal,
  });
}

const sourceCode = `import type { EvidenceChunk } from "@shared/rag";

/**
 * Generated from the reproducible fourteen-language MSMARCO-XI evaluation artifact.
 * This bounded L1 cache holds two real paragraph passages per source query; Qdrant
 * remains the full engineered L2 index when a local match is insufficient.
 */
export const HOT_CORPUS: EvidenceChunk[] = ${JSON.stringify(selected, null, 2)}.map(chunk => ({
  ...chunk,
  strategy: chunk.strategy as EvidenceChunk["strategy"],
  source: "ai4bharat/MSMARCO-XI" as const,
  selected: false,
  overlap: 0,
}));
`;

await writeFile(destination, sourceCode);
console.log(JSON.stringify({ destination, passages: selected.length, languages: [...new Set(selected.map(chunk => chunk.language))].sort() }));
