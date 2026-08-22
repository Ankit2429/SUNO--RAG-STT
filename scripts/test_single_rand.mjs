import { parquetMetadataAsync, parquetRead } from "./hyparquet.mjs";

const LIVE_URL = "https://suno-rag-stt.onrender.com";
const PARQUET_URL = "https://huggingface.co/api/datasets/ai4bharat/MSMARCO-XI/parquet/default/validation/0.parquet";

async function asyncBuffer(url) {
  const head = await fetch(url, { method: "HEAD" });
  const contentLength = Number(head.headers.get("content-length"));
  return {
    byteLength: contentLength,
    async slice(start, end) {
      const finish = end !== undefined ? end - 1 : contentLength - 1;
      const res = await fetch(url, { headers: { Range: `bytes=${start}-${finish}` } });
      return await res.arrayBuffer();
    }
  };
}

async function testSingle() {
  const buffer = await asyncBuffer(PARQUET_URL);
  let sample = null;
  await parquetRead({
    file: buffer,
    columns: ["query_id", "query_type", "query", "target_lang", "Eng_Query"],
    rowStart: 0,
    rowEnd: 5,
    onComplete: (data) => {
      sample = data[0];
    }
  });

  console.log("Sample query:", sample);
  const qid = String(sample[0]);
  const query = String(sample[2]);
  const langRaw = String(sample[3]);

  let langCode = "en-IN";
  if (langRaw.includes("hin")) langCode = "hi-IN";
  else if (langRaw.includes("kan")) langCode = "kn-IN";
  else if (langRaw.includes("tam")) langCode = "ta-IN";
  else if (langRaw.includes("mar")) langCode = "mr-IN";

  console.log(`Sending to Render: "${query}" (${langCode})...`);
  const started = performance.now();
  const res = await fetch(`${LIVE_URL}/api/trpc/voiceRag.askBrowserTranscript`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: { transcript: query, languageCode: langCode, script: "typed-input" }
    })
  });
  const ms = Math.round(performance.now() - started);
  console.log(`HTTP status: ${res.status} in ${ms} ms`);
  const json = await res.json();
  console.log("Response payload:", JSON.stringify(json?.result?.data?.json?.answer, null, 2));
}

testSingle().catch(console.error);
