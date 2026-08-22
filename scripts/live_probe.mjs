// Live black-box probe of the Render deployment via tRPC + superjson.
import crypto from "node:crypto";

const BASE = process.env.SUNO_BASE_URL || "https://suno-rag-stt.onrender.com";
const ENDPOINT = `${BASE}/api/trpc/voiceRag.askBrowserTranscript`;

function body(input) {
  return JSON.stringify({ "0": { json: input } });
}

export async function ask(transcript, languageCode = "en-IN", script = "typed-input") {
  const startedAt = performance.now();
  const res = await fetch(`${ENDPOINT}?batch=1`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-superjson": "true",
    },
    body: body({ transcript, languageCode, script }),
  });
  const text = await res.text();
  const wallMs = Math.round((performance.now() - startedAt) * 100) / 100;
  if (!res.ok) {
    return { httpStatus: res.status, error: text.slice(0, 400), wallMs };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { httpStatus: res.status, error: `non-JSON: ${text.slice(0, 200)}`, wallMs };
  }
  const run = parsed?.[0]?.result?.data?.json ?? null;
  if (!run) return { httpStatus: res.status, error: `unexpected shape: ${text.slice(0, 300)}`, wallMs };
  return { httpStatus: res.status, run, wallMs };
}

export function summarize(label, result) {
  if (!result.run) {
    console.log(`${label}: HTTP ${result.httpStatus} ERROR ${result.error} (${result.wallMs}ms)`);
    return;
  }
  const r = result.run;
  console.log(
    `${label}: HTTP ${result.httpStatus} | ${r.answer.status} | "${r.answer.answer.slice(0, 110)}"` +
    ` | citations=${r.answer.evidenceIds.length} | lang=${r.detectedLanguage}` +
    ` | rag=${r.latency.ragMs}ms server=${r.delivery?.serverMs}ms wall=${result.wallMs}ms cache=${r.delivery?.cache}`
  );
}

if (process.argv[1] && process.argv[1].endsWith("live_probe.mjs")) {
  const cases = [
    ["What is a corporation?", "definition"],
    ["Why do ships accumulate bilge water?", "causal"],
    ["How many players are on an NHL playoff team roster?", "quantitative"],
    ["What is a corporation and why does it accumulate bilge?", "multi-part"],
  ];
  for (const [q, kind] of cases) {
    summarize(kind, await ask(q));
  }
}
