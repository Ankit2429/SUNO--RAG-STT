import { describe, expect, it } from "vitest";
import { AUTO_DETECT_LANGUAGE } from "@shared/voiceLanguages";
import { prepareTypedQuestionSubmission } from "../pages/Home";
import { buildTypedQuestionHarnessInput, normalizeTypedQuestion, resolveTypedQuestionLanguage, validateTypedQuestion } from "./typedQuestion";

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

  it("infers the Hindi route for a source-backed Hindi typed question when auto is selected", () => {
    expect(resolveTypedQuestionLanguage("निगम किस कानून द्वारा शासित होता है?", AUTO_DETECT_LANGUAGE)).toEqual({
      languageCode: "hi-IN",
      source: "script-inferred",
    });
  });

  it("infers the Kannada route from the typed script and preserves an explicit selection", () => {
    expect(resolveTypedQuestionLanguage("ಕಂಪನಿಯು ಯಾವ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತ ನಡೆಸುತ್ತದೆ?", AUTO_DETECT_LANGUAGE)).toEqual({
      languageCode: "kn-IN",
      source: "script-inferred",
    });
    expect(resolveTypedQuestionLanguage("निगम किस कानून द्वारा शासित होता है?", "mr-IN")).toEqual({
      languageCode: "mr-IN",
      source: "selected",
    });
  });

  it("builds the exact browser-transcript contract for an automatic Hindi typed submission", () => {
    expect(buildTypedQuestionHarnessInput("  निगम किस कानून द्वारा शासित होता है?  ", AUTO_DETECT_LANGUAGE)).toEqual({
      input: {
        transcript: "निगम किस कानून द्वारा शासित होता है?",
        languageCode: "hi-IN",
        script: "typed-input",
      },
      languageSource: "script-inferred",
    });
  });

  it("uses the Home submission adapter to pass only the accepted tRPC fields", () => {
    const submission = prepareTypedQuestionSubmission("निगम किस कानून द्वारा शासित होता है?", AUTO_DETECT_LANGUAGE);

    expect(submission.input).toStrictEqual({
      transcript: "निगम किस कानून द्वारा शासित होता है?",
      languageCode: "hi-IN",
      script: "typed-input",
    });
    expect(Object.keys(submission.input).sort()).toEqual(["languageCode", "script", "transcript"]);
    expect(submission.languageSource).toBe("script-inferred");
  });
});
