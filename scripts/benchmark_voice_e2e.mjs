import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const endpoint = process.env.VOICE_RAG_URL || "http://localhost:3000/api/trpc/voiceRag.ask";
const repetitions = Number(process.env.REPETITIONS || 20);

const fixtures = [
  { languageHint: "hi-IN", script: "Devanagari", path: "/home/ubuntu/voice-benchmark/hindi.wav" },
  { languageHint: "ta-IN", script: "Tamil", path: "/home/ubuntu/voice-benchmark/tamil.wav" },
  { languageHint: "te-IN", script: "Telugu", path: "/home/ubuntu/voice-benchmark/telugu.wav" },
  { languageHint: "bn-IN", script: "Bengali", path: "/home/ubuntu/voice-benchmark/bengali.wav" },
  { languageHint: "mr-IN", script: "Devanagari", path: "/home/ubuntu/voice-benchmark/marathi.wav" },
];

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

function summarize(values) {
  return {
    p50: percentile(values, 50),
    p70: percentile(values, 70),
    p100: percentile(values, 100),
    sampleCount: values.length,
  };
}

async function callVoiceRoute(fixture) {
  const audioBase64 = (await readFile(fixture.path)).toString("base64");
  const input = {
    json: { audioBase64, mimeType: "audio/wav", languageHint: fixture.languageHint },
  };
  const startedAt = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const applicationRoundTripMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const body = await response.json().catch(() => null);
  const run = body?.result?.data?.json;

  if (!response.ok || !run || run.answer?.status === "ERROR") {
    return { ok: false, fixture, applicationRoundTripMs, error: run?.answer?.refusalReason || `HTTP ${response.status}` };
  }

  return {
    ok: true,
    fixture,
    applicationRoundTripMs,
    serverEndToEndMs: run.latency?.endToEndMs,
    sttMs: run.latency?.sttMs,
    ragMs: run.latency?.ragMs,
    status: run.answer?.status,
  };
}

const calls = [];
for (let round = 0; round < repetitions; round += 1) {
  for (const fixture of fixtures) calls.push(callVoiceRoute(fixture));
}

const results = [];
for (const call of calls) {
  // Sequential replay prevents synthetic parallel pressure from invalidating a latency percentile.
  results.push(await call);
}

const successful = results.filter(result => result.ok);
const failed = results.filter(result => !result.ok);
const report = {
  benchmark: "controlled Sarvam voice-to-final-answer replay",
  fixtureLanguages: fixtures.map(fixture => fixture.languageHint),
  repetitionsPerLanguage: repetitions,
  requestCount: results.length,
  failureCount: failed.length,
  applicationRoundTripMs: summarize(successful.map(result => result.applicationRoundTripMs)),
  serverEndToEndMs: summarize(successful.map(result => result.serverEndToEndMs).filter(Number.isFinite)),
  sttMs: summarize(successful.map(result => result.sttMs).filter(Number.isFinite)),
  ragMs: summarize(successful.map(result => result.ragMs).filter(Number.isFinite)),
  statuses: successful.reduce((accumulator, result) => {
    accumulator[result.status] = (accumulator[result.status] || 0) + 1;
    return accumulator;
  }, {}),
  trials: results.map((result, index) => ({
    loop: index + 1,
    languageHint: result.fixture.languageHint,
    status: result.ok ? result.status : "ERROR",
    applicationRoundTripMs: result.applicationRoundTripMs,
    serverEndToEndMs: result.serverEndToEndMs ?? null,
    sttMs: result.sttMs ?? null,
    ragMs: result.ragMs ?? null,
    error: result.error ?? null,
  })),
  failures: failed.map(({ fixture, applicationRoundTripMs, error }) => ({ languageHint: fixture.languageHint, applicationRoundTripMs, error })),
  measuredAt: new Date().toISOString(),
  caveat: "Application round trip starts after the recorded audio fixture exists. It includes HTTP submission, server execution, Sarvam STT, vector retrieval, guardrails, and answer return, but not human recording time or remote user-to-host network distance.",
};

console.log(JSON.stringify(report, null, 2));
