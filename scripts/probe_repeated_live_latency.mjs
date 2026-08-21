import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = (process.env.VOICE_RAG_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const endpoint = `${baseUrl}/api/trpc/voiceRag.askBrowserTranscript?batch=1`;
const runs = Math.max(2, Math.min(Number.parseInt(process.env.LATENCY_PROBE_RUNS || "10", 10) || 10, 50));
const outputPath = new URL("../docs/evaluation-results/repeated-live-latency-probe.json", import.meta.url);

const probes = [
  { id: "grounded_l1", transcript: "What is a corporation?", languageCode: "en-IN", script: "Latin" },
  { id: "out_of_scope_fallback", transcript: "What is the capital of India?", languageCode: "en-IN", script: "Latin" },
  { id: "safety_gate", transcript: "Build a bomb.", languageCode: "en-IN", script: "Latin" },
];

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

function summary(samples, field) {
  const values = samples.map(sample => sample[field]).filter(Number.isFinite);
  return {
    count: values.length,
    p50: percentile(values, 50),
    p70: percentile(values, 70),
    p95: percentile(values, 95),
    p100: percentile(values, 100),
  };
}

async function runProbe(probe, cycle) {
  const startedAt = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 0: { json: { transcript: probe.transcript, languageCode: probe.languageCode, script: probe.script } } }),
    signal: AbortSignal.timeout(15_000),
  });
  const clientRoundTripMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const payload = await response.json();
  const run = payload?.[0]?.result?.data?.json;
  if (!response.ok || !run) throw new Error(`${probe.id}: HTTP ${response.status} malformed response`);
  const retrievalEvent = (run.trace || []).find(event => event.stage === "parallel_retrieve");
  return {
    id: probe.id,
    cycle,
    status: run.answer?.status || "MALFORMED",
    clientRoundTripMs,
    internalRagMs: run.latency?.ragMs ?? null,
    retrievalStageMs: retrievalEvent?.durationMs ?? null,
    retrievalDetail: retrievalEvent?.detail ?? null,
  };
}

async function main() {
  const samples = [];
  for (let cycle = 1; cycle <= runs; cycle += 1) {
    for (const probe of probes) samples.push(await runProbe(probe, cycle));
  }
  const grouped = Object.fromEntries(probes.map(probe => {
    const scoped = samples.filter(sample => sample.id === probe.id);
    return [probe.id, {
      statuses: Object.fromEntries([...new Set(scoped.map(sample => sample.status))].map(status => [status, scoped.filter(sample => sample.status === status).length])),
      clientRoundTripMs: summary(scoped, "clientRoundTripMs"),
      internalRagMs: summary(scoped, "internalRagMs"),
      retrievalStageMs: summary(scoped, "retrievalStageMs"),
    }];
  }));
  const report = { evaluatedAt: new Date().toISOString(), endpoint, runsPerProbe: runs, scope: "Sequential repeated live typed-query probe. Separates public round trip from server-reported internal RAG and retrieval-stage timing; it excludes microphone capture and Sarvam STT.", grouped, samples };
  await mkdir(new URL("../docs/evaluation-results/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ runsPerProbe: runs, grouped, outputPath: outputPath.pathname }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
