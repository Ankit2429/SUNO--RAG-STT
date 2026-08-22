import { guardrailsInternals } from "../server/rag/guardrails.ts";

const query = "जहाज के निचले हिस्से या हल का क्या महत्व है?";
const terms = guardrailsInternals.queryTerms(query);
console.log("queryTerms:", terms);

const text = "बिल्ज - नीचे और जहाज के किनारे के बीच एक घुमावदार खंड; जिसमें सारा पानी निकलता है।";
const sentences = text.split(/(?<=[.!?।॥؟])\s+/).filter(Boolean);

for (const sentence of sentences) {
  const sentenceWords = sentence.toLocaleLowerCase().split(/[^\w\u0900-\u0D7F]+/);
  console.log("sentenceWords:", sentenceWords);
  const sentenceTerms = new Set(sentenceWords.map(w => w).filter(Boolean));
  console.log("sentenceTerms raw:", sentenceTerms);
  
  const matches = Array.from(terms).filter(t => sentenceTerms.has(t));
  console.log("Matches:", matches);
}
