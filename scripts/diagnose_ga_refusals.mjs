import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { verifyAndSynthesize, guardrailsInternals } from "../server/rag/guardrails.ts";
import { meaningfulLexicalTerms } from "../server/rag/embedding.ts";

const REFUSED_QUERIES = [
  { id: "GA-6", qid: "1060386", q: "बैरोमीटर में पारे का स्तर वायुमंडलीय दबाव से कैसे बदलता है?", lang: "hi-IN" },
  { id: "GA-17", qid: "168868", q: "ಪಿಟಿಎಸ್ಡಿ (PTSD) ರೋಗಿಗಳಿಗೆ ಗಾಂಜಾ ಸಹಾಯ ಮಾಡುತ್ತದೆ ಎಂಬ ಸಂಶೋಧನೆ ಎಲ್ಲಿದೆ?", lang: "kn-IN" },
  { id: "GA-20", qid: "166290", q: "ರಿಂಗ್ವರ್ಮ್ ಶಿಲೀಂಧ್ರವು ಮನುಷ್ಯರಲ್ಲಿ ಹೇಗೆ ಹರಡುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GA-27", qid: "168868", q: "கனடா ஆராய்ச்சியின் படி PTSD பாதிப்புக்கு தீர்வு என்ன?", lang: "ta-IN" },
  { id: "GA-34", qid: "55665", q: "जहाजाच्या तळाशी पाणी साचणाऱ्या भागाला काय म्हणतात?", lang: "mr-IN" },
  { id: "GA-40", qid: "166290", q: "ट्रायकोफायटन रुब्रम बुरशीमुळे कोणता आजार होतो?", lang: "mr-IN" }
];

async function check() {
  for (const item of REFUSED_QUERIES) {
    console.log(`=== [${item.id}] qid:${item.qid} lang:${item.lang} ===`);
    console.log(`Query: "${item.q}"`);
    const terms = meaningfulLexicalTerms(item.q);
    console.log(`Terms extracted (${terms.length}): [${terms.join(", ")}]`);

    const ret = await hybridRetrieve(item.q, item.lang);
    console.log(`Retrieved candidates (${ret.evidence.length}) mode:${ret.mode}`);

    for (let i = 0; i < ret.evidence.length; i++) {
      const chunk = ret.evidence[i];
      const score = ret.scores.get(chunk.id) || 0;
      const match = guardrailsInternals.evidenceSentence(chunk, new Set(terms));
      console.log(`  Candidate ${i + 1} [id:${chunk.id} qid:${chunk.queryId} score:${score.toFixed(4)}]:`);
      console.log(`    Passage text: "${chunk.text.slice(0, 100)}..."`);
      console.log(`    Best Sentence Match (${match?.termMatches || 0} terms): "${match?.sentence || "NONE"}"`);
    }

    const ans = verifyAndSynthesize(item.q, ret.evidence, ret.scores, item.lang);
    console.log(`Answer Status: ${ans.status} | Reason: ${ans.refusalReason}`);
    console.log("--------------------------------------------------\n");
  }
}

check().catch(console.error);
