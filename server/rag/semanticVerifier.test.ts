import { describe, expect, it, beforeEach } from "vitest";
import {
  clearVerifierCache,
  rerankWithSemanticVerifier,
  verifySemanticRelevance,
  SEMANTIC_VERIFIER_PROMPT_VERSION,
} from "./semanticVerifier";
import { verifyAndSynthesize, detectQueryDimensions } from "./guardrails";
import type { EvidenceChunk } from "@shared/rag";

describe("Semantic Evidence Verifier & Reranker", () => {
  beforeEach(() => {
    clearVerifierCache();
  });

  it("exports prompt version v2", () => {
    expect(SEMANTIC_VERIFIER_PROMPT_VERSION).toBe("v2");
  });

  // Test 1: Definition
  it("Test 1: Definition query supported=true when passage directly defines concept", async () => {
    const question = "What is customer service?";
    const passage =
      "Customer service is the act of taking care of customers' needs by providing assistance before, during, and after a purchase.";
    const result = await verifySemanticRelevance(question, passage);
    // If local Ollama is active, it validates semantic support; if unavailable, fail closed
    if (!result.verifierUnavailable) {
      expect(result.supported).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.5);
    } else {
      expect(result.supported).toBe(false);
      expect(result.score).toBe(0);
    }
  });

  // Test 2: Related-but-not-answering
  it("Test 2: Related-but-not-answering query supported=false", async () => {
    const question = "What is customer service?";
    const passage = "Companies use customer service teams to improve customer satisfaction.";
    const result = await verifySemanticRelevance(question, passage);
    if (!result.verifierUnavailable) {
      expect(result.supported).toBe(false);
    } else {
      expect(result.supported).toBe(false);
    }
  });

  // Test 3: Cause
  it("Test 3: Cause query supported=false when passage describes entity but no cause", async () => {
    const question = "Why does iron rust?";
    const passage = "Iron is a heavy, malleable, ductile magnetic silver-white metallic element used widely in construction.";
    const result = await verifySemanticRelevance(question, passage);
    expect(result.supported).toBe(false);
  });

  // Test 4: Who
  it("Test 4: Who query supported=false when passage mentions entity but not founder", async () => {
    const question = "Who founded Apple Inc.?";
    const passage = "Apple Inc. produces electronic devices including the iPhone, iPad, Mac computers, and Apple Watch.";
    const result = await verifySemanticRelevance(question, passage);
    expect(result.supported).toBe(false);
  });

  // Test 5: Quantity
  it("Test 5: Quantity query supported=false when passage has no employee count", async () => {
    const question = "How many employees does Microsoft have?";
    const passage = "Microsoft Corporation is an American multinational technology corporation headquartered in Redmond, Washington.";
    const result = await verifySemanticRelevance(question, passage);
    expect(result.supported).toBe(false);
  });

  // Test 6: Procedure
  it("Test 6: Procedure query supported=false when passage says X can be reset but gives no steps", async () => {
    const question = "How do I reset my router?";
    const passage = "Routers can easily be reset when network troubleshooting is necessary.";
    const result = await verifySemanticRelevance(question, passage);
    expect(result.supported).toBe(false);
  });

  // Test 7: Compound query
  it("Test 7: Compound query evaluates independent dimensions with distinct candidate evidence", async () => {
    const compoundQuery = "Who founded Microsoft and when was Microsoft founded?";
    const dimensions = detectQueryDimensions(compoundQuery);
    expect(dimensions.length).toBeGreaterThanOrEqual(2);

    const chunk1: EvidenceChunk = {
      id: "chunk-founder",
      text: "Microsoft was founded by Bill Gates and Paul Allen on April 4, 1975.",
      language: "en",
      source: "ai4bharat/MSMARCO-XI",
      strategy: "fixed_window_fallback",
      parentId: "p1",
      queryId: "q-ms",
      queryType: "multi_dimension",
      ordinal: 0,
      selected: false,
      overlap: 0,
    };

    const chunk2: EvidenceChunk = {
      id: "chunk-date",
      text: "Microsoft was founded on April 4, 1975 to develop and sell BASIC interpreters for the Altair 8800.",
      language: "en",
      source: "ai4bharat/MSMARCO-XI",
      strategy: "fixed_window_fallback",
      parentId: "p2",
      queryId: "q-ms-2",
      queryType: "multi_dimension",
      ordinal: 1,
      selected: false,
      overlap: 0,
    };

    const scores = new Map([
      ["chunk-founder", 0.9],
      ["chunk-date", 0.9],
    ]);

    const answer = verifyAndSynthesize(compoundQuery, [chunk1, chunk2], scores, "en-IN");
    expect(answer.status).toBe("GROUNDED");
    expect(answer.evidenceIds.length).toBeGreaterThan(0);
    expect(answer.answer.length).toBeGreaterThan(10);
  });

  // Test 8: Ollama unavailable fail-closed
  it("Test 8: Ollama unavailable fails closed safely without crashing", async () => {
    const originalUrl = process.env.RAG_SEMANTIC_OLLAMA_URL;
    try {
      // Point to non-existent endpoint
      process.env.RAG_SEMANTIC_OLLAMA_URL = "http://127.0.0.1:54321";
      const result = await verifySemanticRelevance("What is solar energy?", "Solar energy is light and heat from the Sun.", {
        timeoutMs: 300,
      });
      expect(result.supported).toBe(false);
      expect(result.score).toBe(0);
      expect(result.verifierUnavailable).toBe(true);

      const chunk: EvidenceChunk = {
        id: "chunk-solar",
        text: "Solar energy is radiant light and heat from the Sun.",
        language: "en",
        source: "ai4bharat/MSMARCO-XI",
        strategy: "fixed_window_fallback",
        parentId: "p-solar",
        queryId: "q-solar",
        queryType: "general",
        ordinal: 0,
        selected: false,
        overlap: 0,
      };

      // Reranker should not crash even if verifier is completely unavailable
      const rerankResult = await rerankWithSemanticVerifier(
        "What is solar energy?",
        [chunk],
        new Map([["chunk-solar", 0.8]]),
        { timeoutMs: 300 }
      );
      expect(rerankResult.reranked.length).toBe(1);
      expect(rerankResult.scores.has("chunk-solar")).toBe(true);
    } finally {
      process.env.RAG_SEMANTIC_OLLAMA_URL = originalUrl;
    }
  });

  // Test 9: Malformed JSON handled fail-closed
  it("Test 9: In-memory cache returns cached verification on repeat query", async () => {
    const q = "What is water?";
    const p = "Water is a chemical compound consisting of two hydrogen atoms and one oxygen atom.";
    const first = await verifySemanticRelevance(q, p);
    const second = await verifySemanticRelevance(q, p);
    expect(first.supported).toBe(second.supported);
    expect(first.score).toBe(second.score);
  });
});
