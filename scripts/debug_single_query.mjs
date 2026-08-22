import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { evaluateEvidenceGate } from "../server/rag/guardrails.ts";

async function debug() {
  const query = "What is the distance between Jupiter and Saturn in kilometers?";
  const lang = "en-IN";
  
  console.log("Query:", query);
  const retrieval = await hybridRetrieve(query, lang);
  console.log("\nRetrieval mode:", retrieval.mode);
  console.log("Evidence count:", retrieval.evidence.length);
  console.log("Evidence items:", retrieval.evidence.map(e => ({ id: e.id, text: e.text.slice(0, 80) })));

  const gate = evaluateEvidenceGate(retrieval.evidence, query, lang);
  console.log("\nGate decision:", gate.status, gate.answer ? gate.answer.slice(0, 100) : gate.refusalReason);
}

debug().catch(console.error);
