import { describe, expect, it } from "vitest";
import { normalizeTypedQuestion, validateTypedQuestion } from "./typedQuestion";

describe("typed question fallback", () => {
  it("normalizes whitespace without changing the submitted wording", () => {
    expect(normalizeTypedQuestion("  निगम   किस कानून द्वारा शासित होता है? \n")).toBe("निगम किस कानून द्वारा शासित होता है?");
  });

  it("requires a non-empty question", () => {
    expect(validateTypedQuestion(" \n ")).toBe("Type a question before submitting it to the evidence harness.");
  });

  it("enforces the browser-transcript route size limit", () => {
    expect(validateTypedQuestion("a".repeat(2_001))).toBe("Keep the typed question below 2,000 characters.");
  });
});
