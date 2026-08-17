import { describe, expect, it } from "vitest";
import { createEngineeredChunks, normalizeText } from "./chunking";

const input = {
  passage: "पहला वाक्य संदर्भ देता है। दूसरा वाक्य तथ्य देता है। तीसरा वाक्य स्रोत को स्पष्ट करता है। चौथा वाक्य अतिरिक्त प्रमाण देता है।",
  language: "hi",
  queryId: "42",
  queryType: "DESCRIPTION",
  ordinal: 0,
  selected: true,
  answer: "तथ्य",
};

describe("engineered chunking", () => {
  it("normalizes Unicode and whitespace deterministically", () => {
    expect(normalizeText("  cafe\u0301   \n test ")).toBe("café test");
  });

  it("emits all five planned chunk families with source metadata", () => {
    const chunks = createEngineeredChunks(input);
    expect(new Set(chunks.map(chunk => chunk.strategy))).toEqual(new Set([
      "semantic_sentence_window",
      "paragraph_section",
      "answer_centered_window",
      "fixed_window_fallback",
      "query_linked_evaluation",
    ]));
    chunks.forEach(chunk => {
      expect(chunk.language).toBe("hi");
      expect(chunk.source).toBe("ai4bharat/MSMARCO-XI");
      expect(chunk.parentId).toBeTruthy();
    });
  });
});
