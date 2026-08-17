export const HARNESS_STAGES = [
  "validate_audio",
  "transcribe",
  "normalize",
  "detect_language",
  "safety/scope_gate",
  "query_route",
  "parallel_retrieve",
  "fuse",
  "rerank",
  "evidence_gate",
  "generate",
  "verify",
  "return",
] as const;

export type HarnessStage = (typeof HARNESS_STAGES)[number];
export type AnswerStatus = "GROUNDED" | "REFUSED" | "ERROR";
export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type ChunkStrategy =
  | "semantic_sentence_window"
  | "paragraph_section"
  | "answer_centered_window"
  | "fixed_window_fallback"
  | "query_linked_evaluation";

export type StructuredAnswer = {
  status: AnswerStatus;
  answer: string;
  evidenceIds: string[];
  confidenceBand: ConfidenceBand;
  refusalReason: string | null;
};

export type EvidenceChunk = {
  id: string;
  text: string;
  language: string;
  source: "ai4bharat/MSMARCO-XI";
  strategy: ChunkStrategy;
  parentId: string;
  queryId: string;
  queryType: string;
  ordinal: number;
  selected: boolean;
  overlap: number;
};

export type IngestionManifest = {
  datasetRevision: string;
  rowCounts: Record<string, number>;
  languages: string[];
  indexVersion: string;
  buildTimestamp: string;
  profile: "evaluation" | "expanded" | "full";
  embeddingModel: string;
  embeddingDimensions: number;
  chunkCounts: Record<ChunkStrategy, number>;
};

export type HarnessEvent = {
  stage: HarnessStage;
  status: "OK" | "SKIPPED" | "REFUSED" | "ERROR";
  durationMs: number;
  detail: string;
};

export type LatencyBreakdown = {
  sttMs: number;
  ragMs: number;
  endToEndMs: number;
};

export type RAGRun = {
  requestId: string;
  transcript: string;
  detectedLanguage: string;
  detectedScript: string;
  answer: StructuredAnswer;
  evidence: EvidenceChunk[];
  trace: HarnessEvent[];
  latency: LatencyBreakdown;
};

export type PercentileSummary = {
  p50: number;
  p70: number;
  p100: number;
  sampleCount: number;
  failureCount: number;
};

export type BenchmarkReport = {
  queryCount: number;
  cold: PercentileSummary;
  warm: PercentileSummary;
  postTranscriptionTargetMs: number;
  evaluatedAt: string;
};
