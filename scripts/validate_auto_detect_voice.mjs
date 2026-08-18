import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const endpoint = process.env.VOICE_RAG_URL || "http://localhost:3000/api/trpc/voiceRag.ask";
const fixtures = [
  { expectedLanguage: "en-IN", label: "English", path: "/home/ubuntu/voice-benchmark/external/english-osr-25s.wav" },
  { expectedLanguage: "kn-IN", label: "Kannada", path: "/home/ubuntu/voice-benchmark/external/kannada-bengaluru-25s.wav" },
  { expectedLanguage: "hi-IN", label: "Hindi", path: "/home/ubuntu/voice-benchmark/hindi.wav" },
  { expectedLanguage: "mr-IN", label: "Marathi", path: "/home/ubuntu/voice-benchmark/marathi.wav" },
];

async function validateFixture(fixture) {
  const audioBase64 = (await readFile(fixture.path)).toString("base64");
  const startedAt = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { audioBase64, mimeType: "audio/wav", languageHint: "unknown" } }),
    signal: AbortSignal.timeout(45_000),
  });
  const applicationRoundTripMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const body = await response.json().catch(() => null);
  const run = body?.result?.data?.json;
  const transcript = run?.transcript?.trim() || "";
  const failure = !response.ok || !run || Boolean(run.transcriptionError) || !transcript;

  return {
    fixtureLanguage: fixture.expectedLanguage,
    detectedLanguage: run?.detectedLanguage ?? null,
    languageMatched: run?.detectedLanguage === fixture.expectedLanguage,
    label: fixture.label,
    ok: !failure,
    harnessStatus: run?.answer?.status ?? "ERROR",
    transcriptCharacters: transcript.length,
    transcriptionError: run?.transcriptionError ?? null,
    sttMs: run?.latency?.sttMs ?? null,
    ragMs: run?.latency?.ragMs ?? null,
    endToEndMs: run?.latency?.endToEndMs ?? null,
    applicationRoundTripMs,
    httpStatus: response.status,
  };
}

const results = [];
for (const fixture of fixtures) results.push(await validateFixture(fixture));
const report = {
  benchmark: "Sarvam automatic-language-detection transcription validation",
  measuredAt: new Date().toISOString(),
  endpoint,
  languageHint: "unknown",
  requestCount: results.length,
  failureCount: results.filter(result => !result.ok).length,
  languageMatchCount: results.filter(result => result.languageMatched).length,
  results,
};

console.log(JSON.stringify(report, null, 2));
if (report.failureCount) process.exitCode = 1;
