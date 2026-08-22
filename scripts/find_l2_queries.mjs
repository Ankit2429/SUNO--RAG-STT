import fs from "fs";
import { parquetMetadataAsync, parquetRead } from "./hyparquet.mjs";

const PARQUET_URL = "https://huggingface.co/api/datasets/ai4bharat/MSMARCO-XI/parquet/default/validation/0.parquet";
const EXCLUSION_FILE = "C:/Users/godby/.gemini/antigravity-ide/brain/f1c9a612-a388-4205-95fc-3b1900a51c50/scratch/full_exclusion_set.json";
const excludedQids = new Set(JSON.parse(fs.readFileSync(EXCLUSION_FILE, "utf8")));

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

async function findL2Queries() {
  const buffer = await asyncBuffer(PARQUET_URL);
  const rows = [];

  // Read first 200 validation topics (rows 0 to 200 in 0.parquet are the 200 MSMARCO-XI topics indexed in the evaluation slice)
  await parquetRead({
    file: buffer,
    columns: ["query_id", "query_type", "query", "target_lang", "Eng_Query", "Answer"],
    rowStart: 0,
    rowEnd: 400,
    onComplete: (data) => {
      for (let i = 0; i < data.length; i++) {
        rows.push({
          rowIdx: i,
          queryId: String(data[i][0]),
          queryType: String(data[i][1]),
          query: String(data[i][2]),
          langRaw: String(data[i][3]),
          engQuery: String(data[i][4]),
          answer: String(data[i][5])
        });
      }
    }
  });

  console.log(`Read ${rows.length} rows.`);

  // Filter to focused languages (hi, kn, ta, mr, en)
  const l2Candidates = rows.filter(r => {
    if (excludedQids.has(r.queryId)) return false;
    const l = r.langRaw;
    return l.includes("hin") || l.includes("kan") || l.includes("tam") || l.includes("mar") || l.includes("eng");
  });

  console.log(`L2 Candidate rows (not in HOT_CORPUS/fixtures): ${l2Candidates.length}`);

  // Unique query IDs
  const uniqueQids = new Set(l2Candidates.map(c => c.queryId));
  console.log(`Unique L2 query IDs: ${uniqueQids.size}`);
  console.log("Sample L2 query IDs:", Array.from(uniqueQids).slice(0, 25));

  fs.writeFileSync("C:/Users/godby/.gemini/antigravity-ide/brain/f1c9a612-a388-4205-95fc-3b1900a51c50/scratch/l2_candidates.json", JSON.stringify(l2Candidates, null, 2));
}

findL2Queries().catch(console.error);
