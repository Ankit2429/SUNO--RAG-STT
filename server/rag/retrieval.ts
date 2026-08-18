import type { EvidenceChunk } from "@shared/rag";
import { EVALUATION_MANIFEST } from "@shared/evaluationManifest";
import { DENSE_VECTOR_NAME, embedText, lexicalScore, lexicalTerms, ZERO_COST_EMBEDDING_MODEL } from "./embedding";
import { generationMode } from "./generation";
import { HOT_CORPUS } from "./hotCorpus";

type QdrantPoint = { id: string | number; score?: number; payload?: Record<string, unknown> };
export type RetrievalResult = { evidence: EvidenceChunk[]; scores: Map<string, number>; mode: "cloud" | "unavailable" };

const COLLECTION = process.env.QDRANT_COLLECTION || "msmarco_xi_evaluation_v1";
const EMBEDDING_MODEL = process.env.QDRANT_EMBEDDING_MODEL || ZERO_COST_EMBEDDING_MODEL;
const INDEXED_LANGUAGE_CODES = new Set(EVALUATION_MANIFEST.languages);
const HOT_VECTORS = new Map(HOT_CORPUS.map(chunk => [chunk.id, embedText(chunk.text)]));

function configuredUrl(): string | null {
  const value = process.env.QDRANT_URL?.replace(/\/$/, "");
  if (!value || /localhost|127\.0\.0\.1/i.test(value)) return null;
  return value;
}

async function qdrant(path: string, body: unknown): Promise<QdrantPoint[]> {
  const base = configuredUrl();
  const key = process.env.QDRANT_API_KEY;
  if (!base || !key) throw new Error("Qdrant Cloud is not configured.");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error(`Qdrant retrieval returned ${response.status}.`);
  const result = await response.json() as { result?: { points?: QdrantPoint[] } | QdrantPoint[] };
  return Array.isArray(result.result) ? result.result : result.result?.points || [];
}

function asEvidence(point: QdrantPoint): EvidenceChunk | null {
  const payload = point.payload || {};
  if (typeof payload.text !== "string" || typeof payload.language !== "string" || typeof payload.strategy !== "string") return null;
  return {
    id: String(point.id),
    text: payload.text,
    language: payload.language,
    source: "ai4bharat/MSMARCO-XI",
    strategy: payload.strategy as EvidenceChunk["strategy"],
    parentId: String(payload.parentId || point.id),
    queryId: String(payload.queryId || "unknown"),
    queryType: String(payload.queryType || "unknown"),
    ordinal: Number(payload.ordinal || 0),
    selected: Boolean(payload.selected),
    overlap: Number(payload.overlap || 0),
  };
}

function reciprocalRankFuse(groups: QdrantPoint[][]): Map<string, number> {
  const scores = new Map<string, number>();
  groups.forEach(group => group.forEach((point, index) => {
    const id = String(point.id);
    scores.set(id, (scores.get(id) || 0) + 60 / (60 + index + 1));
  }));
  return scores;
}

function cosine(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);
}

function retrieveHot(query: string, language: string): RetrievalResult | null {
  const scoped = HOT_CORPUS.filter(chunk => !language || language === "unknown" || chunk.language === language.split("-")[0]);
  if (!scoped.length) return null;
  const terms = lexicalTerms(query);
  const queryVector = embedText(query);
  const ranked = scoped
    .map(chunk => {
      const lexical = terms.length ? lexicalScore(chunk.text, terms) / terms.length : 0;
      const dense = Math.max(0, cosine(queryVector, HOT_VECTORS.get(chunk.id) || []));
      return { chunk, score: dense + lexical };
    })
    .filter(item => item.score > 0.1)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
  if (!ranked.length) return null;
  return { evidence: ranked.map(item => item.chunk), scores: new Map(ranked.map(item => [item.chunk.id, item.score])), mode: "cloud" };
}

export async function hybridRetrieve(query: string, language: string): Promise<RetrievalResult> {
  const hot = retrieveHot(query, language);
  if (hot) return hot;
  const requestedLanguage = language?.split("-")[0];
  if (requestedLanguage && requestedLanguage !== "unknown" && !INDEXED_LANGUAGE_CODES.has(requestedLanguage)) {
    // The bounded evaluation collection has no evidence in this locale. Returning
    // empty candidates lets the evidence gate issue a truthful refusal instead of
    // spending seconds on a known-empty strict-mode Qdrant filter request.
    return { evidence: [], scores: new Map(), mode: "cloud" };
  }
  if (!configuredUrl() || !process.env.QDRANT_API_KEY) return { evidence: [], scores: new Map(), mode: "unavailable" };
  const languageFilter = language && language !== "unknown" ? { key: "language", match: { value: language.split("-")[0] } } : null;
  const evaluationOnlyFilter = { key: "strategy", match: { value: "query_linked_evaluation" } };
  const terms = lexicalTerms(query);
  const semantic = qdrant(`/collections/${COLLECTION}/points/query`, {
    query: embedText(query), using: DENSE_VECTOR_NAME, limit: 12, with_payload: true, with_vector: false,
    filter: { must: languageFilter ? [languageFilter] : [], must_not: [evaluationOnlyFilter] },
  });
  const lexical = qdrant(`/collections/${COLLECTION}/points/scroll`, {
    limit: 96, with_payload: true, with_vector: false,
    filter: { must: [...(languageFilter ? [languageFilter] : [])], must_not: [evaluationOnlyFilter], ...(terms.length ? { should: terms.map(term => ({ key: "text", match: { text: term } })) } : {}) },
  });
  let semanticPoints: QdrantPoint[];
  let lexicalPoints: QdrantPoint[];
  try {
    [semanticPoints, lexicalPoints] = await Promise.all([semantic, lexical]);
  } catch {
    // Network turbulence must never crash the evaluator. An empty candidate set
    // moves through the existing evidence gate as a truthful refusal.
    return { evidence: [], scores: new Map(), mode: "cloud" };
  }
  lexicalPoints.sort((left, right) => lexicalScore(String(right.payload?.text || ""), terms) - lexicalScore(String(left.payload?.text || ""), terms));
  const scores = reciprocalRankFuse([semanticPoints, lexicalPoints]);
  const seenParents = new Set<string>();
  const evidence = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => [...semanticPoints, ...lexicalPoints].find(point => String(point.id) === id))
    .filter((point): point is QdrantPoint => Boolean(point))
    .map(asEvidence)
    .filter((chunk): chunk is EvidenceChunk => Boolean(chunk))
    .filter(chunk => {
      if (seenParents.has(chunk.parentId)) return false;
      seenParents.add(chunk.parentId);
      return true;
    })
    .slice(0, 6);
  return { evidence, scores, mode: "cloud" };
}

export async function getIndexCapability() {
  const base = configuredUrl();
  const key = process.env.QDRANT_API_KEY;
  const baseStatus = {
    configured: Boolean(base && key),
    collection: COLLECTION,
    embeddingModel: EMBEDDING_MODEL,
    generationMode: generationMode(),
    mode: `Two-tier: ${HOT_CORPUS.length}-passage in-process L1 Unicode dense + lexical cache; Qdrant Cloud L2 stores the full five-strategy index`,
  };
  if (!base || !key) return { ...baseStatus, health: "UNCONFIGURED" as const, points: 0 };
  try {
    const response = await fetch(`${base}/collections/${COLLECTION}`, { headers: { "api-key": key }, signal: AbortSignal.timeout(2_000) });
    if (response.status === 404) return { ...baseStatus, health: "MISSING" as const, points: 0 };
    if (!response.ok) return { ...baseStatus, health: "ERROR" as const, points: 0 };
    const payload = await response.json() as { result?: { points_count?: number } };
    const points = Number(payload.result?.points_count || 0);
    return { ...baseStatus, health: points > 0 ? "READY" as const : "EMPTY" as const, points };
  } catch {
    return { ...baseStatus, health: "ERROR" as const, points: 0 };
  }
}
