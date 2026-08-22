import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { verifyAndSynthesize, guardrailsInternals } from "../server/rag/guardrails.ts";
import { meaningfulLexicalTerms } from "../server/rag/embedding.ts";
import fs from "fs";

const evalData = JSON.parse(fs.readFileSync("docs/benchmark-results/live-100-blind-eval.json", "utf-8"));
const groupAResults = evalData.groupA.results;
const refusedGA = groupAResults.filter(r => r.isRefused || r.answerStatus === "REFUSED");

async function check() {
  console.log(`=== FULL BREAKDOWN OF ALL ${refusedGA.length} REFUSED GROUP A QUERIES ===\n`);
  for (let i = 0; i < refusedGA.length; i++) {
    const item = refusedGA[i];
    const qTerms = meaningfulLexicalTerms(item.question);
    const ret = await hybridRetrieve(item.question, item.lang);
    const ans = verifyAndSynthesize(item.question, ret.evidence, ret.scores, item.lang);
    const topChunk = ret.evidence[0];
    const topScore = topChunk ? ret.scores.get(topChunk.id) || 0 : 0;
    
    let match = null;
    if (topChunk) {
      match = guardrailsInternals.evidenceSentence(topChunk, new Set(qTerms));
    }

    console.log(`[${i + 1}/${refusedGA.length}] ID: ${item.id} (${item.lang}) | MSMARCO qid: ${item.msmarcoQid}`);
    console.log(`  Query: "${item.question}"`);
    console.log(`  Extracted Terms (${qTerms.length}): [${qTerms.join(", ")}]`);
    console.log(`  Retrieved Mode: ${ret.mode} | Passage ID: ${topChunk?.id || "NONE"}`);
    console.log(`  Passage Text: "${topChunk?.text.slice(0, 100) || "NONE"}..."`);
    console.log(`  Sentence Match (${match?.termMatches || 0} terms): "${match?.sentence.slice(0, 100) || "NONE"}"`);
    console.log(`  Dense/Combined Score: ${topScore.toFixed(4)}`);
    console.log(`  Answer Status: ${ans.status} | Reason: ${ans.refusalReason}`);
    console.log("");
  }
}

check().catch(console.error);
