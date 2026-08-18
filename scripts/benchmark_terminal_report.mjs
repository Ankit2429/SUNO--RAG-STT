const baseUrl = (process.env.VOICE_RAG_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const endpoint = `${baseUrl}/api/trpc/voiceRag.benchmark?batch=1`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function number(value) {
  assert(typeof value === "number" && Number.isFinite(value), "Benchmark response contained a non-numeric latency value.");
  return value;
}

function ms(value, width = 7) {
  return `${number(value).toFixed(2).padStart(width)}ms`;
}

function row(label, summary) {
  return `${label.padEnd(20)} ${ms(summary.p50)}  ${ms(summary.p70)}  ${ms(summary.p90)}  ${ms(summary.p95)}  ${ms(summary.p100)}  ${String(summary.sampleCount).padStart(7)}  ${String(summary.failureCount).padStart(4)}`;
}

function stageRow(summary) {
  return `${summary.stage.padEnd(20)} ${ms(summary.averageMs)}  ${ms(summary.p50)}  ${ms(summary.p70)}  ${ms(summary.p90)}  ${ms(summary.p95)}  ${ms(summary.p100)}  ${String(summary.sampleCount).padStart(6)}  ${String(summary.failureCount).padStart(4)}`;
}

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ 0: { json: null } }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  assert(response?.ok, `Benchmark request failed with HTTP ${response?.status || "unknown"}.`);
  const payload = await response.json();
  const report = payload?.[0]?.result?.data?.json;
  assert(report && typeof report === "object", "Benchmark response did not contain the expected tRPC report.");
  assert(Array.isArray(report.warmStageTimings), "Benchmark response does not include stage-level timing telemetry.");

  const worstPath = Math.max(number(report.cold.p100), number(report.warm.p100));
  const stageFailures = report.warmStageTimings.reduce((sum, summary) => sum + number(summary.failureCount), 0);
  const passed = report.cold.failureCount === 0 && report.warm.failureCount === 0 && stageFailures === 0 && worstPath <= number(report.postTranscriptionTargetMs);

  console.log("\nSVARAPROOF / TASK 112 — POST-TRANSCRIPTION RAG BENCHMARK");
  console.log("=".repeat(76));
  console.log(`Endpoint: ${baseUrl}`);
  console.log("Warm-up: L1 cache and fail-closed harness are exercised by the cold pass.");
  console.log(`Ran ${report.queryCount} query cases × cold + warm = ${report.cold.sampleCount + report.warm.sampleCount} measured requests`);
  console.log(`Composition: ${report.datasetQueryCount} real AI4Bharat/MSMARCO-XI cases + ${report.adversarialQueryCount} adversarial safety cases\n`);

  console.log("PATH                    P50       P70       P90       P95       P100    SAMPLES  FAIL");
  console.log("-".repeat(76));
  console.log(row("cold internal RAG", report.cold));
  console.log(row("warm internal RAG", report.warm));

  console.log("\nWARM HARNESS STAGE PROFILE (aggregated once per query)");
  console.log("STAGE                    AVG       P50       P70       P90       P95       P100      N  FAIL");
  console.log("-".repeat(76));
  report.warmStageTimings.forEach(summary => console.log(stageRow(summary)));

  console.log(`\nLatency budget: ${number(report.postTranscriptionTargetMs).toFixed(1)}ms | P100 worst internal path: ${worstPath.toFixed(2)}ms`);
  console.log(passed ? "PASS: within internal RAG budget" : "FAIL: benchmark has failures or exceeded the internal RAG budget");
  console.log("Scope: post-transcription only. Sarvam STT, microphone capture, browser upload, and network transfer are reported separately.");
  console.log(`Evaluated at: ${report.evaluatedAt}\n`);
}

main().catch(error => {
  console.error(`BENCHMARK ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
