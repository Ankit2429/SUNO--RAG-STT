import { describe, expect, it } from "vitest";
import { FOCUSED_VOICE_SAMPLES } from "./focusedVoiceSamples";

describe("focused voice samples", () => {
  it("covers the five visible language overrides in their intended order", () => {
    expect(FOCUSED_VOICE_SAMPLES.map(sample => sample.languageCode)).toEqual(["hi-IN", "kn-IN", "en-IN", "ta-IN", "mr-IN"]);
  });

  it("marks English as transcription-only and every other sample as grounded", () => {
    const english = FOCUSED_VOICE_SAMPLES.find(sample => sample.languageCode === "en-IN");
    expect(english?.evidenceMode).toBe("transcription_only");
    expect(FOCUSED_VOICE_SAMPLES.filter(sample => sample.languageCode !== "en-IN").every(sample => sample.evidenceMode === "grounded")).toBe(true);
  });

  it("retains the corpus-lexical grounded prompts validated through the live harness", () => {
    expect(FOCUSED_VOICE_SAMPLES.find(sample => sample.languageCode === "hi-IN")?.prompt).toBe("निगम किस कानून द्वारा शासित होता है?");
    expect(FOCUSED_VOICE_SAMPLES.find(sample => sample.languageCode === "kn-IN")?.prompt).toBe("ಕಂಪನಿಯು ಯಾವ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತ ನಡೆಸುತ್ತದೆ?");
    expect(FOCUSED_VOICE_SAMPLES.find(sample => sample.languageCode === "ta-IN")?.prompt).toBe("நிறுவனம் எந்த சட்டங்களால் நிர்வகிக்கப்படுகிறது?");
    expect(FOCUSED_VOICE_SAMPLES.find(sample => sample.languageCode === "mr-IN")?.prompt).toBe("कॉर्पोरेशन कोणत्या कायद्यांद्वारे शासित आहे?");
  });
});
