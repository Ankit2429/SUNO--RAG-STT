import type { IngestionManifest } from "./rag";

/**
 * Aggregated from a completed fourteen-language bounded validation-slice ingestion.
 * The record is intentionally versioned and contains no raw audio or provider credentials.
 */
export const EVALUATION_MANIFEST: IngestionManifest = {
  datasetRevision: "main",
  rowCounts: { as: 97941, bn: 97941, gu: 97941, hi: 97941, kn: 97941, ml: 97941, mr: 97941, ne: 97941, or: 97941, pa: 97941, sa: 97941, ta: 97941, te: 97941, ur: 97941 },
  languages: ["as", "bn", "gu", "hi", "kn", "ml", "mr", "ne", "or", "pa", "sa", "ta", "te", "ur"],
  indexVersion: "msmarco-xi-evaluation-v2",
  buildTimestamp: "2026-08-18T03:34:48.871Z",
  profile: "evaluation",
  embeddingModel: "zero-cost-unicode-hash-dense-v1",
  embeddingDimensions: 384,
  chunkCounts: {
    semantic_sentence_window: 3550,
    paragraph_section: 2799,
    answer_centered_window: 839,
    fixed_window_fallback: 2662,
    query_linked_evaluation: 2800,
  },
};
