import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { verifyAndSynthesize, guardrailsInternals } from "../server/rag/guardrails.ts";
import { meaningfulLexicalTerms } from "../server/rag/embedding.ts";

const GROUP_A_QUERIES = [
  { id: "GA-1", q: "निगम का मुख्य उद्देश्य क्या होता है?", lang: "hi-IN" },
  { id: "GA-2", q: "ऑब्लिगेशन टू एंड्योर निबंध में किस समस्या पर चेतावनी दी गई है?", lang: "hi-IN" },
  { id: "GA-3", q: "स्वास्थ्य आहार में पोटेशियम और सोडियम की भूमिका क्या है?", lang: "hi-IN" },
  { id: "GA-4", q: "जहाज के निचले हिस्से या हल का क्या महत्व है?", lang: "hi-IN" },
  { id: "GA-5", q: "इंटीग्रिटी शब्द का नैतिक और आचरण के संदर्भ में अर्थ स्पष्ट करें।", lang: "hi-IN" },
  { id: "GA-6", q: "रिंगवर्म बीमारी किस प्रकार के संक्रमण के कारण होती है?", lang: "hi-IN" },
  { id: "GA-7", q: "स्टबहब कस्टमर सर्विस का संपर्क विवरण क्या है?", lang: "hi-IN" },
  { id: "GA-8", q: "फ्रैंक गिफर्ड की मुख्य उपलब्धियां क्या थीं?", lang: "hi-IN" },
  { id: "GA-9", q: "सौर ऊर्जा प्रणाली प्रतिदिन औसतन कितने घंटे आउटपुट प्रदान करती है?", lang: "hi-IN" },
  { id: "GA-10", q: "निगम किस प्रकार अस्तित्व में आता है?", lang: "hi-IN" }
];

async function check() {
  console.log("=== CHECKING GROUP A QUERIES ===");
  for (const item of GROUP_A_QUERIES) {
    const terms = meaningfulLexicalTerms(item.q);
    const ret = await hybridRetrieve(item.q, item.lang);
    const ans = verifyAndSynthesize(item.q, ret.evidence, ret.scores, item.lang);
    const top = ret.evidence[0];
    const topScore = top ? ret.scores.get(top.id) || 0 : 0;
    
    let matchCount = 0;
    if (top) {
      const match = guardrailsInternals.evidenceSentence(top, new Set(terms));
      matchCount = match?.termMatches || 0;
    }

    console.log(`[${item.id}] Status: ${ans.status} | Terms (${terms.length}): [${terms.join(", ")}] | Top Matches: ${matchCount} | Score: ${topScore.toFixed(2)}`);
  }
}

check().catch(console.error);
