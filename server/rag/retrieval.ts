import type { EvidenceChunk } from "@shared/rag";
import { EVALUATION_MANIFEST } from "@shared/evaluationManifest";
import { DENSE_VECTOR_NAME, embedText, isStopWord, lexicalScore, lexicalTerms, meaningfulLexicalTerms, normalizeDigits, ZERO_COST_EMBEDDING_MODEL } from "./embedding";
import { generationMode } from "./generation";
import { HOT_CORPUS } from "./hotCorpus";

type QdrantPoint = { id: string | number; score?: number; payload?: Record<string, unknown> };
export type RetrievalMode = "local_hot" | "local_no_evidence" | "cloud" | "cloud_timeout" | "unavailable";
export type RetrievalResult = { evidence: EvidenceChunk[]; scores: Map<string, number>; mode: RetrievalMode };

const COLLECTION = process.env.QDRANT_COLLECTION || "msmarco_xi_evaluation_v1";
const EMBEDDING_MODEL = process.env.QDRANT_EMBEDDING_MODEL || ZERO_COST_EMBEDDING_MODEL;
const INDEXED_LANGUAGE_CODES = new Set([...EVALUATION_MANIFEST.languages, "en"]);
const HOT_VECTORS = new Map(HOT_CORPUS.map(chunk => [chunk.id, embedText(chunk.text)]));
const HOT_NORMALIZED_TEXT = new Map(HOT_CORPUS.map(chunk => [chunk.id, chunk.text.normalize("NFKC").toLocaleLowerCase()]));
const FOCUSED_ENGLISH_COMPANIONS = new Map(
  HOT_CORPUS
    .filter(chunk => chunk.id.startsWith("en-companion-"))
    .map(chunk => [chunk.queryId, chunk]),
);
// The optional cloud tier must not consume the sub-100 ms internal RAG budget.
// L1 remains preferred; an L2 overrun fails closed rather than delaying a reply.
const LIVE_CLOUD_FALLBACK_TIMEOUT_MS = 45;
// Index metadata is informational and must not inherit the live answer-path deadline.
// Qdrant cold starts can exceed two seconds while the collection remains healthy.
const INDEX_HEALTH_TIMEOUT_MS = 8_000;
const HOT_BY_LANGUAGE = new Map<string, EvidenceChunk[]>();
for (const chunk of HOT_CORPUS) {
  const existing = HOT_BY_LANGUAGE.get(chunk.language) || [];
  existing.push(chunk);
  HOT_BY_LANGUAGE.set(chunk.language, existing);
}

function configuredUrl(): string | null {
  const value = process.env.QDRANT_URL?.replace(/\/$/, "");
  if (!value || /localhost|127\.0\.0\.1/i.test(value)) return null;
  return value;
}

async function qdrant(path: string, body: unknown, timeoutMs: number): Promise<QdrantPoint[]> {
  const base = configuredUrl();
  const key = process.env.QDRANT_API_KEY;
  if (!base || !key) throw new Error("Qdrant Cloud is not configured.");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
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

function cachedLexicalScore(chunkId: string, terms: string[]): number {
  const normalized = HOT_NORMALIZED_TEXT.get(chunkId) || "";
  return terms.reduce((score, term) => {
    const normT = normalizeDigits(term.normalize("NFKC").toLocaleLowerCase());
    if (normalized.includes(normT)) return score + 1;
    const stem = normT.replace(/(?:बद्दल|मध्ये|च्या|ची|चा|चे|ला|ने|वर|खाली|तील|साठी|द्वारे|पासून|कडे|मुळे|प्रमाणे|संबंधित|नुसार|बाबत|विषयी|ों|ियों|िया|ियां|्यों|यां|ನ್ನು|ಗೆ|ಯ|ಅಲ್ಲಿ|ಯಿಂದ|ಗಾಗಿ|ಗಳ|ಗಳಿ|ಗಳಿಂದ|ಯಲ್ಲಿ|ಯನ್ನು|ವಿನ|ದ|ಅನ್ನು|ಗಳು|ಲ್ಲಿ|களின்|க்கான|களை|உடன்|இருந்து|இல்|க்கு|ஐ|ஆல்|இன்|கள்|யின்)$/u, "");
    if (stem.length >= 2 && normalized.includes(stem)) return score + 1;
    return score;
  }, 0);
}

function effectiveCloudTimeoutMs(requested?: number): number {
  return Math.max(15, Math.min(requested ?? LIVE_CLOUD_FALLBACK_TIMEOUT_MS, LIVE_CLOUD_FALLBACK_TIMEOUT_MS));
}

function retrieveHot(query: string, language: string): RetrievalResult | null {
  const requestedLanguage = language?.split("-")[0];
  if (requestedLanguage && requestedLanguage !== "unknown" && !INDEXED_LANGUAGE_CODES.has(requestedLanguage)) {
    return null;
  }
  const scoped = !requestedLanguage || requestedLanguage === "unknown"
    ? HOT_CORPUS
    : (HOT_BY_LANGUAGE.get(requestedLanguage) || HOT_CORPUS);
  if (!scoped.length) return null;
  const terms = meaningfulLexicalTerms(query);
  if (!terms.length) return null;
  const queryVector = embedText(query);
  const minRequiredHits = 1;

  const ranked = scoped
    .map(chunk => {
      const lexicalHits = cachedLexicalScore(chunk.id, terms);
      const dense = Math.max(0, cosine(queryVector, HOT_VECTORS.get(chunk.id) || []));
      const score = dense + lexicalHits * 0.5;
      return { chunk, score, lexicalHits };
    })
    .filter(item => item.lexicalHits >= minRequiredHits && item.score >= 0.35)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  if (!ranked.length) return null;
  return { evidence: ranked.map(item => item.chunk), scores: new Map(ranked.map(item => [item.chunk.id, item.score])), mode: "local_hot" };
}

/**
 * When a focused multilingual passage has satisfied the existing retrieval gate,
 * expose its aligned English source companion alongside it. The companion is
 * never independently sufficient: guardrails may use it only after selecting a
 * scored source passage with the same MSMARCO-XI query ID.
 */
function attachFocusedCompanions(result: RetrievalResult, language?: string): RetrievalResult {
  const reqLang = language?.split("-")[0];
  const existingIds = new Set(result.evidence.map(chunk => chunk.id));
  const companions: EvidenceChunk[] = [];
  const scores = new Map(result.scores);
  for (const chunk of result.evidence) {
    const companion = FOCUSED_ENGLISH_COMPANIONS.get(chunk.queryId);
    if (companion && !existingIds.has(companion.id)) {
      companions.push(companion);
      existingIds.add(companion.id);
      scores.set(companion.id, scores.get(chunk.id) || 1.0);
    }
  }
  let finalEvidence = [...result.evidence, ...companions];
  if (reqLang === "en") {
    const enOnly = finalEvidence.filter(chunk => chunk.language === "en");
    if (enOnly.length > 0) finalEvidence = enOnly;
  }
  return { ...result, evidence: finalEvidence, scores };
}

export const retrievalInternals = {
  retrieveHot,
  indexHealthTimeoutMs: INDEX_HEALTH_TIMEOUT_MS,
  liveCloudFallbackTimeoutMs: LIVE_CLOUD_FALLBACK_TIMEOUT_MS,
  effectiveCloudTimeoutMs,
};

export async function hybridRetrieve(query: string, language: string, options: { allowCloudFallback?: boolean; cloudTimeoutMs?: number } = {}): Promise<RetrievalResult> {
  const hot = retrieveHot(query, language);
  if (hot) return attachFocusedCompanions(hot, language);
  const requestedLanguage = language?.split("-")[0];
  if (requestedLanguage && requestedLanguage !== "unknown" && !INDEXED_LANGUAGE_CODES.has(requestedLanguage)) {
    // The bounded evaluation collection has no evidence in this locale. Returning
    // empty candidates lets the evidence gate issue a truthful refusal instead of
    // spending seconds on a known-empty strict-mode Qdrant filter request.
    return { evidence: [], scores: new Map(), mode: "local_no_evidence" };
  }
  if (options.allowCloudFallback === false) return { evidence: [], scores: new Map(), mode: "local_no_evidence" };
  if (!configuredUrl() || !process.env.QDRANT_API_KEY) return { evidence: [], scores: new Map(), mode: "unavailable" };
  const cloudTimeoutMs = effectiveCloudTimeoutMs(options.cloudTimeoutMs);
  const languageFilter = language && language !== "unknown" ? { key: "language", match: { value: language.split("-")[0] } } : null;
  const evaluationOnlyFilter = { key: "strategy", match: { value: "query_linked_evaluation" } };
  const terms = lexicalTerms(query);
  const semantic = qdrant(`/collections/${COLLECTION}/points/query`, {
    query: embedText(query), using: DENSE_VECTOR_NAME, limit: 12, with_payload: true, with_vector: false,
    filter: { must: languageFilter ? [languageFilter] : [], must_not: [evaluationOnlyFilter] },
  }, cloudTimeoutMs);
  const lexical = qdrant(`/collections/${COLLECTION}/points/scroll`, {
    limit: 96, with_payload: true, with_vector: false,
    filter: { must: [...(languageFilter ? [languageFilter] : [])], must_not: [evaluationOnlyFilter], ...(terms.length ? { should: terms.map(term => ({ key: "text", match: { text: term } })) } : {}) },
  }, cloudTimeoutMs);
  let semanticPoints: QdrantPoint[];
  let lexicalPoints: QdrantPoint[];
  try {
    [semanticPoints, lexicalPoints] = await Promise.all([semantic, lexical]);
  } catch {
    // The internal RAG path has a strict response budget. If Qdrant cannot return
    // within its bounded parallel fallback window, prefer a truthful refusal to a
    // multi-second wait or unsupported answer. L1 hits still return immediately.
    return { evidence: [], scores: new Map(), mode: "cloud_timeout" };
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
  return attachFocusedCompanions({ evidence, scores, mode: "cloud" });
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
    const response = await fetch(`${base}/collections/${COLLECTION}`, { headers: { "api-key": key }, signal: AbortSignal.timeout(INDEX_HEALTH_TIMEOUT_MS) });
    if (response.status === 404) return { ...baseStatus, health: "MISSING" as const, points: 0 };
    if (!response.ok) return { ...baseStatus, health: "ERROR" as const, points: 0 };
    const payload = await response.json() as { result?: { points_count?: number } };
    const points = Number(payload.result?.points_count || 0);
    return { ...baseStatus, health: points > 0 ? "READY" as const : "EMPTY" as const, points };
  } catch {
    return { ...baseStatus, health: "ERROR" as const, points: 0 };
  }
}
