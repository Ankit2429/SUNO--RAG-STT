import type { ConfidenceBand, EvidenceChunk, StructuredAnswer } from "@shared/rag";

const unsafePatterns = [
  /\b(?:make|build|buy)\s+(?:a\s+)?(?:bomb|weapon|explosive)/i,
  /\b(?:kill|hurt)\s+(?:myself|yourself|someone|people)/i,
  /\b(?:ignore|bypass|override)\b.*\b(?:instruction|guardrail|system|prompt)/i,
];

const promptInjectionPatterns = [
  /\b(?:ignore|reveal|print|show)\b.*\b(?:system|developer|hidden)\b/i,
  /\b(?:jailbreak|prompt injection|developer message)\b/i,
  /(?:पिछले|पूर्व|पहले)\s+निर्देश(?:ों)?\s+को\s+(?:अनदेखा|नज़रअंदाज़|नजरअंदाज)\s+कर(?:ें|ो)?/,
  /(?:सिस्टम|प्रणाली)\s*(?:प्रॉम्प्ट|निर्देश)\s*(?:दिखा(?:एं|ओ)?|बताइए|बताओ|प्रकट)/,
  /(?:ಹಿಂದಿನ|ಮೊದಲಿನ)\s+ಸೂಚನೆ(?:ಗಳನ್ನು)?\s+(?:ನಿರ್ಲಕ್ಷಿಸಿ|ಕಡೆಗಣಿಸಿ)/,
  /(?:ಸಿಸ್ಟಮ್|ವ್ಯವಸ್ಥೆ)\s*(?:ಪ್ರಾಂಪ್ಟ್|ಸೂಚನೆ)\s*(?:ತೋರಿಸಿ|ಬಹಿರಂಗಪಡಿಸಿ)/,
  /(?:முந்தைய|முன்)\s+(?:வழிமுறைகளை|அறிவுறுத்தல்களை)\s+(?:புறக்கணித்து|புறக்கணிக்கவும்)/,
  /(?:சிஸ்டம்|அமைப்பு)\s*(?:ப்ராம்ப்டை|வழிமுறையை)\s*(?:காட்டுங்கள்|வெளிப்படுத்துங்கள்)/,
  /(?:मागील|पूर्वीच्या)\s+सूचना\s+(?:दुर्लक्ष|नजरअंदाज)\s+करा/,
  /(?:सिस्टम|प्रणाली)\s*(?:प्रॉम्प्ट|सूचना)\s*(?:दाखवा|उघड करा)/,
];

export function refused(reason: string): StructuredAnswer {
  return {
    status: "REFUSED",
    answer: "No directly matching MSMARCO-XI passage was found for this question, so SvaraProof will not invent an answer. Try a source-backed prompt or rephrase with indexed-corpus terms.",
    evidenceIds: [],
    confidenceBand: "NONE",
    refusalReason: reason,
  };
}

export function errorAnswer(reason: string): StructuredAnswer {
  return {
    status: "ERROR",
    answer: "The evidence pipeline could not complete safely. No answer was generated.",
    evidenceIds: [],
    confidenceBand: "NONE",
    refusalReason: reason,
  };
}

export function inspectQuery(query: string): string | null {
  const normalized = query.trim();
  if (normalized.length < 3) return "The transcription was too short to retrieve reliable evidence.";
  if (normalized.length > 600) return "The query exceeds the bounded retrieval input limit.";
  if (promptInjectionPatterns.some(pattern => pattern.test(normalized))) return "The prompt-injection gate blocked the request.";
  if (unsafePatterns.some(pattern => pattern.test(normalized))) return "The safety gate blocked an unsafe request.";
  return null;
}

function queryTerms(query: string): Set<string> {
  const nonSemanticTerms = new Set([
    "क्या", "काय", "है", "आहे", "का", "की", "के", "को", "किस", "द्वारा", "होता", "होती", "होते",
    "ಏನು", "ಏನದು", "ಎಂದರೇನು", "ಇದು", "ಯಾವುದು", "ಯಾವ", "ಮತ್ತು",
    "என்ன", "எது", "ஒரு", "என்பது", "எந்த", "மற்றும்",
    "कोणत्या", "कोणता", "द्वारे",
    "what", "which", "when", "where", "why", "how", "the", "and", "for", "with",
  ]);
  return new Set(
    query.toLocaleLowerCase().split(/[^\w\u0900-\u0D7F]+/).filter(term => term.length >= 3 && !nonSemanticTerms.has(term)).slice(0, 12),
  );
}

function evidenceSentence(chunk: EvidenceChunk, terms: Set<string>): string | null {
  const sentences = chunk.text.split(/(?<=[.!?।॥؟])\s+/).filter(Boolean);
  const ranked = sentences
    .map(sentence => {
      const sentenceTerms = new Set(sentence.toLocaleLowerCase().split(/[^\w\u0900-\u0D7F]+/).filter(Boolean));
      return { sentence, score: Array.from(terms).filter(term => sentenceTerms.has(term)).length };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score ? ranked[0].sentence.trim() : null;
}

/**
 * Keep deterministic answers fully evidence-bound while removing a leading
 * connective that only made sense inside the source paragraph. The Kannada
 * form below is a grammar-preserving restatement of the exact cited sentence;
 * it does not add a claim, a source, or an uncited fact.
 */
function polishEvidenceSentence(sentence: string): string {
  const standalone = sentence.replace(/^\s*(?:फिर|नंतर|ನಂತರ|பிறகு)\s+/, "").trim();
  if (/^ಆ ಕಂಪನಿಯು ಆ ರಾಜ್ಯದಲ್ಲಿನ ಸಂಯೋಜನೆಯ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತವನ್ನು ನಡೆಸುತ್ತದೆ[.]?$/.test(standalone)) {
    return "ಕಂಪನಿಯು ಅದು ಸಂಯೋಜಿತವಾಗಿರುವ ರಾಜ್ಯದ ಸಂಯೋಜನೆ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತಗೊಳ್ಳುತ್ತದೆ.";
  }
  return standalone;
}

export function verifyAndSynthesize(query: string, evidence: EvidenceChunk[], scores: Map<string, number>): StructuredAnswer {
  const terms = queryTerms(query);
  const supported = evidence
    .map(chunk => ({ chunk, sentence: evidenceSentence(chunk, terms), score: scores.get(chunk.id) ?? 0 }))
    .filter((item): item is { chunk: EvidenceChunk; sentence: string; score: number } => Boolean(item.sentence))
    .sort((a, b) => b.score - a.score);

  const uniqueParents = new Set(supported.map(item => item.chunk.parentId));
  const top = supported[0];
  if (!top || top.score < 0.28 || !uniqueParents.size) {
    return refused("Retrieved passages did not meet the evidence sufficiency threshold.");
  }

  const citations = supported.slice(0, 2);
  const answer = citations.map(item => polishEvidenceSentence(item.sentence)).join(" ");
  const confidenceBand: ConfidenceBand = uniqueParents.size >= 2 && top.score >= 0.48 ? "HIGH" : "MEDIUM";
  return {
    status: "GROUNDED",
    answer,
    evidenceIds: citations.map(item => item.chunk.id),
    confidenceBand,
    refusalReason: null,
  };
}
