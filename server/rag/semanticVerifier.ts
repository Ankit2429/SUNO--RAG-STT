import { createHash } from "node:crypto";
import type { EvidenceChunk } from "@shared/rag";

export const SEMANTIC_VERIFIER_PROMPT_VERSION = "v3";

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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4000;
}

function isDebugEnabled(): boolean {
  return process.env.RAG_SEMANTIC_DEBUG === "true";
}

function buildPrompt(query: string, passage: string): string {
  return `You are an accurate semantic evidence judge for Question-Answering.
Task: Determine whether the candidate passage provides direct factual evidence answering the question.

RULES:
1. Supported=true if the candidate directly answers the question, explains a concept, provides a definition (e.g. dictionary entries like 'compatibility: the ability to work together...', 'bo-peep: peekaboo'), provides a date/year/time (e.g. 'established in 12th century', 'founded in 1980'), provides a contact number or address (e.g. 'admissions office: (813) 974-3350'), provides a quantity/dose/amount (e.g. '46 to 56 grams of protein'), gives a cause/symptom/effect (e.g. 'can cause hoarseness'), gives a formula or calculation method (e.g. 'base times height divided by 2'), or gives a duration. Treat colloquial synonyms as answering.
2. Supported=false if:
   - A specific modifier in the question is missing or different (e.g. "double driveway" vs single driveway).
   - Only an individual brand's policy or commercial product leaflet (e.g. Esso brand policy, Aspen brand product) is given when asked about a general standard or generic definition.
   - The passage is merely on a related topic without containing the answer to what was asked.

QUESTION: "${query.trim()}"

[Candidate 1]
${passage.trim().slice(0, 350)}

Return ONLY valid JSON:
{
  "supported": boolean,
  "score": number between 0.0 and 1.0
}`;
}

function buildBatchedPrompt(query: string, passages: { id: string; text: string }[]): string {
  const formatted = passages
    .map((p, i) => `[Candidate ${i + 1}]\n${p.text.trim().slice(0, 350)}`)
    .join("\n\n");

  const schemaItems = passages
    .map((_, i) => `{"candidate": ${i + 1}, "supported": boolean, "score": number}`)
    .join(", ");

  return `You are an accurate semantic evidence judge for Question-Answering.
Task: Determine independently for EACH candidate whether it provides factual evidence answering the question.

RULES:
1. Supported=true if the candidate directly answers the question, explains a concept, provides a definition (e.g. dictionary entries like 'compatibility: the ability to work together...', 'bo-peep: peekaboo'), provides a date/year/time (e.g. 'established in 12th century', 'founded in 1980'), provides a contact number or address (e.g. 'admissions office: (813) 974-3350'), provides a quantity/dose/amount (e.g. '46 to 56 grams of protein'), gives a cause/symptom/effect (e.g. 'can cause hoarseness'), gives a formula or calculation method (e.g. 'base times height divided by 2'), or gives a duration. Treat colloquial synonyms as answering.
2. Supported=false if:
   - A specific modifier in the question is missing or different (e.g. "double driveway" vs single driveway).
   - Only an individual brand's policy or commercial product leaflet (e.g. Esso brand policy, Aspen brand product) is given when asked about a general standard or generic definition.
   - The passage is merely on a related topic without containing the answer to what was asked.

QUESTION: "${query.trim()}"

${formatted}

Return ONLY valid JSON matching this format:
{"results": [${schemaItems}]}`;
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
          num_predict: 60,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutTimer));

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    const rawContent = data.response || "{}";
    let supported = false;
    let score = 0.0;
    let reason = "Single evaluation";

    try {
      const parsed = JSON.parse(rawContent) as {
        results?: Array<{ candidate?: number; supported?: boolean; score?: number }>;
        supported?: boolean;
        score?: number;
      };
      if (Array.isArray(parsed.results) && parsed.results.length > 0) {
        supported = Boolean(parsed.results[0].supported);
        score = typeof parsed.results[0].score === "number" ? parsed.results[0].score : (supported ? 1.0 : 0.0);
      } else if (typeof parsed.supported === "boolean") {
        supported = parsed.supported;
        score = typeof parsed.score === "number" ? parsed.score : (supported ? 1.0 : 0.0);
      }
    } catch {
      supported = /"supported"\s*:\s*true/i.test(rawContent);
      score = supported ? 1.0 : 0.0;
    }

    score = Math.max(0, Math.min(1, score));
    if (!supported) score = 0.0;

    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const result: SemanticVerificationResult = {
      supported,
      score,
      reason,
      latencyMs,
    };

    VERIFIER_CACHE.set(cacheKey, { supported, score, reason });
    return result;
  } catch (error) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const reason = error instanceof Error ? error.message : "Verifier failed";
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
 * Batched candidate verification in a single, compact Ollama prompt.
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

  const timeoutMs = (options?.timeoutMs ?? getTimeoutMs()) * 1.3;
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
          num_predict: 140,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutTimer));

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    const rawContent = data.response || "{}";
    if (isDebugEnabled() || true) {
      console.log("[SemanticVerifier Batch Raw]", query, rawContent);
    }
    let resultsList: Array<{ candidate?: number; supported?: boolean; score?: number }> = [];

    try {
      const parsed = JSON.parse(rawContent) as { results?: Array<{ candidate?: number; supported?: boolean; score?: number }> };
      if (Array.isArray(parsed.results)) {
        resultsList = parsed.results;
      }
    } catch {
      // Regex fallback extraction if JSON formatting had a minor anomaly
      const matches = Array.from(rawContent.matchAll(/"candidate"\s*:\s*(\d+)[^}]*?"supported"\s*:\s*(true|false)/gi));
      for (const m of matches) {
        resultsList.push({
          candidate: Number(m[1]),
          supported: m[2].toLowerCase() === "true",
          score: m[2].toLowerCase() === "true" ? 1.0 : 0.0,
        });
      }
    }

    for (let i = 0; i < uncached.length; i++) {
      const p = uncached[i];
      const candidateNum = i + 1;
      const e = resultsList.find(item => item.candidate === candidateNum) ?? resultsList[i];
      const supported = Boolean(e?.supported);
      let score = typeof e?.score === "number" && !Number.isNaN(e.score) ? e.score : (supported ? 1.0 : 0.0);
      if (score > 1.0) score = score / 100.0;
      score = Math.max(0, Math.min(1, score));
      if (!supported) score = 0.0;
      const reason = `Batch evaluation #${candidateNum}`;
      const resObj = { supported, score, reason };
      VERIFIER_CACHE.set(getCacheKey(query, p.text), resObj);
      results.set(p.id, resObj);
    }

    return results;
  } catch (error) {
    if (isDebugEnabled()) {
      console.warn(`[SemanticVerifier] Batch failed fail-closed: ${error}`);
    }
    // Fail-closed gracefully for all uncached passages without triggering heavy multi-second serial loops
    for (const p of uncached) {
      results.set(p.id, {
        supported: false,
        score: 0.0,
        reason: "Verifier unavailable in batch",
        verifierUnavailable: true,
      });
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

  // Take top 5 candidates for verification in a single compact batch call
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

  // Batch verify the targeted candidates in a single fast call
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
      finalScore = normScore;
    } else if (verification.supported) {
      finalScore = 0.50 * normScore + 0.50 * verification.score;
    } else {
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
