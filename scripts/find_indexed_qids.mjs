import { parquetMetadataAsync, parquetRead } from "./hyparquet.mjs";
import { HOT_CORPUS } from "../server/rag/hotCorpus";
import fs from "node:fs";

const PARQUET_URL = "https://huggingface.co/api/datasets/ai4bharat/MSMARCO-XI/parquet/default/validation/0.parquet";
const hotQids = new Set(HOT_CORPUS.map(c => c.queryId));
console.log("HOT_CORPUS QIDs count:", hotQids.size);

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

async function findIndexedQids() {
  const buffer = await asyncBuffer(PARQUET_URL);
  const rows = [];

  // Read the first 200 rows of validation/0.parquet
  await parquetRead({
    file: buffer,
    columns: ["query_id", "query_type", "query", "target_lang", "Eng_Query", "Answer"],
    rowStart: 0,
    rowEnd: 200,
    onComplete: (data) => {
      for (let i = 0; i < data.length; i++) {
        rows.push({
          rowIdx: i,
          queryId: String(data[i][0]),
          queryType: String(data[i][1]),
          query: String(data[i][2]),
          targetLang: String(data[i][3]),
          engQuery: String(data[i][4]),
          answer: String(data[i][5])
        });
      }
    }
  });

  console.log(`Read ${rows.length} rows.`);
  const qidToRows = new Map();
  for (const r of rows) {
    if (!qidToRows.has(r.queryId)) qidToRows.set(r.queryId, []);
    qidToRows.get(r.queryId).push(r);
  }

  console.log(`Unique query IDs in first 200 rows: ${qidToRows.size}`);
  
  const notInHot = [];
  for (const [qid, rList] of qidToRows.entries()) {
    if (!hotQids.has(qid)) {
      notInHot.push({ qid, rows: rList });
    }
  }

  console.log(`Unique query IDs NOT in HOT_CORPUS: ${notInHot.length}`);
  for (let i = 0; i < Math.min(10, notInHot.length); i++) {
    const item = notInHot[i];
    console.log(`- QID ${item.qid}: ${item.rows[0].query} (lang: ${item.rows[0].targetLang})`);
  }

  fs.writeFileSync(
    "C:/Users/godby/.gemini/antigravity-ide/brain/f1c9a612-a388-4205-95fc-3b1900a51c50/scratch/indexed_not_in_hot.json",
    JSON.stringify(notInHot, null, 2)
  );
}

findIndexedQids().catch(console.error);
