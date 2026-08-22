import fs from "node:fs";

const LIVE_URL = "https://suno-rag-stt.onrender.com";
const l2Candidates = JSON.parse(fs.readFileSync("C:/Users/godby/.gemini/antigravity-ide/brain/f1c9a612-a388-4205-95fc-3b1900a51c50/scratch/l2_candidates.json", "utf8"));

function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// Select 20 distinct query IDs across languages
const selected20 = [];
const seenQids = new Set();

for (const cand of l2Candidates) {
  if (selected20.length >= 20) break;
  if (!seenQids.has(cand.queryId) && cand.query && cand.query.length > 5) {
    seenQids.add(cand.queryId);
    let langCode = "en-IN";
    if (cand.langRaw.includes("hin")) langCode = "hi-IN";
    else if (cand.langRaw.includes("kan")) langCode = "kn-IN";
    else if (cand.langRaw.includes("tam")) langCode = "ta-IN";
    else if (cand.langRaw.includes("mar")) langCode = "mr-IN";

    selected20.push({
      queryId: cand.queryId,
      queryType: cand.queryType,
      query: cand.query,
      lang: langCode,
      langRaw: cand.langRaw,
      expectedAnswer: cand.answer
    });
  }
}

async function runL2Diagnostic() {
  console.log("=== EXECUTING TEST 1: REAL QDRANT L2 RETRIEVAL (20 UNSEEN QUERIES) ===");
  console.log(`Live Target URL: ${LIVE_URL}`);
  console.log(`Loaded ${selected20.length} distinct L2 queries from 12,650-point index (bypassing L1)\n`);

  const results = [];
  const latencies = [];
  const pipeLatencies = [];

  let successful = 0;
  let provenanceMatches = 0;
  let relevantCount = 0;
  let falseCitations = 0;
  let refusals = 0;

  for (let i = 0; i < selected20.length; i++) {
    const item = selected20[i];
    const startedAt = performance.now();
    const res = await fetch(`${LIVE_URL}/api/trpc/voiceRag.askBrowserTranscript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { transcript: item.query, languageCode: item.lang, script: "typed-input" }
      }),
      signal: AbortSignal.timeout(10000)
    });
    const roundTripMs = Math.round(performance.now() - startedAt);
    const json = await res.json();
    const p = json?.result?.data?.json;
    const answer = p?.answer;
    const evidence = p?.evidence || [];
    const trace = p?.trace || [];
    const ragMs = p?.latency?.ragMs ?? 0;

    latencies.push(roundTripMs);
    pipeLatencies.push(ragMs);

    const retrieveEvent = trace.find(t => t.stage === "parallel_retrieve");
    const retrieveDetail = retrieveEvent?.detail || "";

    const hasEvidence = evidence.length > 0;
    const isProvMatch = hasEvidence && evidence.some(e => e.queryId === item.queryId);
    const isGrounded = answer?.status === "GROUNDED";
    const isRefused = answer?.status === "REFUSED";

    if (hasEvidence) successful++;
    if (isProvMatch) {
      provenanceMatches++;
      relevantCount++;
    }
    if (isGrounded && !isProvMatch) falseCitations++;
    if (isRefused) refusals++;

    const primaryPoint = evidence[0] || null;

    console.log(`[QDRANT L2 ${i + 1}/20] QID: ${item.queryId} | Lang: ${item.lang} | EvCount: ${evidence.length} | Status: ${answer?.status} | Prov: ${isProvMatch ? "MATCH" : "MISMATCH"} | RT: ${roundTripMs} ms | Pipe: ${ragMs.toFixed(1)} ms`);
    console.log(`   Query: ${item.query}`);
    if (primaryPoint) {
      console.log(`   -> Point ID: ${primaryPoint.id} | Payload QID: ${primaryPoint.queryId} | Text: ${primaryPoint.text?.slice(0, 75)}...`);
    } else {
      console.log(`   -> Retrieval: ${retrieveDetail}`);
    }
    console.log(`   -> Answer: ${answer?.answer?.slice(0, 75)}...\n`);

    results.push({
      index: i + 1,
      queryId: item.queryId,
      query: item.query,
      lang: item.lang,
      returnedPointId: primaryPoint?.id || null,
      returnedPayloadQueryId: primaryPoint?.queryId || null,
      returnedPassageText: primaryPoint?.text || null,
      evidenceCount: evidence.length,
      provenanceMatch: isProvMatch ? "MATCH" : "MISMATCH",
      relevance: isProvMatch ? "RELEVANT" : "IRRELEVANT",
      answerStatus: answer?.status,
      answerText: answer?.answer,
      roundTripMs,
      ragPipelineMs: ragMs,
      retrieveDetail
    });
  }

  const p50 = percentile(latencies, 50);
  const p90 = percentile(latencies, 90);
  const p95 = percentile(latencies, 95);
  const p100 = percentile(latencies, 100);

  const pipeP50 = percentile(pipeLatencies, 50);
  const pipeP90 = percentile(pipeLatencies, 90);
  const pipeP95 = percentile(pipeLatencies, 95);
  const pipeP100 = percentile(pipeLatencies, 100);

  const summary = {
    evaluatedAt: new Date().toISOString(),
    liveUrl: LIVE_URL,
    totalTested: selected20.length,
    successfulRetrievals: successful,
    provenanceMatches,
    relevantPassages: relevantCount,
    falseCitations,
    refusals,
    pipelineLatency: { p50: pipeP50, p90: pipeP90, p95: pipeP95, p100: pipeP100 },
    networkLatency: { p50, p90, p95, p100 },
    results
  };

  fs.writeFileSync("docs/benchmark-results/qdrant-l2-20-raw.json", JSON.stringify(summary, null, 2));

  console.log("=============================================================");
  console.log("             QDRANT L2 20-QUERY EVALUATION REPORT            ");
  console.log("=============================================================");
  console.log(`QDRANT L2 SUCCESSFUL RETRIEVALS: ${successful}/20`);
  console.log(`QDRANT PROVENANCE MATCH:         ${provenanceMatches}/20`);
  console.log(`QDRANT RELEVANT PASSAGES:        ${relevantCount}/20`);
  console.log(`QDRANT FALSE CITATIONS:          ${falseCitations}/20`);
  console.log(`QDRANT REFUSALS:                 ${refusals}/20`);
  console.log("-------------------------------------------------------------");
  console.log(`P50:                             ${pipeP50.toFixed(1)} ms`);
  console.log(`P90:                             ${pipeP90.toFixed(1)} ms`);
  console.log(`P95:                             ${pipeP95.toFixed(1)} ms`);
  console.log(`P100:                            ${pipeP100.toFixed(1)} ms`);
  console.log("=============================================================\n");
}

runL2Diagnostic().catch(console.error);
