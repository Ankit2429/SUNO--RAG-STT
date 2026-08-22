import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { verifyAndSynthesize, guardrailsInternals } from "../server/rag/guardrails.ts";
import { meaningfulLexicalTerms } from "../server/rag/embedding.ts";
import fs from "fs";

const evalData = JSON.parse(fs.readFileSync("docs/benchmark-results/live-100-blind-eval.json", "utf-8"));
const groupB = evalData.groupB.results;
const falsePositives = groupB.filter(r => r.answerStatus === "GROUNDED");

async function check() {
  console.log(`=== ANALYZING ${falsePositives.length} GROUNDED GROUP B QUERIES ===\n`);
  for (const item of falsePositives) {
    const qTerms = meaningfulLexicalTerms(item.question);
    const ret = await hybridRetrieve(item.question, item.lang);
    const ans = verifyAndSynthesize(item.question, ret.evidence, ret.scores, item.lang);
    const topChunk = ret.evidence[0];
    const topScore = topChunk ? ret.scores.get(topChunk.id) || 0 : 0;
    let match = null;
    if (topChunk) {
      match = guardrailsInternals.evidenceSentence(topChunk, new Set(qTerms));
    }

    console.log(`[${item.id}] Q: "${item.question}" (${item.lang})`);
    console.log(`  Extracted Terms (${qTerms.length}): [${qTerms.join(", ")}]`);
    console.log(`  Top Passage [${topChunk?.id || "NONE"}]: "${topChunk?.text.slice(0, 80)}..."`);
    console.log(`  Sentence Match (${match?.termMatches || 0} terms): "${match?.sentence.slice(0, 80) || "NONE"}"`);
    console.log(`  Matched Term List: [${qTerms.filter(t => match?.sentence.toLocaleLowerCase().includes(t)).join(", ")}]`);
    console.log(`--------------------------------------------------\n`);
  }
}

check().catch(console.error);
