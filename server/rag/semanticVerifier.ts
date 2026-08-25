import { createHash } from "node:crypto";
import type { EvidenceChunk } from "@shared/rag";

export const SEMANTIC_VERIFIER_PROMPT_VERSION = "v2";

export interface SemanticVerificationResult {
  supported: boolean;
  score: number;
  reason: string;
  verifierUnavailable?: boolean;
  latencyMs: number;
}

export interface SemanticRerankItem {
  chunk: EvidenceChunk;
  originalScore: number;
  normalizedOriginalScore: number;
  semanticScore: number;
  semanticSupported: boolean;
  finalScore: number;
  reason: string;
  verifierUnavailable: boolean;
  latencyMs: number;
}

export interface SemanticRerankResult {
  reranked: EvidenceChunk[];
  scores: Map<string, number>;
  items: SemanticRerankItem[];
  hasGroundedEvidence: boolean;
  totalLatencyMs: number;
}

// In-memory cache for (query + passage) verification results
const VERIFIER_CACHE = new Map<string, Omit<SemanticVerificationResult, "latencyMs">>();

export function clearVerifierCache(): void {
  VERIFIER_CACHE.clear();
}

function getCacheKey(query: string, passage: string): string {
  const normQuery = query.trim().toLocaleLowerCase();
  const normPassage = passage.trim().toLocaleLowerCase();
  return createHash("sha256").update(`${normQuery}:::${normPassage}`).digest("hex");
}

function getOllamaUrl(): string {
  return (process.env.RAG_SEMANTIC_OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
}

function getModel(): string {
  return process.env.RAG_SEMANTIC_MODEL || "qwen2.5:3b";
}

function getTimeoutMs(): number {
  const parsed = Number(process.env.RAG_SEMANTIC_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3500;
}

function isDebugEnabled(): boolean {
  return process.env.RAG_SEMANTIC_DEBUG === "true";
}

function buildPrompt(query: string, passage: string): string {
  return `You are an accurate semantic evidence judge for Question-Answering.
Determine whether the PASSAGE provides valid factual evidence that answers, defines, or explains the QUESTION.

RULES:
1. Return supported=true if the PASSAGE contains the direct answer, definition, explanation, formula, or primary attribute asked about (e.g. definition of concept, area formula for triangle, weight for deer, duration for reporting). A direct concise definition or factual statement is fully sufficient for supported=true.
2. Return supported=false if the PASSAGE is unanswerable because a key negative constraint/modifier is missing or contradicted (e.g. asked for "double driveway" but only single driveway is given; asked "are X Y" but passage clarifies they are distinct; asked "without paying" but passage requires paying; or unrelated keywords).

QUESTION: ${query.trim()}
PASSAGE: ${passage.trim()}

Return ONLY valid JSON:
{
  "supported": boolean,
  "score": number between 0.0 and 1.0,
  "reason": "brief 1-sentence reason"
}`;
}

function buildBatchedPrompt(query: string, passages: { id: string; text: string }[]): string {
  const formatted = passages
    .map((p, i) => `[Passage ${i + 1}] (ID: ${p.id})\n${p.text.trim()}`)
    .join("\n\n");

  return `You are an accurate semantic evidence judge for Question-Answering.
Determine whether each candidate passage provides valid factual evidence that answers, defines, or explains the user question.

RULES:
1. A passage is supported=true if it contains the direct answer, concise definition, explanation, formula, or primary attribute asked about (e.g. definition of concept/organization, area formula for triangle, weight for deer, duration for reporting). A direct concise definition or factual statement is fully sufficient.
2. A passage is supported=false if it is unanswerable because a key negative constraint/modifier is missing or contradicted (e.g. asked for "double driveway" but only single driveway is given; asked "are X Y" but passage clarifies they are distinct; asked "without paying" but passage requires paying; or unrelated keywords).

User Question: "${query.trim()}"

Candidate Passages:
${formatted}

Return ONLY valid JSON matching this schema:
{
  "evaluations": [
    {
      "id": "passage ID",
      "supported": boolean,
      "score": number between 0.0 and 1.0,
      "reason": "brief 1-sentence reason"
    }
  ]
}`;
}

export async function verifySemanticRelevance(
  query: string,
  passage: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<SemanticVerificationResult> {
  const start = performance.now();
  const cacheKey = getCacheKey(query, passage);
  const cached = VERIFIER_CACHE.get(cacheKey);
  if (cached) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      ...cached,
      latencyMs,
    };
  }

  const timeoutMs = options?.timeoutMs ?? getTimeoutMs();
  const url = `${getOllamaUrl()}/api/generate`;
  const model = getModel();
  const prompt = buildPrompt(query, passage);

  try {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.0,
          num_predict: 90,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutTimer));

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    const rawContent = data.response || "{}";
    const parsed = JSON.parse(rawContent) as { supported?: unknown; score?: unknown; reason?: unknown };

    const supported = Boolean(parsed.supported);
    let score = typeof parsed.score === "number" && !Number.isNaN(parsed.score) ? parsed.score : (supported ? 0.9 : 0.0);
    score = Math.max(0, Math.min(1, score));
    if (!supported) {
      score = 0.0;
    }
    const reason = typeof parsed.reason === "string" ? parsed.reason : "No reason provided";

    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const result: SemanticVerificationResult = {
      supported,
      score,
      reason,
      latencyMs,
    };

    VERIFIER_CACHE.set(cacheKey, { supported, score, reason });

    if (isDebugEnabled()) {
      console.log(
        `[SemanticVerifier] query="${query.slice(0, 40)}" supported=${supported} score=${score.toFixed(2)} latencyMs=${latencyMs} reason="${reason}"`
      );
    }

    return result;
  } catch (error) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const reason = error instanceof Error ? error.message : "Verifier failed";
    if (isDebugEnabled()) {
      console.warn(`[SemanticVerifier] unavailable: ${reason} (latencyMs=${latencyMs})`);
    }

    // Fail closed safely: do NOT crash
    return {
      supported: false,
      score: 0.0,
      reason: `Verifier unavailable: ${reason}`,
      verifierUnavailable: true,
      latencyMs,
    };
  }
}

/**
 * Batched candidate verification in a single Ollama prompt.
 */
async function verifyCandidateBatchWithOllama(
  query: string,
  passages: { id: string; text: string }[],
  options?: { timeoutMs?: number }
): Promise<Map<string, { supported: boolean; score: number; reason: string; verifierUnavailable?: boolean }>> {
  const results = new Map<string, { supported: boolean; score: number; reason: string; verifierUnavailable?: boolean }>();
  if (!passages.length) return results;

  // Check cache for each passage first
  const uncached: { id: string; text: string }[] = [];
  for (const p of passages) {
    const key = getCacheKey(query, p.text);
    const cached = VERIFIER_CACHE.get(key);
    if (cached) {
      results.set(p.id, cached);
    } else {
      uncached.push(p);
    }
  }

  if (!uncached.length) {
    return results;
  }

  // If only 1 uncached passage, use single verification
  if (uncached.length === 1) {
    const res = await verifySemanticRelevance(query, uncached[0].text, options);
    results.set(uncached[0].id, res);
    return results;
  }

  const timeoutMs = (options?.timeoutMs ?? getTimeoutMs()) * 1.5;
  const url = `${getOllamaUrl()}/api/generate`;
  const model = getModel();
  const prompt = buildBatchedPrompt(query, uncached);

  try {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.0,
          num_predict: 220,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutTimer));

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    const rawContent = data.response || "{}";
    const parsed = JSON.parse(rawContent) as { evaluations?: Array<{ id?: string; supported?: boolean; score?: number; reason?: string }> };

    const evals = Array.isArray(parsed.evaluations) ? parsed.evaluations : [];

    for (let i = 0; i < uncached.length; i++) {
      const p = uncached[i];
      const e = evals.find(item => item.id === p.id || item.id === `Passage ${i + 1}` || item.id === `${i + 1}` || item.id === `[Passage ${i + 1}]`) ?? evals[i];
      const supported = Boolean(e?.supported);
      let score = typeof e?.score === "number" && !Number.isNaN(e.score) ? e.score : (supported ? 0.9 : 0.0);
      score = Math.max(0, Math.min(1, score));
      if (!supported) score = 0.0;
      const reason = typeof e?.reason === "string" ? e.reason : "Batch evaluation";
      const resObj = { supported, score, reason };
      VERIFIER_CACHE.set(getCacheKey(query, p.text), resObj);
      results.set(p.id, resObj);
    }

    return results;
  } catch (error) {
    if (isDebugEnabled()) {
      console.warn(`[SemanticVerifier] Batch failed, falling back: ${error}`);
    }
    // Fall back to single verifications
    for (const p of uncached) {
      const res = await verifySemanticRelevance(query, p.text, options);
      results.set(p.id, res);
    }
    return results;
  }
}

/**
 * Reranks retrieved candidate chunks by combining their initial retrieval score
 * with Qwen 2.5 3B local semantic verification score.
 */
export async function rerankWithSemanticVerifier(
  query: string,
  evidence: EvidenceChunk[],
  scores: Map<string, number>,
  options?: { topLimit?: number; timeoutMs?: number }
): Promise<SemanticRerankResult> {
  const start = performance.now();
  if (!evidence.length) {
    return { reranked: [], scores: new Map(), items: [], hasGroundedEvidence: false, totalLatencyMs: 0 };
  }

  const limit = Math.min(options?.topLimit ?? 5, evidence.length);
  const targetChunks = evidence.slice(0, limit);
  const remainingChunks = evidence.slice(limit);

  // Determine max original score for normalization
  let maxOrig = 0;
  for (const chunk of evidence) {
    const s = scores.get(chunk.id) ?? 0;
    if (s > maxOrig) maxOrig = s;
  }
  const normBase = maxOrig > 1.0 ? maxOrig : 1.0;

  // Batch verify the top candidates in a single shot
  const batchPassages = targetChunks.map(c => ({ id: c.id, text: c.text }));
  const batchResults = await verifyCandidateBatchWithOllama(query, batchPassages, {
    timeoutMs: options?.timeoutMs,
  });

  const items: SemanticRerankItem[] = [];
  let anySupported = false;
  let allUnavailable = true;

  for (const chunk of targetChunks) {
    const origScore = scores.get(chunk.id) ?? 0;
    const normScore = Math.max(0, Math.min(1, origScore / normBase));
    const verification = batchResults.get(chunk.id) ?? {
      supported: false,
      score: 0.0,
      reason: "Missing verification",
      verifierUnavailable: true,
    };

    if (!verification.verifierUnavailable) {
      allUnavailable = false;
    }
    if (verification.supported) {
      anySupported = true;
    }

    let finalScore: number;
    if (verification.verifierUnavailable) {
      // Fail-closed fallback: preserve existing normalized retrieval score
      finalScore = normScore;
    } else if (verification.supported) {
      // Strong positive boost for semantically verified answering passage
      finalScore = 0.50 * normScore + 0.50 * verification.score;
    } else {
      // Heavily penalize non-answering/irrelevant passage to prevent false confidence
      finalScore = 0.05 * normScore;
    }

    items.push({
      chunk,
      originalScore: origScore,
      normalizedOriginalScore: normScore,
      semanticScore: verification.score,
      semanticSupported: verification.supported,
      finalScore,
      reason: verification.reason,
      verifierUnavailable: Boolean(verification.verifierUnavailable),
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    });
  }

  // Add any remaining chunks beyond top limit with discounted baseline score
  for (const chunk of remainingChunks) {
    const origScore = scores.get(chunk.id) ?? 0;
    const normScore = Math.max(0, Math.min(1, origScore / normBase));
    items.push({
      chunk,
      originalScore: origScore,
      normalizedOriginalScore: normScore,
      semanticScore: 0,
      semanticSupported: false,
      finalScore: anySupported ? 0.05 * normScore : 0.20 * normScore,
      reason: "Bypassed verifier limit",
      verifierUnavailable: false,
      latencyMs: 0,
    });
  }

  // Sort candidates by final score descending
  items.sort((a, b) => {
    if (a.semanticSupported !== b.semanticSupported && !a.verifierUnavailable && !b.verifierUnavailable) {
      return a.semanticSupported ? -1 : 1;
    }
    return b.finalScore - a.finalScore;
  });

  const reranked = items.map(item => item.chunk);
  const combinedScores = new Map<string, number>();
  for (const item of items) {
    combinedScores.set(item.chunk.id, item.finalScore);
  }

  const hasGroundedEvidence = allUnavailable ? true : anySupported;
  const totalLatencyMs = Math.round((performance.now() - start) * 100) / 100;

  return {
    reranked,
    scores: combinedScores,
    items,
    hasGroundedEvidence,
    totalLatencyMs,
  };
}
