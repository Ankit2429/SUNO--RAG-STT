import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = (process.env.VOICE_RAG_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const endpoint = `${baseUrl}/api/trpc/voiceRag.benchmarkFiveLanguages?batch=1`;
const outputPath = new URL("../docs/benchmark-results/five-language-1000-query-raw.json", import.meta.url);
const queriesPerLanguage = Number.parseInt(process.env.QUERIES_PER_LANGUAGE || "200", 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ms(value) {
  return `${Number(value).toFixed(2)} ms`;
}

async function main() {
  assert(Number.isInteger(queriesPerLanguage) && queriesPerLanguage >= 5, "QUERIES_PER_LANGUAGE must be a whole number of at least 5.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60_000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ 0: { json: { queriesPerLanguage } } }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  assert(response?.ok, `Benchmark request failed with HTTP ${response?.status || "unknown"}.`);
  const payload = await response.json();
  const report = payload?.[0]?.result?.data?.json;
  assert(report && typeof report === "object", "Benchmark response did not contain a report.");
  assert(report.totalQueries === queriesPerLanguage * 5, `Expected ${queriesPerLanguage * 5} total requests, received ${report.totalQueries}.`);
  assert(report.languages?.every(language => language.requestCount === queriesPerLanguage), "A language did not receive the requested number of measurements.");

  await mkdir(new URL("../docs/benchmark-results/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\nSVARAPROOF / FIVE-LANGUAGE POST-TRANSCRIPTION RAG BENCHMARK");
  console.log("=".repeat(96));
  console.log(`Endpoint: ${baseUrl}`);
  console.log(`Measured: ${report.totalQueries} requests = ${report.queriesPerLanguage} each across hi-IN, kn-IN, en-IN, ta-IN, mr-IN`);
  console.log(`Fixtures: ${report.fixtureReusePerLanguage} even repetitions of five real MSMARCO-XI query themes per language`);
  console.log("\nLANGUAGE  REQUESTS  P50        P70        P90        P95        P100       GROUNDED  REFUSED  ERROR  CITATIONS");
  console.log("-".repeat(96));
  for (const language of report.languages) {
    const summary = language.latency;
    console.log(`${language.languageCode.padEnd(9)} ${String(language.requestCount).padStart(8)}  ${ms(summary.p50).padEnd(9)}  ${ms(summary.p70).padEnd(9)}  ${ms(summary.p90).padEnd(9)}  ${ms(summary.p95).padEnd(9)}  ${ms(summary.p100).padEnd(9)}  ${String(language.statusCounts.GROUNDED).padStart(8)}  ${String(language.statusCounts.REFUSED).padStart(7)}  ${String(language.statusCounts.ERROR).padStart(5)}  ${String(language.citedEvidenceCount).padStart(9)}`);
  }
  console.log("-".repeat(96));
  console.log(`ALL       ${String(report.totalQueries).padStart(8)}  ${ms(report.combined.p50).padEnd(9)}  ${ms(report.combined.p70).padEnd(9)}  ${ms(report.combined.p90).padEnd(9)}  ${ms(report.combined.p95).padEnd(9)}  ${ms(report.combined.p100).padEnd(9)}  ${String(report.combinedStatusCounts.GROUNDED).padStart(8)}  ${String(report.combinedStatusCounts.REFUSED).padStart(7)}  ${String(report.combinedStatusCounts.ERROR).padStart(5)}`);
  console.log(`\nInternal RAG target: ${report.postTranscriptionTargetMs} ms | Combined P100: ${ms(report.combined.p100)} | ${report.combined.p100 <= report.postTranscriptionTargetMs && report.combinedStatusCounts.ERROR === 0 ? "PASS" : "FAIL"}`);
  console.log(`Scope: ${report.scope}`);
  console.log(`Raw per-query telemetry: ${outputPath.pathname}\n`);
}

main().catch(error => {
  console.error(`FIVE-LANGUAGE BENCHMARK ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
