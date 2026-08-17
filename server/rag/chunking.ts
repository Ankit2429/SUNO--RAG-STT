import { createHash } from "node:crypto";
import type { ChunkStrategy, EvidenceChunk } from "@shared/rag";

type PassageInput = {
  passage: string;
  language: string;
  queryId: string;
  queryType: string;
  ordinal: number;
  selected: boolean;
  answer: string;
};

const sentenceBoundary = /(?<=[.!?।॥؟])\s+/;
const paragraphBoundary = /\n{2,}/;

export function normalizeText(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function stableId(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u241f")).digest("hex").slice(0, 20);
}

function makeChunk(
  input: PassageInput,
  strategy: ChunkStrategy,
  text: string,
  overlap: number,
  suffix: number,
): EvidenceChunk {
  const parentId = stableId([input.language, input.queryId, String(input.ordinal), input.passage]);
  return {
    id: stableId([parentId, strategy, String(suffix), text]),
    text: normalizeText(text),
    language: input.language,
    source: "ai4bharat/MSMARCO-XI",
    strategy,
    parentId,
    queryId: input.queryId,
    queryType: input.queryType,
    ordinal: input.ordinal,
    selected: input.selected,
    overlap,
  };
}

function semanticSentenceWindows(input: PassageInput): EvidenceChunk[] {
  const sentences = normalizeText(input.passage).split(sentenceBoundary).filter(Boolean);
  if (sentences.length <= 1) return [];
  const windows: EvidenceChunk[] = [];
  const width = 3;
  const stride = 2;
  for (let start = 0; start < sentences.length; start += stride) {
    const selected = sentences.slice(start, start + width);
    if (selected.length < 2) break;
    windows.push(makeChunk(input, "semantic_sentence_window", selected.join(" "), width - stride, start));
  }
  return windows;
}

function paragraphSections(input: PassageInput): EvidenceChunk[] {
  const paragraphs = input.passage.split(paragraphBoundary).map(normalizeText).filter(Boolean);
  const source = paragraphs.length ? paragraphs : [normalizeText(input.passage)];
  return source
    .filter(text => text.length >= 40)
    .map((text, index) => makeChunk(input, "paragraph_section", text, 0, index));
}

function answerCenteredWindows(input: PassageInput): EvidenceChunk[] {
  const answerTokens = new Set(normalizeText(input.answer).toLocaleLowerCase().split(/\s+/).filter(token => token.length > 3));
  if (!answerTokens.size) return [];
  const words = normalizeText(input.passage).split(/\s+/);
  const pivot = words.findIndex(word => answerTokens.has(word.toLocaleLowerCase()));
  if (pivot < 0) return [];
  const radius = 38;
  const text = words.slice(Math.max(0, pivot - radius), Math.min(words.length, pivot + radius)).join(" ");
  return [makeChunk(input, "answer_centered_window", text, 0, pivot)];
}

function fixedWindows(input: PassageInput): EvidenceChunk[] {
  const words = normalizeText(input.passage).split(/\s+/);
  const width = 90;
  const overlap = 18;
  const stride = width - overlap;
  const chunks: EvidenceChunk[] = [];
  for (let start = 0; start < words.length; start += stride) {
    const text = words.slice(start, start + width).join(" ");
    if (text.length < 80) break;
    chunks.push(makeChunk(input, "fixed_window_fallback", text, overlap, start));
  }
  return chunks;
}

function queryLinkedRecord(input: PassageInput): EvidenceChunk[] {
  const queryLink = `Question type: ${input.queryType}. Supporting passage: ${normalizeText(input.passage)}`;
  return [makeChunk(input, "query_linked_evaluation", queryLink, 0, 0)];
}

export function createEngineeredChunks(input: PassageInput): EvidenceChunk[] {
  const strategies = [
    ...semanticSentenceWindows(input),
    ...paragraphSections(input),
    ...answerCenteredWindows(input),
    ...fixedWindows(input),
    ...queryLinkedRecord(input),
  ];
  const unique = new Map<string, EvidenceChunk>();
  strategies.forEach(chunk => unique.set(chunk.id, chunk));
  return Array.from(unique.values());
}
