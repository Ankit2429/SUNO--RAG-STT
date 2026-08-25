import type { Express } from "express";
import type { EvidenceChunk } from "@shared/rag";
import { DENSE_VECTOR_SIZE, embedText } from "./embedding";
import { errorAnswer, inspectQuery, refused } from "./guardrails";
import { generateEvidenceBoundAnswer } from "./generation";
import { verifyAndSynthesize } from "./guardrails";
import { rerankWithSemanticVerifier } from "./semanticVerifier";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const LOG_FILE = resolve(process.cwd(), "scratch", "eval-bridge.log");

function log(line: string) {
  // Non-blocking in-memory/console logging for fast evaluation response
}

type EvalContext = { text?: unknown; score?: unknown; id?: unknown };

function toEvidenceChunks(contexts: EvalContext[]): { chunks: EvidenceChunk[]; scores: Map<string, number> } {
  const chunks: EvidenceChunk[] = [];
  const scores = new Map<string, number>();
  contexts.forEach((context, index) => {
    const baseId = typeof context.id === "string" && context.id ? context.id : "eval";
    const id = `${baseId}-${index}`;
    const score = typeof context.score === "number" ? context.score : 0;
    chunks.push({
      id,
      text: typeof context.text === "string" ? context.text : "",
      language: "en",
      source: "ai4bharat/MSMARCO-XI",
      strategy: "fixed_window_fallback",
      parentId: `eval-parent-${index}`,
      queryId: typeof context.id === "string" ? context.id : "",
      queryType: "evaluation_bridge",
      ordinal: index,
      selected: false,
      overlap: 0,
    });
    scores.set(id, score);
  });
  return { chunks, scores };
}

export function registerEvalBridge(app: Express) {
  app.post("/api/eval/embed", (req, res) => {
    const started = performance.now();
    const texts = Array.isArray(req.body?.texts) ? (req.body.texts as unknown[]) : null;
    if (!texts) {
      res.status(400).json({ error: "Body must be {\"texts\": [...]}" });
      return;
    }
    const vectors = texts.map(text => embedText(typeof text === "string" ? text : String(text ?? "")));
    log(`POST /api/eval/embed texts=${vectors.length} dim=${DENSE_VECTOR_SIZE} durMs=${(performance.now() - started).toFixed(2)}`);
    res.json({ vectors, dim: DENSE_VECTOR_SIZE, model: "multilingual-unicode-ngram-dense-v1" });
  });

  app.post("/api/eval/embed-one", (req, res) => {
    const started = performance.now();
    const text = typeof req.body?.text === "string" ? req.body.text : null;
    if (text === null) {
      res.status(400).json({ error: "Body must be {\"text\": \"...\"}" });
      return;
    }
    log(`POST /api/eval/embed-one chars=${text.length} preview=${JSON.stringify(text.slice(0, 60))} durMs=${(performance.now() - started).toFixed(2)}`);
    res.json({ vector: embedText(text), dim: DENSE_VECTOR_SIZE, model: "multilingual-unicode-ngram-dense-v1" });
  });

  app.post("/api/eval/generate", async (req, res) => {
    const started = performance.now();
    const query = typeof req.body?.query === "string" ? req.body.query : null;
    const contexts = Array.isArray(req.body?.contexts) ? (req.body.contexts as EvalContext[]) : null;
    if (query === null || !contexts) {
      res.status(400).json({ error: "Body must be {\"query\": \"...\", \"contexts\": [{\"text\", \"score\", \"id\"?}]}" });
      return;
    }

    const safetyRefusal = inspectQuery(query);
    let answer = safetyRefusal
      ? (() => { const a = errorAnswer(safetyRefusal); a.status = "REFUSED"; return a; })()
      : null;

    if (!answer) {
      const { chunks, scores } = toEvidenceChunks(contexts);
      const rerankedResult = await rerankWithSemanticVerifier(query, chunks, scores);
      const baseline = verifyAndSynthesize(query, rerankedResult.reranked, rerankedResult.scores, "en-IN");
      answer = await generateEvidenceBoundAnswer({ query, evidence: rerankedResult.reranked, baseline });
      log(
        `POST /api/eval/generate query=${JSON.stringify(query.slice(0, 60))} contexts=${contexts.length} ` +
        `status=${answer.status} evidence=${answer.evidenceIds.length} ` +
        `semanticMs=${rerankedResult.totalLatencyMs.toFixed(2)} totalDurMs=${(performance.now() - started).toFixed(2)}`
      );
    } else {
      log(`POST /api/eval/generate query=${JSON.stringify(query.slice(0, 60))} status=REFUSED(gate) totalDurMs=${(performance.now() - started).toFixed(2)}`);
    }

    res.json({
      answer: answer.answer,
      grounded: answer.status === "GROUNDED",
      status: answer.status,
      confidence_band: answer.confidenceBand,
      refusal_reason: answer.refusalReason,
      generation_ms: Math.round((performance.now() - started) * 100) / 100,
      evidence_ids: answer.evidenceIds,
    });
  });

  log("Evaluation bridge registered: POST /api/eval/embed | /api/eval/embed-one | /api/eval/generate");
}
