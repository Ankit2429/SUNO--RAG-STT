import fs from "node:fs";

const LIVE_URL = "https://suno-rag-stt.onrender.com";
const l2Candidates = JSON.parse(fs.readFileSync("C:/Users/godby/.gemini/antigravity-ide/brain/f1c9a612-a388-4205-95fc-3b1900a51c50/scratch/l2_candidates.json", "utf8"));

function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// Select 20 distinct query IDs across Hindi, Kannada, Tamil, Marathi, and English
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

console.log(`Selected ${selected20.length} distinct L2 queries not in HOT_CORPUS.`);

async function queryLiveQdrant(transcript, languageCode) {
  const url = `${LIVE_URL}/api/trpc/voiceRag.askBrowserTranscript`;
  const startedAt = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { transcript, languageCode, script: "typed-input" }
      }),
      signal: AbortSignal.timeout(10000)
    });
    const roundTripMs = Math.round(performance.now() - startedAt);
    if (!res.ok) {
      return { httpStatus: res.status, ok: false, roundTripMs, payload: null, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { httpStatus: res.status, ok: true, roundTripMs, payload: json?.result?.data?.json };
  } catch (err) {
    const roundTripMs = Math.round(performance.now() - startedAt);
    return { httpStatus: 0, ok: false, roundTripMs, payload: null, error: err.message };
  }
}

async function runL2Diagnostic() {
  console.log("=== EXECUTING TEST 1: REAL QDRANT L2 RETRIEVAL (20 UNSEEN QUERIES) ===");
  console.log(`Live Target URL: ${LIVE_URL}\n`);

  const results = [];
  const latencies = [];
  const pipeLatencies = [];

  let successful = 0;
  let provenanceMatches = 0;
  let incorrect = 0;
  let timeouts = 0;

  for (let i = 0; i < selected20.length; i++) {
    const item = selected20[i];
    const res = await queryLiveQdrant(item.query, item.lang);
    const p = res.payload;
    const answerStatus = p?.answer?.status || "ERROR";
    const answerText = p?.answer?.answer || "";
    const evidence = p?.evidence || [];
    const trace = p?.trace || [];
    const ragMs = p?.latency?.ragMs ?? 0;

    latencies.push(res.roundTripMs);
    pipeLatencies.push(ragMs);

    const retrieveEvent = trace.find(t => t.stage === "parallel_retrieve");
    const retrieveDetail = retrieveEvent?.detail || "";

    const hasEvidence = evidence.length > 0;
    const isProvMatch = hasEvidence && evidence.some(e => e.queryId === item.queryId);
    const isTimeout = retrieveDetail.includes("timeout") || retrieveDetail.includes("timed out") || res.error?.includes("timeout");

    if (hasEvidence) successful++;
    if (isProvMatch) provenanceMatches++;
    if (hasEvidence && !isProvMatch) incorrect++;
    if (isTimeout) timeouts++;

    const primaryEvidence = evidence[0] || null;

    console.log(`[QDRANT L2 ${i + 1}/20] QID: ${item.queryId} | Status: ${answerStatus} | EvCount: ${evidence.length} | ProvMatch: ${isProvMatch ? "YES" : "NO"} | RT: ${res.roundTripMs} ms | Pipe: ${ragMs.toFixed(1)} ms`);
    if (primaryEvidence) {
      console.log(`   -> Point ID: ${primaryEvidence.id} | Ev QID: ${primaryEvidence.queryId} | Text: ${primaryEvidence.text?.slice(0, 80)}...`);
    }

    results.push({
      index: i + 1,
      queryId: item.queryId,
      queryText: item.query,
      lang: item.lang,
      httpStatus: res.httpStatus,
      answerStatus,
      answerText,
      evidenceCount: evidence.length,
      primaryPointId: primaryEvidence?.id || null,
      primaryPayloadQueryId: primaryEvidence?.queryId || null,
      primaryPassageText: primaryEvidence?.text || null,
      provenanceMatch: isProvMatch,
      roundTripMs: res.roundTripMs,
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
    incorrectRetrievals: incorrect,
    timeoutsOrErrors: timeouts,
    networkLatency: { p50, p90, p95, p100 },
    pipelineLatency: { p50: pipeP50, p90: pipeP90, p95: pipeP95, p100: pipeP100 },
    results
  };

  fs.writeFileSync("docs/benchmark-results/qdrant-l2-20-diagnostic.json", JSON.stringify(summary, null, 2));

  console.log("\n=============================================================");
  console.log("             QDRANT L2 DIAGNOSTIC SUMMARY                    ");
  console.log("=============================================================");
  console.log(`Real Queries Tested:   ${summary.totalTested}`);
  console.log(`Successful:            ${summary.successfulRetrievals}/${summary.totalTested}`);
  console.log(`Provenance Matches:    ${summary.provenanceMatches}/${summary.totalTested}`);
  console.log(`Incorrect/Failures:    ${summary.incorrectRetrievals}/${summary.totalTested}`);
  console.log(`Timeouts/Errors:       ${summary.timeoutsOrErrors}`);
  console.log("-------------------------------------------------------------");
  console.log(`PIPELINE P50:          ${pipeP50.toFixed(1)} ms`);
  console.log(`PIPELINE P90:          ${pipeP90.toFixed(1)} ms`);
  console.log(`PIPELINE P95:          ${pipeP95.toFixed(1)} ms`);
  console.log(`PIPELINE P100:         ${pipeP100.toFixed(1)} ms`);
  console.log("-------------------------------------------------------------");
  console.log(`PUBLIC NETWORK P50:    ${p50} ms`);
  console.log(`PUBLIC NETWORK P90:    ${p90} ms`);
  console.log(`PUBLIC NETWORK P95:    ${p95} ms`);
  console.log(`PUBLIC NETWORK P100:   ${p100} ms`);
  console.log("=============================================================\n");
}

runL2Diagnostic().catch(console.error);
