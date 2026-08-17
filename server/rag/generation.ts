import { invokeLLM } from "../_core/llm";
import type { EvidenceChunk, StructuredAnswer } from "@shared/rag";

const allowedModes = new Set(["extractive", "llm"]);

export function generationMode() {
  const candidate = process.env.RAG_GENERATION_MODE || "extractive";
  return allowedModes.has(candidate) ? candidate : "extractive";
}

export async function generateEvidenceBoundAnswer(input: {
  query: string;
  evidence: EvidenceChunk[];
  baseline: StructuredAnswer;
}): Promise<StructuredAnswer> {
  if (generationMode() !== "llm" || input.baseline.status !== "GROUNDED") return input.baseline;
  const cited = input.evidence.filter(chunk => input.baseline.evidenceIds.includes(chunk.id));
  if (!cited.length) return input.baseline;

  try {
    const response = await invokeLLM({
      model: "gpt-5-nano",
      maxTokens: 220,
      messages: [
        { role: "system", content: "You are a retrieval answer component. Use only the supplied evidence. Do not add facts. If it is insufficient, keep the refusal. Return the required JSON only." },
        { role: "user", content: JSON.stringify({ query: input.query, baseline: input.baseline, evidence: cited.map(chunk => ({ id: chunk.id, text: chunk.text })) }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "grounded_answer",
          strict: true,
          schema: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["GROUNDED", "REFUSED", "ERROR"] },
              answer: { type: "string" },
              evidenceIds: { type: "array", items: { type: "string" } },
              confidenceBand: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "NONE"] },
              refusalReason: { type: ["string", "null"] },
            },
            required: ["status", "answer", "evidenceIds", "confidenceBand", "refusalReason"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") return input.baseline;
    const candidate = JSON.parse(content) as StructuredAnswer;
    const validIds = new Set(input.baseline.evidenceIds);
    if (candidate.status !== "GROUNDED" || !candidate.answer.trim() || !candidate.evidenceIds.length || candidate.evidenceIds.some(id => !validIds.has(id))) return input.baseline;
    return { ...candidate, refusalReason: null };
  } catch {
    return input.baseline;
  }
}
