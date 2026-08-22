import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { verifyAndSynthesize, guardrailsInternals } from "../server/rag/guardrails.ts";
import { meaningfulLexicalTerms } from "../server/rag/embedding.ts";

async function run() {
  const q = "जहाज के निचले हिस्से या हल का क्या महत्व है?";
  const lang = "hi-IN";
  
  console.log("Query:", q);
  const terms = meaningfulLexicalTerms(q);
  console.log("Meaningful terms:", terms);
  const ret = await hybridRetrieve(q, lang);
  console.log("Evidence returned count:", ret.evidence.length);
  for (const e of ret.evidence) {
    console.log(`- [${e.id}] [queryId:${e.queryId}] score:${ret.scores.get(e.id)} text: "${e.text.slice(0, 70)}..."`);
  }

  const minRequiredMatches = terms.length >= 3 ? 2 : 1;
  console.log("minRequiredMatches:", minRequiredMatches);

  const supported = ret.evidence.map(chunk => {
    const match = guardrailsInternals.evidenceSentence(chunk, new Set(terms));
    return { chunk, match, score: ret.scores.get(chunk.id) ?? 0 };
  });

  console.log("Supported candidates:");
  for (const s of supported) {
    console.log(`  - [${s.chunk.id}] termMatches: ${s.match?.termMatches || 0} (sentence: "${s.match?.sentence || "NONE"}")`);
  }

  const ans = verifyAndSynthesize(q, ret.evidence, ret.scores, lang);
  console.log("\nSynthesized Answer:", JSON.stringify(ans, null, 2));
}

run().catch(console.error);
