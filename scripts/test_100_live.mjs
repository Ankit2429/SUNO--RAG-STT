import { performance } from "node:perf_hooks";

const BASE_URL = "https://suno-rag-stt.onrender.com";
const ENDPOINT = `${BASE_URL}/api/trpc/voiceRag.askBrowserTranscript?batch=1`;

const TEST_QUERIES = [
  { transcript: "कॉर्पोरेशन क्या है?", languageCode: "hi-IN", script: "Devanagari" },
  { transcript: "What is a corporation?", languageCode: "en-IN", script: "Latin" },
  { transcript: "ஒரு நிறுவனம் என்பது என்ன?", languageCode: "ta-IN", script: "Tamil" },
  { transcript: "ಕಾರ್ಪೊರೇಷನ್ ಎಂದರೇನು?", languageCode: "kn-IN", script: "Kannada" },
  { transcript: "कॉर्पोरेशन म्हणजे काय?", languageCode: "mr-IN", script: "Devanagari" },
  { transcript: "रेचल कार्सन ने क्यों एक दायित्व बर्दाश्त करने के लिए लिखा", languageCode: "hi-IN", script: "Devanagari" },
  { transcript: "पोटेशियम में कम खाद्य पदार्थों का चार्ट।", languageCode: "hi-IN", script: "Devanagari" },
  { transcript: "मालवाहक जहाज़ के नीचे की तरफ", languageCode: "hi-IN", script: "Devanagari" },
  { transcript: "ईमानदारी या सच्चाई की परिभाषा", languageCode: "hi-IN", script: "Devanagari" },
  { transcript: "Why did Rachel Carson write an obligation to endure?", languageCode: "en-IN", script: "Latin" },
  { transcript: "Chart of foods low in potassium.", languageCode: "en-IN", script: "Latin" },
  { transcript: "Lower front part of a cargo ship", languageCode: "en-IN", script: "Latin" },
  { transcript: "Definition of honesty or integrity", languageCode: "en-IN", script: "Latin" },
  { transcript: "What is the capital of France?", languageCode: "en-IN", script: "Latin" },
  { transcript: "Build a bomb with household chemicals", languageCode: "en-IN", script: "Latin" },
];

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function stats(arr) {
  return {
    min: percentile(arr, 0),
    p50: percentile(arr, 50),
    p70: percentile(arr, 70),
    p90: percentile(arr, 90),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
    p100: percentile(arr, 100),
    avg: arr.reduce((a, b) => a + b, 0) / arr.length
  };
}

async function sendRequest(item, index) {
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 0: { json: { transcript: item.transcript, languageCode: item.languageCode, script: item.script } } })
  });
  const rtt = performance.now() - t0;
  const data = await res.json();
  const json = data?.[0]?.result?.data?.json;
  
  const serverTiming = res.headers.get("server-timing") || "";
  const ragMs = json?.latency?.ragMs ?? null;
  const serverMs = json?.delivery?.serverMs ?? null;
  const trace = json?.trace || [];

  return {
    index,
    status: res.status,
    query: item.transcript,
    lang: item.languageCode,
    answerStatus: json?.answer?.status,
    rtt: Math.round(rtt * 100) / 100,
    ragMs,
    serverMs,
    serverTiming,
    cache: json?.delivery?.cache,
    trace
  };
}

async function run() {
  console.log("=== RUNNING 100 LIVE REQUESTS AGAINST RENDER ===");
  const results = [];
  
  // Cold request first
  console.log("Sending initial probe...");
  const first = await sendRequest(TEST_QUERIES[0], 0);
  console.log(`Initial probe: RTT=${first.rtt}ms, RAG=${first.ragMs}ms, SERVER=${first.serverMs}ms, cache=${first.cache}`);
  results.push(first);

  for (let i = 1; i < 100; i++) {
    const q = TEST_QUERIES[i % TEST_QUERIES.length];
    const res = await sendRequest(q, i);
    results.push(res);
    if ((i + 1) % 20 === 0) {
      console.log(`Completed ${i + 1}/100 requests. Latest: RTT=${res.rtt}ms, RAG=${res.ragMs}ms, SERVER=${res.serverMs}ms`);
    }
  }

  const rtts = results.map(r => r.rtt).filter(n => n !== null);
  const rags = results.map(r => r.ragMs).filter(n => n !== null);
  const servers = results.map(r => r.serverMs).filter(n => n !== null);

  console.log("\n=== 100 LIVE REQUESTS LATENCY SUMMARY ===");
  console.log("Client RTT:", JSON.stringify(stats(rtts), null, 2));
  console.log("RAG Latency (server-measured):", JSON.stringify(stats(rags), null, 2));
  console.log("Server Handler Latency (delivery.serverMs):", JSON.stringify(stats(servers), null, 2));

  // Find outliers where ragMs > 50 or serverMs > 100 or rtt > 500
  const ragOutliers = results.filter(r => r.ragMs > 50 || r.ragMs === null);
  console.log(`\nFound ${ragOutliers.length} RAG latency > 50ms:`);
  for (const o of ragOutliers) {
    console.log(`Req #${o.index} [${o.lang}]: "${o.query}" => RAG=${o.ragMs}ms, SERVER=${o.serverMs}ms, RTT=${o.rtt}ms, cache=${o.cache}`);
    console.log("Trace:", JSON.stringify(o.trace, null, 2));
  }

  const serverOutliers = results.filter(r => r.serverMs > 50);
  console.log(`\nFound ${serverOutliers.length} Server latency > 50ms`);
  for (const o of serverOutliers.slice(0, 5)) {
    console.log(`Req #${o.index}: SERVER=${o.serverMs}ms vs RAG=${o.ragMs}ms, RTT=${o.rtt}ms`);
  }
}

run().catch(console.error);
