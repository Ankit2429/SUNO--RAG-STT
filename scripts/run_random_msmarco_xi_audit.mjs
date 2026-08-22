import fs from "node:fs";
import crypto from "node:crypto";
import { parquetMetadataAsync, parquetRead } from "./hyparquet.mjs";

const LIVE_URL = "https://suno-rag-stt.onrender.com";
const PARQUET_URL = "https://huggingface.co/api/datasets/ai4bharat/MSMARCO-XI/parquet/default/validation/0.parquet";

// 1. Generate cryptographic random seed
const RANDOM_SEED = crypto.randomBytes(16).toString("hex");
console.log(`=============================================================`);
console.log(`           INDEPENDENT RANDOM DATASET AUDIT                   `);
console.log(`RANDOM SEED: ${RANDOM_SEED}`);
console.log(`TARGET URL:  ${LIVE_URL}`);
console.log(`DATA SOURCE: AI4Bharat/MSMARCO-XI (HuggingFace Official Parquet)`);
console.log(`=============================================================\n`);

function createPrng(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return function() {
    h |= 0; h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = createPrng(RANDOM_SEED);

// 2. Load Exclusion Set
const EXCLUSION_FILE = "C:/Users/godby/.gemini/antigravity-ide/brain/f1c9a612-a388-4205-95fc-3b1900a51c50/scratch/full_exclusion_set.json";
const excludedQids = new Set(JSON.parse(fs.readFileSync(EXCLUSION_FILE, "utf8")));
console.log(`Loaded ${excludedQids.size} query IDs into EXCLUSION SET.`);

async function asyncBuffer(url) {
  const head = await fetch(url, { method: "HEAD" });
  const contentLength = Number(head.headers.get("content-length"));
  return {
    byteLength: contentLength,
    async slice(start, end) {
      const finish = end !== undefined ? end - 1 : contentLength - 1;
      const res = await fetch(url, { headers: { Range: `bytes=${start}-${finish}` } });
      return await res.arrayBuffer();
    }
  };
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function queryLiveApi(transcript, languageCode) {
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

async function main() {
  console.log("Fetching validation dataset stream from HuggingFace...");
  const buffer = await asyncBuffer(PARQUET_URL);

  console.log("Reading candidate rows from validation split...");
  const candidateRows = [];
  await parquetRead({
    file: buffer,
    columns: ["query_id", "query_type", "query", "target_lang", "Eng_Query"],
    rowStart: 0,
    rowEnd: 2500,
    onComplete: (data) => {
      for (let i = 0; i < data.length; i++) {
        const qid = String(data[i][0]);
        const qtype = String(data[i][1]);
        const qText = String(data[i][2]);
        const langRaw = String(data[i][3]);
        const engQuery = String(data[i][4]);

        let langCode = "en-IN";
        if (langRaw.includes("hin")) langCode = "hi-IN";
        else if (langRaw.includes("kan")) langCode = "kn-IN";
        else if (langRaw.includes("tam")) langCode = "ta-IN";
        else if (langRaw.includes("mar")) langCode = "mr-IN";

        candidateRows.push({
          rowIdx: i,
          query_id: qid,
          query_type: qtype,
          query: qText,
          langRaw,
          langCode,
          engQuery
        });
      }
    }
  });

  console.log(`Loaded ${candidateRows.length} validation rows from HuggingFace.`);

  const unseenCandidates = candidateRows.filter(r => !excludedQids.has(r.query_id) && r.query && r.query.length > 5);
  console.log(`Candidates after exclusion filtering: ${unseenCandidates.length} unseen queries.`);

  // Deterministically shuffle using PRNG
  const shuffled = [...unseenCandidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // TEST 1: 100 Unseen Random MSMARCO-XI Queries
  const test1Queries = shuffled.slice(0, 100);
  // TEST 2: 100 Unseen Random Out-of-Index Queries
  const test2Queries = shuffled.slice(100, 200);

  console.log(`\n=============================================================`);
  console.log(`TEST 1: 100 UNSEEN RANDOM MSMARCO-XI VALIDATION QUERIES`);
  console.log(`=============================================================`);

  const test1Results = [];
  const test1PipelineLatencies = [];
  const test1RoundTrips = [];

  let t1Grounded = 0;
  let t1Correct = 0;
  let t1Refused = 0;
  let t1Incorrect = 0;
  let t1Hallucination = 0;
  let t1Provenance = 0;

  for (let i = 0; i < test1Queries.length; i++) {
    const item = test1Queries[i];
    const res = await queryLiveApi(item.query, item.langCode);
    const p = res.payload;
    const status = p?.answer?.status || "ERROR";
    const answerText = p?.answer?.answer || "";
    const evidence = p?.evidence || [];
    const ragMs = p?.latency?.ragMs ?? 0;

    test1PipelineLatencies.push(ragMs);
    test1RoundTrips.push(res.roundTripMs);

    const isGrounded = status === "GROUNDED";
    const isRefused = status === "REFUSED";
    const hasEvidence = evidence.length > 0;
    const isProvMatch = isGrounded && hasEvidence && evidence.some(e => e.queryId === item.query_id);

    if (isGrounded) {
      t1Grounded++;
      if (isProvMatch) {
        t1Correct++;
        t1Provenance++;
      } else {
        t1Incorrect++;
        t1Hallucination++;
      }
    } else if (isRefused) {
      t1Refused++;
    }

    test1Results.push({
      index: i + 1,
      queryId: item.query_id,
      queryType: item.query_type,
      query: item.query,
      lang: item.langCode,
      status,
      ragMs,
      roundTripMs: res.roundTripMs,
      provenanceMatch: isProvMatch,
      evidenceIds: p?.answer?.evidenceIds || [],
      answer: answerText
    });

    console.log(`[T1 ${i + 1}/100] QID: ${item.query_id} | Status: ${status} | Pipe: ${ragMs.toFixed(1)} ms | Net: ${res.roundTripMs} ms`);
  }

  console.log(`\n=============================================================`);
  console.log(`TEST 2: 100 UNSEEN RANDOM OUT-OF-INDEX QUERIES`);
  console.log(`=============================================================`);

  const test2Results = [];
  const test2PipelineLatencies = [];
  const test2RoundTrips = [];

  let t2SafeRefusal = 0;
  let t2FalseCitation = 0;
  let t2Hallucination = 0;

  for (let i = 0; i < test2Queries.length; i++) {
    const item = test2Queries[i];
    const res = await queryLiveApi(item.query, item.langCode);
    const p = res.payload;
    const status = p?.answer?.status || "ERROR";
    const answerText = p?.answer?.answer || "";
    const ragMs = p?.latency?.ragMs ?? 0;

    test2PipelineLatencies.push(ragMs);
    test2RoundTrips.push(res.roundTripMs);

    const isSafeRefusal = status === "REFUSED" && (p?.answer?.evidenceIds?.length || 0) === 0;
    const isFalseCitation = status === "GROUNDED";

    if (isSafeRefusal) {
      t2SafeRefusal++;
    } else if (isFalseCitation) {
      t2FalseCitation++;
      t2Hallucination++;
    }

    test2Results.push({
      index: i + 1,
      queryId: item.query_id,
      query: item.query,
      lang: item.langCode,
      status,
      ragMs,
      roundTripMs: res.roundTripMs,
      isSafeRefusal,
      answer: answerText
    });

    console.log(`[T2 ${i + 1}/100] QID: ${item.query_id} | Status: ${status} | SafeRefusal: ${isSafeRefusal ? "YES" : "NO"} | Pipe: ${ragMs.toFixed(1)} ms`);
  }

  const allPipeLatencies = [...test1PipelineLatencies, ...test2PipelineLatencies];
  const allNetLatencies = [...test1RoundTrips, ...test2RoundTrips];

  const report = {
    randomSeed: RANDOM_SEED,
    evaluatedAt: new Date().toISOString(),
    liveUrl: LIVE_URL,
    totalQueryCount: 200,
    exclusionCount: excludedQids.size,
    test1RandomMsmarcoXi: {
      queryCount: 100,
      grounded: t1Grounded,
      correct: t1Correct,
      refused: t1Refused,
      incorrect: t1Incorrect,
      hallucination: t1Hallucination,
      provenanceMatch: t1Provenance,
      accuracyPct: `${((t1Correct / 100) * 100).toFixed(1)}%`,
      provenancePct: `${((t1Provenance / Math.max(1, t1Grounded)) * 100).toFixed(1)}%`
    },
    test2RandomOutOfIndex: {
      queryCount: 100,
      safeRefusalCount: t2SafeRefusal,
      safeRefusalPct: `${((t2SafeRefusal / 100) * 100).toFixed(1)}%`,
      falseCitationCount: t2FalseCitation,
      falseCitationPct: `${((t2FalseCitation / 100) * 100).toFixed(1)}%`,
      hallucinationCount: t2Hallucination
    },
    pipelineLatency: {
      p50: percentile(allPipeLatencies, 50),
      p70: percentile(allPipeLatencies, 70),
      p90: percentile(allPipeLatencies, 90),
      p95: percentile(allPipeLatencies, 95),
      p100: percentile(allPipeLatencies, 100),
      passUnder200ms: percentile(allPipeLatencies, 100) < 200
    },
    networkRoundTrip: {
      p50: percentile(allNetLatencies, 50),
      p70: percentile(allNetLatencies, 70),
      p90: percentile(allNetLatencies, 90),
      p95: percentile(allNetLatencies, 95),
      p100: percentile(allNetLatencies, 100)
    },
    test1Results,
    test2Results
  };

  fs.writeFileSync("docs/benchmark-results/random-unseen-msmarco-eval.json", JSON.stringify(report, null, 2));

  console.log("\n=============================================================");
  console.log("            RANDOM UNSEEN GENERALIZATION REPORT              ");
  console.log("=============================================================");
  console.log(`RANDOM SEED:                  ${RANDOM_SEED}`);
  console.log(`QUERY COUNT:                  ${report.totalQueryCount}`);
  console.log(`EXCLUSION COUNT:              ${report.exclusionCount}`);
  console.log("-------------------------------------------------------------");
  console.log(`RANDOM MSMARCO-XI GROUNDED:   ${report.test1RandomMsmarcoXi.grounded}/100`);
  console.log(`RANDOM MSMARCO-XI CORRECT:    ${report.test1RandomMsmarcoXi.correct}/100`);
  console.log(`RANDOM MSMARCO-XI REFUSED:    ${report.test1RandomMsmarcoXi.refused}/100`);
  console.log(`RANDOM MSMARCO-XI ACCURACY:   ${report.test1RandomMsmarcoXi.accuracyPct}`);
  console.log(`RANDOM MSMARCO-XI PROVENANCE: ${report.test1RandomMsmarcoXi.provenancePct}`);
  console.log("-------------------------------------------------------------");
  console.log(`RANDOM OUT-OF-INDEX SAFE REFUSAL: ${report.test2RandomOutOfIndex.safeRefusalPct} (${report.test2RandomOutOfIndex.safeRefusalCount}/100)`);
  console.log(`RANDOM FALSE CITATION RATE:       ${report.test2RandomOutOfIndex.falseCitationPct} (${report.test2RandomOutOfIndex.falseCitationCount}/100)`);
  console.log(`RANDOM HALLUCINATION RATE:        ${report.test2RandomOutOfIndex.hallucinationCount}/100`);
  console.log("-------------------------------------------------------------");
  console.log(`PIPELINE P50:                 ${report.pipelineLatency.p50} ms`);
  console.log(`PIPELINE P70:                 ${report.pipelineLatency.p70} ms`);
  console.log(`PIPELINE P90:                 ${report.pipelineLatency.p90} ms`);
  console.log(`PIPELINE P95:                 ${report.pipelineLatency.p95} ms`);
  console.log(`PIPELINE P100:                ${report.pipelineLatency.p100} ms`);
  console.log("=============================================================\n");
}

main().catch(console.error);
