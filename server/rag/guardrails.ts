import type { ConfidenceBand, EvidenceChunk, StructuredAnswer } from "@shared/rag";

const unsafePatterns = [
  /\b(?:make|build|buy)\s+(?:a\s+)?(?:bomb|weapon|explosive)/i,
  /\b(?:kill|hurt)\s+(?:myself|yourself|someone|people)/i,
  /\b(?:ignore|bypass|override)\b.*\b(?:instruction|guardrail|system|prompt)/i,
];

const promptInjectionPatterns = [
  /\b(?:ignore|reveal|print|show)\b.*\b(?:system|developer|hidden)\b/i,
  /\b(?:jailbreak|prompt injection|developer message)\b/i,
];

export function refused(reason: string): StructuredAnswer {
  return {
    status: "REFUSED",
    answer: "I can only provide an answer that is directly supported by retrieved MSMARCO-XI evidence.",
    evidenceIds: [],
    confidenceBand: "NONE",
    refusalReason: reason,
  };
}

export function errorAnswer(reason: string): StructuredAnswer {
  return {
    status: "ERROR",
    answer: "The evidence pipeline could not complete safely. No answer was generated.",
    evidenceIds: [],
    confidenceBand: "NONE",
    refusalReason: reason,
  };
}

export function inspectQuery(query: string): string | null {
  const normalized = query.trim();
  if (normalized.length < 3) return "The transcription was too short to retrieve reliable evidence.";
  if (normalized.length > 600) return "The query exceeds the bounded retrieval input limit.";
  if (promptInjectionPatterns.some(pattern => pattern.test(normalized))) return "The prompt-injection gate blocked the request.";
  if (unsafePatterns.some(pattern => pattern.test(normalized))) return "The safety gate blocked an unsafe request.";
  return null;
}

function queryTerms(query: string): Set<string> {
  return new Set(
    query.toLocaleLowerCase().split(/[^\w\u0900-\u0D7F]+/).filter(term => term.length >= 3).slice(0, 12),
  );
}

function evidenceSentence(chunk: EvidenceChunk, terms: Set<string>): string | null {
  const sentences = chunk.text.split(/(?<=[.!?।॥؟])\s+/).filter(Boolean);
  const ranked = sentences
    .map(sentence => ({ sentence, score: Array.from(terms).filter(term => sentence.toLocaleLowerCase().includes(term)).length }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score ? ranked[0].sentence.trim() : null;
}

export function verifyAndSynthesize(query: string, evidence: EvidenceChunk[], scores: Map<string, number>): StructuredAnswer {
  const terms = queryTerms(query);
  const supported = evidence
    .map(chunk => ({ chunk, sentence: evidenceSentence(chunk, terms), score: scores.get(chunk.id) ?? 0 }))
    .filter((item): item is { chunk: EvidenceChunk; sentence: string; score: number } => Boolean(item.sentence))
    .sort((a, b) => b.score - a.score);

  const uniqueParents = new Set(supported.map(item => item.chunk.parentId));
  const top = supported[0];
  if (!top || top.score < 0.28 || !uniqueParents.size) {
    return refused("Retrieved passages did not meet the evidence sufficiency threshold.");
  }

  const citations = supported.slice(0, 2);
  const answer = citations.map(item => item.sentence).join(" ");
  const confidenceBand: ConfidenceBand = uniqueParents.size >= 2 && top.score >= 0.48 ? "HIGH" : "MEDIUM";
  return {
    status: "GROUNDED",
    answer,
    evidenceIds: citations.map(item => item.chunk.id),
    confidenceBand,
    refusalReason: null,
  };
}
