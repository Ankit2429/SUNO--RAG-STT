import type { IngestionManifest } from "./rag";

/**
 * Aggregated from five completed bounded validation-slice ingestions (hi, ta, te, bn, mr).
 * The record is intentionally versioned and contains no raw audio or provider credentials.
 */
export const EVALUATION_MANIFEST: IngestionManifest = {
  datasetRevision: "main",
  rowCounts: { hi: 97941, ta: 97941, te: 97941, bn: 97941, mr: 97941 },
  languages: ["hi", "ta", "te", "bn", "mr"],
  indexVersion: "msmarco-xi-evaluation-v1",
  buildTimestamp: "2026-08-17T19:15:12.200Z",
  profile: "evaluation",
  embeddingModel: "zero-cost-unicode-hash-dense-v1",
  embeddingDimensions: 384,
  chunkCounts: {
    semantic_sentence_window: 321,
    paragraph_section: 249,
    answer_centered_window: 127,
    fixed_window_fallback: 228,
    query_linked_evaluation: 250,
  },
};
