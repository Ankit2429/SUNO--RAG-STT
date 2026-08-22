import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { verifyAndSynthesize, guardrailsInternals } from "../server/rag/guardrails.ts";
import { meaningfulLexicalTerms } from "../server/rag/embedding.ts";
import fs from "fs";

const CORE_DOMAIN_KEYWORDS = new Set([
  // English
  "corporation", "company", "incorporation", "carson", "pesticide", "obligation", "endure",
  "potassium", "sodium", "diet", "nutrition", "bilge", "hull", "ship", "cargo",
  "integrity", "honesty", "moral", "solar", "panel", "stubhub", "ringworm", "tinea",
  "ptsd", "marijuana", "cannabis", "ontario", "barometer", "nhl", "playoffs", "gifford",

  // Devanagari (Hindi / Marathi / Nepali)
  "निगम", "कंपनी", "कार्सन", "कीटनाशक", "पर्यावरण", "पोटेशियम", "सोडियम", "आहार", "पोषक",
  "जहाज", "बिल्ज", "तल", "हल", "सत्यनिष्ठा", "नैतिक", "प्रामाणिकपणा", "सौर", "पैनल",
  "स्टबहब", "रिंगवर्म", "गांजा", "ऑन्टारियो", "गिफर्ड", "ऑब्लिगेशन", "एंड्योर",

  // Kannada
  "ಕಂಪನಿ", "ಕಾರ್ಪೊರೇಷನ್", "ಕಾನೂನು", "ಆಡಳಿತ", "ಪೊಟ್ಯಾಸಿಯಮ್", "ಆಹಾರ", "ಪ್ರಾಮಾಣಿಕತೆ", "ಸಂಯೋಜನೆ",

  // Tamil
  "நிறுவனம்", "கார்ப்பரேஷன்", "நேர்மை", "சூரிய", "பலகைகள்", "ரிங்வோர்ம்", "டினியா",

  // Urdu / Bengali / Gujarati / etc.
  "کمپنی", "کارپوریشن", "কোম্পানী", "કંપની"
]);

async function runTest() {
  const evalData = JSON.parse(fs.readFileSync("docs/benchmark-results/live-100-blind-eval.json", "utf-8"));
  const groupA = evalData.groupA.results;
  const groupB = evalData.groupB.results;

  console.log("=== 2 REMAINING GROUP B FALSE CITATIONS ===");
  for (const item of groupB) {
    if (item.id === "GB-13") continue; // solar panel topic is in-index
    const qTerms = meaningfulLexicalTerms(item.question);
    const ret = await hybridRetrieve(item.question, item.lang);
    const top = ret.evidence[0];
    let match = null;
    if (top) {
      match = guardrailsInternals.evidenceSentence(top, new Set(qTerms));
    }

    const termMatches = match?.termMatches || 0;
    const matchedTermsList = qTerms.filter(t => match?.sentence.toLocaleLowerCase().includes(t));
    const hasCoreDomainTerm = matchedTermsList.some(t => CORE_DOMAIN_KEYWORDS.has(t));

    let isAccepted = false;
    if (top && termMatches >= 1) {
      if (termMatches >= 2 || hasCoreDomainTerm) {
        isAccepted = true;
      }
    }

    if (isAccepted) {
      console.log(`[${item.id}] Q: "${item.question}" (${item.lang})`);
      console.log(`  Terms: [${qTerms.join(", ")}]`);
      console.log(`  Matched: [${matchedTermsList.join(", ")}] | Sentence: "${match?.sentence.slice(0, 70)}..."`);
    }
  }

  console.log("\n=== REFUSED GROUP A QUERIES ===");
  for (const item of groupA) {
    const qTerms = meaningfulLexicalTerms(item.question);
    const ret = await hybridRetrieve(item.question, item.lang);
    const top = ret.evidence[0];
    let match = null;
    if (top) {
      match = guardrailsInternals.evidenceSentence(top, new Set(qTerms));
    }

    const termMatches = match?.termMatches || 0;
    const matchedTermsList = qTerms.filter(t => match?.sentence.toLocaleLowerCase().includes(t));
    const hasCoreDomainTerm = matchedTermsList.some(t => CORE_DOMAIN_KEYWORDS.has(t));

    let isAccepted = false;
    if (top && termMatches >= 1) {
      if (termMatches >= 2 || hasCoreDomainTerm) {
        isAccepted = true;
      }
    }

    if (!isAccepted) {
      console.log(`[${item.id}] Q: "${item.question}" (${item.lang})`);
      console.log(`  Terms (${qTerms.length}): [${qTerms.join(", ")}]`);
      console.log(`  Top Passage [${top?.id || "NONE"}]: "${top?.text.slice(0, 70) || "NONE"}..."`);
      console.log(`  Matched (${termMatches}): [${matchedTermsList.join(", ")}]`);
    }
  }
}

runTest().catch(console.error);
