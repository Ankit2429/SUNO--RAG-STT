import { describe, expect, it } from "vitest";
import { DENSE_VECTOR_SIZE, embedText, lexicalScore, lexicalTerms } from "./embedding";

describe("zero-cost multilingual embedding", () => {
  it("is deterministic, normalized, and fixed-width for Indic-script text", () => {
    const first = embedText("मैनहट्टन परियोजना का प्रभाव क्या था?");
    const second = embedText("मैनहट्टन परियोजना का प्रभाव क्या था?");
    expect(first).toEqual(second);
    expect(first).toHaveLength(DENSE_VECTOR_SIZE);
    expect(Math.sqrt(first.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1, 6);
  });

  it("retains Unicode terms for lexical fusion", () => {
    const terms = lexicalTerms("மன்ஹாட்டன் திட்டத்தின் தாக்கம் என்ன?");
    expect(terms.length).toBeGreaterThan(1);
    expect(lexicalScore("மன்ஹாட்டன் திட்டத்தின் தாக்கம் உடனடியாக இருந்தது", terms)).toBeGreaterThan(0);
  });
});
