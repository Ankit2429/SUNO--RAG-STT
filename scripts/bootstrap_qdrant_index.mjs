#!/usr/bin/env node
/** Build a small real-data Qdrant index from the bounded ingestion artifact.
 * This uses deterministic Unicode n-gram dense vectors, so the default profile
 * never calls a paid embedding endpoint. Run only during offline indexing.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = process.argv[2];
const url = (process.env.QDRANT_URL || "").replace(/\/$/, "");
const key = process.env.QDRANT_API_KEY;
const collection = process.env.QDRANT_COLLECTION || "msmarco_xi_evaluation_v1";
const dimensions = 384;
if (!source || !url || !key || /localhost|127\.0\.0\.1/i.test(url)) throw new Error("Usage: QDRANT_URL and QDRANT_API_KEY plus a chunks.jsonl path are required.");

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
function pointId(chunkId) {
  const hex = createHash("sha256").update(chunkId).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function embed(text) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const add = (feature, weight) => { const value = hash(feature); vector[value % dimensions] += (value & 1 ? 1 : -1) * weight; };
  const normalized = text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
  for (const token of normalized.split(" ").filter(Boolean)) add(`token:${token}`, 2.4);
  const chars = Array.from(normalized.replace(/\s/g, ""));
  for (let index = 0; index < chars.length; index += 1) {
    add(`char1:${chars[index]}`, 0.4);
    if (index + 1 < chars.length) add(`char2:${chars.slice(index, index + 2).join("")}`, 1);
    if (index + 2 < chars.length) add(`char3:${chars.slice(index, index + 3).join("")}`, 1.25);
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map(value => value / magnitude) : vector;
}
async function request(path, options = {}, acceptedStatuses = []) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { "api-key": key, "content-type": "application/json", ...(options.headers || {}) } });
  if (!response.ok && response.status !== 409 && !acceptedStatuses.includes(response.status)) throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  return response;
}
const chunks = (await readFile(source, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
const existing = await request(`/collections/${collection}`, { method: "GET" }, [404]);
if (existing.status === 404) await request(`/collections/${collection}`, { method: "PUT", body: JSON.stringify({ vectors: { dense_vector: { size: dimensions, distance: "Cosine" } } }) });
await request(`/collections/${collection}/index`, { method: "PUT", body: JSON.stringify({ field_name: "text", field_schema: "text" }) });
for (let offset = 0; offset < chunks.length; offset += 48) {
  const batch = chunks.slice(offset, offset + 48).map(chunk => ({ id: pointId(chunk.id), vector: { dense_vector: embed(chunk.text) }, payload: { ...chunk, chunkId: chunk.id } }));
  await request(`/collections/${collection}/points?wait=true`, { method: "PUT", body: JSON.stringify({ points: batch }) });
}
const final = await request(`/collections/${collection}`, { method: "GET" });
const summary = await final.json();
console.log(JSON.stringify({ collection, inserted: chunks.length, points: summary.result?.points_count ?? null, embeddingModel: "multilingual-unicode-ngram-dense-v1" }));
