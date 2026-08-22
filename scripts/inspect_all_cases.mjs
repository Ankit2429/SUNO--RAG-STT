import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { verifyAndSynthesize, guardrailsInternals } from "../server/rag/guardrails.ts";
import { meaningfulLexicalTerms, embedText } from "../server/rag/embedding.ts";
import fs from "fs";

const evalData = JSON.parse(fs.readFileSync("docs/benchmark-results/live-100-blind-eval.json", "utf-8"));
const groupAResults = evalData.groupA.results;
const groupBResults = evalData.groupB.results;

const refusedGA = groupAResults.filter(r => r.isRefused || r.answerStatus === "REFUSED");
const falsePositiveGB = groupBResults.filter(r => r.isHallucination || r.answerStatus === "GROUNDED");

async function analyze() {
  console.log(`=== ANALYZING ${refusedGA.length} REFUSED GROUP A QUERIES ===\n`);
  for (const item of refusedGA) {
    const qTerms = meaningfulLexicalTerms(item.question);
    const ret = await hybridRetrieve(item.question, item.lang);
    const ans = verifyAndSynthesize(item.question, ret.evidence, ret.scores, item.lang);
    const topChunk = ret.evidence[0];
    const topScore = topChunk ? ret.scores.get(topChunk.id) || 0 : 0;
    
    let match = null;
    if (topChunk) {
      match = guardrailsInternals.evidenceSentence(topChunk, new Set(qTerms));
    }

    console.log(`ID: ${item.id} (${item.lang})`);
    console.log(`Query: "${item.question}"`);
    console.log(`Extracted Terms (${qTerms.length}): [${qTerms.join(", ")}]`);
    console.log(`Retrieved Passage [${topChunk?.id || "NONE"}]: "${topChunk?.text.slice(0, 80)}..."`);
    console.log(`Lexical Overlap (${match?.termMatches || 0}): "${match?.sentence.slice(0, 80) || "NONE"}"`);
    console.log(`Dense Score: ${topScore.toFixed(4)}`);
    console.log(`Status: ${ans.status} | Reason: ${ans.refusalReason}`);
    console.log(`--------------------------------------------------\n`);
  }

  console.log(`=== ANALYZING ${falsePositiveGB.length} FALSE-POSITIVE GROUP B QUERIES ===\n`);
  for (const item of falsePositiveGB) {
    const qTerms = meaningfulLexicalTerms(item.question);
    const ret = await hybridRetrieve(item.question, item.lang);
    const ans = verifyAndSynthesize(item.question, ret.evidence, ret.scores, item.lang);
    const topChunk = ret.evidence[0];
    const topScore = topChunk ? ret.scores.get(topChunk.id) || 0 : 0;

    let match = null;
    if (topChunk) {
      match = guardrailsInternals.evidenceSentence(topChunk, new Set(qTerms));
    }

    console.log(`ID: ${item.id} (${item.lang})`);
    console.log(`Query: "${item.question}"`);
    console.log(`Extracted Terms (${qTerms.length}): [${qTerms.join(", ")}]`);
    console.log(`Retrieved Passage [${topChunk?.id || "NONE"}]: "${topChunk?.text.slice(0, 80)}..."`);
    console.log(`Lexical Overlap (${match?.termMatches || 0}): "${match?.sentence.slice(0, 80) || "NONE"}"`);
    console.log(`Dense Score: ${topScore.toFixed(4)}`);
    console.log(`Status: ${ans.status} | Answer: "${ans.answer.slice(0, 80)}"`);
    console.log(`--------------------------------------------------\n`);
  }
}

analyze().catch(console.error);
