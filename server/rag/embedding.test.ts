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

  it("removes spoken-query punctuation without dropping Indic content terms", () => {
    expect(lexicalTerms("निगम किस कानून द्वारा शासित होता है?")).toEqual(["निगम", "किस", "कानून", "द्वारा", "शासित", "होता", "है"]);
    expect(lexicalTerms("corporation—law: evidence!")).toEqual(["corporation", "law", "evidence"]);
  });

  it("adds the audited Tamil integrity stem for a possessive-form source-backed question", () => {
    expect(lexicalTerms("நேர்மையின் பொருள் என்ன?")).toEqual(["நேர்மையின்", "நேர்மை", "பொருள்"]);
  });

  it("adds only source-attested equivalents for the repaired Hindi, Kannada, and Marathi paraphrases", () => {
    expect(lexicalTerms("मालवाहक जहाज़ के निचले भाग को क्या कहते हैं?")).toEqual(expect.arrayContaining(["जहाज़", "जहाज", "निचले", "नीचे", "भाग", "खंड"]));
    expect(lexicalTerms("ಕಾರ್ಪೊರೇಷನ್ ಯಾವ ಕಾನೂನುಗಳ ಮೂಲಕ ನಿಯಂತ್ರಿತವಾಗುತ್ತದೆ?")).toEqual(expect.arrayContaining(["ಕಾರ್ಪೊರೇಷನ್", "ಕಂಪನಿ", "ಕಾನೂನುಗಳ", "ಕಾನೂನು", "ನಿಯಂತ್ರಿತವಾಗುತ್ತದೆ", "ಆಡಳಿತ"]));
    expect(lexicalTerms("ಕಡಿಮೆ ಪೊಟ್ಯಾಸಿಯಂ ಆಹಾರಕ್ರಮದ ಚಾರ್ಟ್‌ನಲ್ಲಿ ಯಾವ ಮಾಹಿತಿ ಇರುತ್ತದೆ?")).toEqual(expect.arrayContaining(["ಪೊಟ್ಯಾಸಿಯಂ", "ಪೊಟ್ಯಾಸಿಯಮ್", "ಆಹಾರಕ್ರಮದ", "ಆಹಾರ"]));
    expect(lexicalTerms("ஒரு கார்ப்பரேஷன் என்பது என்ன?")).toEqual(expect.arrayContaining(["கார்ப்பரேஷன்", "நிறுவனம்"]));
    expect(lexicalTerms("मालवाहू जहाजाच्या तळाच्या भागाला काय म्हणतात?")).toEqual(expect.arrayContaining(["तळाच्या", "खालच्या", "भागाला", "विभाग"]));
    expect(lexicalTerms("मालवाहू जहाजाच्या तळाच्या भागाला काय म्हणतात?")).not.toContain("काय");
    expect(lexicalTerms("मालवाहू जहाजाच्या तळाच्या भागाला काय म्हणतात?")).not.toContain("म्हणतात");
  });
});
