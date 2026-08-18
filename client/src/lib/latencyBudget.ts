import type { HarnessEvent, RAGRun } from "@shared/rag";

const RETRIEVAL_STAGES = ["query_route", "parallel_retrieve", "fuse", "rerank"] as const;
const SAFETY_STAGES = ["normalize", "detect_language", "safety/scope_gate", "evidence_gate", "verify", "return"] as const;
const ANSWER_STAGES = ["generate"] as const;

function totalFor(trace: HarnessEvent[], stages: readonly string[]): number {
  return Number(trace.filter(event => stages.includes(event.stage)).reduce((total, event) => total + event.durationMs, 0).toFixed(2));
}

export type InternalLatencyBudget = {
  budgetMs: number;
  internalMs: number;
  retrievalMs: number;
  safetyMs: number;
  answerMs: number;
  sttMs: number;
  underBudget: boolean;
};

export function buildInternalLatencyBudget(run: RAGRun, budgetMs = 200): InternalLatencyBudget {
  const retrievalMs = totalFor(run.trace, RETRIEVAL_STAGES);
  const safetyMs = totalFor(run.trace, SAFETY_STAGES);
  const answerMs = totalFor(run.trace, ANSWER_STAGES);
  return {
    budgetMs,
    internalMs: run.latency.ragMs,
    retrievalMs,
    safetyMs,
    answerMs,
    sttMs: run.latency.sttMs,
    underBudget: run.latency.ragMs <= budgetMs,
  };
}
