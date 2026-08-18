#!/usr/bin/env node
/**
 * Browser-originated, sequential voice-to-answer benchmark.
 *
 * Chromium loads the public evaluator origin and its own page-context fetch() sends
 * prerecorded real-audio fixture blobs through the normal public HTTP route. The
 * clock intentionally begins after the audio fixture exists, matching the server
 * benchmark contract; microphone permission and MediaRecorder encoding are excluded.
 */
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const endpoint = process.env.VOICE_RAG_URL || "https://3000-ifb42uuseuk387yx2srv1-323c3b4d.us3.manus.computer/api/trpc/voiceRag.ask";
const repetitions = Number(process.env.REPETITIONS || 25);
const debugPort = Number(process.env.BROWSER_DEBUG_PORT || 9333);
const profileDirectory = `/tmp/hh-goa-voice-benchmark-${process.pid}`;
const fixtures = [
  { languageHint: "en-IN", mimeType: "audio/webm", path: "/home/ubuntu/voice-benchmark/external/english-osr-10s.webm" },
  { languageHint: "kn-IN", mimeType: "audio/webm", path: "/home/ubuntu/voice-benchmark/external/kannada-bengaluru-10s.webm" },
  { languageHint: "hi-IN", mimeType: "audio/wav", path: "/home/ubuntu/voice-benchmark/hindi.wav" },
  { languageHint: "mr-IN", mimeType: "audio/wav", path: "/home/ubuntu/voice-benchmark/marathi.wav" },
];

function percentile(values, p) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? null;
}

function summarize(values) {
  return { p50: percentile(values, 50), p70: percentile(values, 70), p100: percentile(values, 100), sampleCount: values.length };
}

async function waitForPageDebugger() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const pages = response.ok ? await response.json() : [];
      const page = pages.find(candidate => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Chromium has not opened the debugging socket yet.
    }
    await delay(100);
  }
  throw new Error("Chromium DevTools endpoint did not become available.");
}

async function connectDevTools(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not open Chromium DevTools WebSocket.")), { once: true });
  });
  socket.addEventListener("message", event => {
    const message = JSON.parse(String(event.data));
    const resolver = pending.get(message.id);
    if (!resolver) return;
    pending.delete(message.id);
    resolver.resolve(message);
  });
  return {
    async send(method, params = {}) {
      const id = ++nextId;
      const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      const message = await response;
      if (message.error) throw new Error(`${method}: ${message.error.message}`);
      return message.result;
    },
    close() { socket.close(); },
  };
}

function browserFetchExpression(input) {
  return `(async () => {
    const input = ${JSON.stringify(input)};
    try {
      const startedAt = performance.now();
      const response = await fetch(${JSON.stringify(endpoint)}, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30000),
      });
      const raw = await response.text();
      let body = null;
      try { body = JSON.parse(raw); } catch { /* retained below as a bounded diagnostic */ }
      const run = body?.result?.data?.json;
      return {
        httpStatus: response.status,
        browserRoundTripMs: Math.round((performance.now() - startedAt) * 100) / 100,
        run,
        diagnostic: raw.slice(0, 180),
      };
    } catch (error) {
      return { httpStatus: 0, browserRoundTripMs: null, run: null, diagnostic: error instanceof Error ? error.message : String(error) };
    }
  })()`;
}

const browser = spawn("chromium", [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
  "--remote-allow-origins=*", `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDirectory}`, new URL(endpoint).origin,
], { stdio: "ignore", detached: true });

let client;
try {
  const debuggerMetadata = await waitForPageDebugger();
  client = await connectDevTools(debuggerMetadata.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: new URL(endpoint).origin });
  await delay(1_000);
  const location = await client.send("Runtime.evaluate", { expression: "location.href", returnByValue: true });
  if (!String(location.result?.value || "").startsWith(new URL(endpoint).origin)) throw new Error("Chromium could not load the public evaluator origin.");
  const results = [];
  for (let round = 0; round < repetitions; round += 1) {
    for (const fixture of fixtures) {
      const audioBase64 = (await readFile(fixture.path)).toString("base64");
      const runtime = await client.send("Runtime.evaluate", { expression: browserFetchExpression({ json: { audioBase64, mimeType: fixture.mimeType, languageHint: fixture.languageHint } }), awaitPromise: true, returnByValue: true });
      if (runtime.exceptionDetails) throw new Error(`Browser request failed: ${runtime.exceptionDetails.text || "runtime exception"}`);
      const response = runtime.result.value;
      const run = response?.run;
      const ok = response?.httpStatus >= 200 && response?.httpStatus < 300 && run && run.answer?.status !== "ERROR";
      results.push({
        ok,
        languageHint: fixture.languageHint,
        browserRoundTripMs: response?.browserRoundTripMs ?? null,
        serverEndToEndMs: run?.latency?.endToEndMs ?? null,
        sttMs: run?.latency?.sttMs ?? null,
        ragMs: run?.latency?.ragMs ?? null,
        status: ok ? run.answer?.status : "ERROR",
        error: ok ? null : run?.answer?.refusalReason || response?.diagnostic || `HTTP ${response?.httpStatus ?? "unknown"}`,
      });
    }
  }
  const successful = results.filter(result => result.ok);
  const failed = results.filter(result => !result.ok);
  const report = {
    benchmark: "browser-originated Sarvam voice-to-final-answer replay",
    endpoint,
    transportScope: "Chromium page-context public-ingress HTTP",
    fixtureProfile: "target-languages",
    fixtureLanguages: fixtures.map(fixture => fixture.languageHint),
    repetitionsPerLanguage: repetitions,
    requestCount: results.length,
    failureCount: failed.length,
    browserRoundTripMs: summarize(successful.map(result => result.browserRoundTripMs).filter(Number.isFinite)),
    serverEndToEndMs: summarize(successful.map(result => result.serverEndToEndMs).filter(Number.isFinite)),
    sttMs: summarize(successful.map(result => result.sttMs).filter(Number.isFinite)),
    ragMs: summarize(successful.map(result => result.ragMs).filter(Number.isFinite)),
    statuses: successful.reduce((counts, result) => ({ ...counts, [result.status]: (counts[result.status] || 0) + 1 }), {}),
    trials: results,
    failures: failed,
    measuredAt: new Date().toISOString(),
    caveat: "Each request originates in a real Chromium page loaded at the public evaluator origin. Timing begins after a prerecorded real-audio fixture is available, and therefore excludes microphone permission, capture duration, and MediaRecorder encoding while including the browser page-context fetch and public ingress.",
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  client?.close();
  if (browser.pid) {
    try { process.kill(-browser.pid, "SIGTERM"); } catch { browser.kill("SIGTERM"); }
    await Promise.race([new Promise(resolve => browser.once("exit", resolve)), delay(2_000)]);
  }
  await rm(profileDirectory, { recursive: true, force: true });
}
