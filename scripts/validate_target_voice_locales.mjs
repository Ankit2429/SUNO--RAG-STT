import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const endpoint = process.env.VOICE_RAG_URL || "http://localhost:3000/api/trpc/voiceRag.ask";
const fixtures = [
  { languageHint: "en-IN", label: "English", path: "/home/ubuntu/voice-benchmark/external/english-osr-25s.wav" },
  { languageHint: "kn-IN", label: "Kannada", path: "/home/ubuntu/voice-benchmark/external/kannada-bengaluru-25s.wav" },
  { languageHint: "hi-IN", label: "Hindi", path: "/home/ubuntu/voice-benchmark/hindi.wav" },
  { languageHint: "mr-IN", label: "Marathi", path: "/home/ubuntu/voice-benchmark/marathi.wav" },
];

async function validateFixture(fixture) {
  const audioBase64 = (await readFile(fixture.path)).toString("base64");
  const startedAt = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { audioBase64, mimeType: "audio/wav", languageHint: fixture.languageHint } }),
    signal: AbortSignal.timeout(30_000),
  });
  const applicationRoundTripMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const body = await response.json().catch(() => null);
  const run = body?.result?.data?.json;
  const transcript = run?.transcript?.trim() || "";
  // This verification concerns the voice-to-transcript contract. A later evidence
  // refusal or transient retrieval error must remain visible, but must not be
  // misclassified as an STT failure when Sarvam returned a nonempty transcript.
  const failure = !response.ok || !run || Boolean(run.transcriptionError) || !transcript;

  return {
    locale: fixture.languageHint,
    language: fixture.label,
    ok: !failure,
    harnessStatus: run?.answer?.status ?? "ERROR",
    transcriptCharacters: transcript.length,
    transcriptPreview: transcript.slice(0, 120),
    transcriptionError: run?.transcriptionError ?? null,
    refusalReason: run?.answer?.refusalReason ?? null,
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
  benchmark: "required-locale Sarvam transcription validation",
  measuredAt: new Date().toISOString(),
  endpoint,
  requestCount: results.length,
  failureCount: results.filter(result => !result.ok).length,
  results,
};

console.log(JSON.stringify(report, null, 2));
if (report.failureCount) process.exitCode = 1;
