import type { RAGRun } from "@shared/rag";

export type EvidencePathKind = "local_hot" | "cloud" | "no_evidence" | "unavailable" | "awaiting";

export type EvidencePath = {
  kind: EvidencePathKind;
  label: string;
  detail: string;
  tone: "green" | "blue" | "orange" | "red" | "neutral";
};

export function resolveEvidencePath(trace: RAGRun["trace"] | undefined): EvidencePath {
  const event = trace?.find(item => item.stage === "parallel_retrieve");
  const detail = event?.detail || "";
  const normalized = detail.toLocaleLowerCase();
  if (normalized.includes("in-process l1 language cache")) return { kind: "local_hot", label: "L1 LOCAL EVIDENCE", detail: "Real MSMARCO-XI evidence matched locally; remote vector search skipped.", tone: "green" };
  if (normalized.includes("qdrant")) return { kind: "cloud", label: "L2 VECTOR EVIDENCE", detail: "Real MSMARCO-XI candidates were retrieved through Qdrant.", tone: "blue" };
  if (normalized.includes("no bounded msmarco-xi evidence")) return { kind: "no_evidence", label: "NO SUPPORTING EVIDENCE", detail: "The answer is withheld rather than invented.", tone: "orange" };
  if (event?.status === "ERROR") return { kind: "unavailable", label: "EVIDENCE UNAVAILABLE", detail: "The harness will fail closed and never guess.", tone: "red" };
  return { kind: "awaiting", label: "AWAITING EVIDENCE", detail: "Ask a question to inspect the real corpus route.", tone: "neutral" };
}
