import { mkdir, readFile, writeFile } from "node:fs/promises";

const baseUrl = (process.env.VOICE_RAG_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const endpoint = `${baseUrl}/api/trpc/voiceRag.ask?batch=1`;
const manifestPath = process.env.STT_EVAL_MANIFEST || "scripts/fixtures/stt-eval-manifest.json";
const outputPath = new URL("../docs/evaluation-results/stt-end-to-end-eval.json", import.meta.url);

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

async function loadCases() {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
      throw new Error("The audio manifest must contain at least one case.");
    }
    return manifest.cases;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function runCase(testCase) {
  const startedAt = performance.now();
  try {
    const audio = await readFile(testCase.audioPath);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        0: {
          json: {
            audioBase64: audio.toString("base64"),
            mimeType: testCase.mimeType,
            languageHint: testCase.languageHint || "auto",
          },
        },
      }),
    });
    const payload = await response.json();
    const run = payload?.[0]?.result?.data?.json;
    if (!response.ok || !run) throw new Error(`HTTP ${response.status}: malformed tRPC response.`);
    const roundTripMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const evidenceQueryIds = [...new Set((run.evidence || []).map(item => item.queryId).filter(Boolean))];
    const expectedSourcePresent = testCase.sourceQueryId ? evidenceQueryIds.includes(testCase.sourceQueryId) : true;
    const transcriptMatches = testCase.expectedTranscript ? run.transcription?.text?.trim() === testCase.expectedTranscript.trim() : true;
    const passed = run.answer?.status === (testCase.expectedStatus || "GROUNDED") && expectedSourcePresent && transcriptMatches;
    return {
      id: testCase.id,
      languageHint: testCase.languageHint || "auto",
      audioPath: testCase.audioPath,
      observedStatus: run.answer?.status || "MALFORMED",
      transcription: run.transcription?.text || null,
      expectedTranscript: testCase.expectedTranscript || null,
      transcriptMatches,
      evidenceQueryIds,
      expectedSourcePresent,
      sttMs: run.latency?.sttMs ?? null,
      ragMs: run.latency?.ragMs ?? null,
      endToEndMs: run.latency?.endToEndMs ?? null,
      clientRoundTripMs: roundTripMs,
      passed,
      error: null,
    };
  } catch (error) {
    return {
      id: testCase.id,
      languageHint: testCase.languageHint || "auto",
      audioPath: testCase.audioPath,
      observedStatus: "REQUEST_ERROR",
      transcription: null,
      expectedTranscript: testCase.expectedTranscript || null,
      transcriptMatches: false,
      evidenceQueryIds: [],
      expectedSourcePresent: false,
      sttMs: null,
      ragMs: null,
      endToEndMs: null,
      clientRoundTripMs: Math.round((performance.now() - startedAt) * 100) / 100,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const cases = await loadCases();
  const results = [];
  for (const testCase of cases) results.push(await runCase(testCase));
  const report = {
    evaluatedAt: new Date().toISOString(),
    endpoint,
    scope: "Separate recorded-audio end-to-end evaluation: audio upload, Sarvam STT, language routing, retrieval, and grounded-answer generation. Real browser microphone capture requires manually recorded fixtures and is not synthesized by this runner.",
    manifestPath,
    status: cases.length ? "COMPLETED" : "NOT_RUN_NO_AUDIO_FIXTURES",
    totalCases: results.length,
    passCount: results.filter(item => item.passed).length,
    failCount: results.filter(item => !item.passed).length,
    latency: {
      sttMs: { p50: percentile(results.map(item => item.sttMs).filter(Number.isFinite), 50), p95: percentile(results.map(item => item.sttMs).filter(Number.isFinite), 95), p100: percentile(results.map(item => item.sttMs).filter(Number.isFinite), 100) },
      endToEndMs: { p50: percentile(results.map(item => item.endToEndMs).filter(Number.isFinite), 50), p95: percentile(results.map(item => item.endToEndMs).filter(Number.isFinite), 95), p100: percentile(results.map(item => item.endToEndMs).filter(Number.isFinite), 100) },
    },
    results,
  };
  await mkdir(new URL("../docs/evaluation-results/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: report.status, totalCases: report.totalCases, passCount: report.passCount, failCount: report.failCount, outputPath: outputPath.pathname }, null, 2));
  if (report.failCount) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
