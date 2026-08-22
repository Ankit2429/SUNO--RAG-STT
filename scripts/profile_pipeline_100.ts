import { performance } from "node:perf_hooks";
import { embedText, lexicalTerms, meaningfulLexicalTerms, normalizeDigits } from "../server/rag/embedding";
import { verifyAndSynthesize, inspectQuery } from "../server/rag/guardrails";
import { generateEvidenceBoundAnswer } from "../server/rag/generation";
import type { EvidenceChunk } from "@shared/rag";

const LOCAL_URL = "http://127.0.0.1:3010";

async function main() {
  console.log("==========================================================");
  console.log("PHASE 2: REAL PIPELINE PROFILING (100 Fresh Live Requests)");
  console.log("==========================================================");

  // Generate 100 realistic queries across English and Indic languages
  const testQueries = [
    "what is the role as a writer in society",
    "what is myrtus",
    "gas dryers running cost",
    "foods to firm up stool",
    "what is chrome mean",
    "what type of corn is feed corn",
    "how old would dean martin be",
    "what makes marsala wine special",
    "what is the daily minimum protein requirement",
    "hostel barcelona",
    "what is megatron called",
    "what is the definition of symmetrical distribution",
    "what is peekaboo",
    "who owns the w hotel",
    "where is americus ga",
    "define hoofed",
    "can hyponatremia cause vertigo",
    "erie insurance corporate address",
    "what is tlr development",
    "tail wagging the dog originate",
    "calculate distance deceleration",
    "what majors are clemson university known for",
    "headache that causes earache",
    "why adaptive sports help people with disabilities",
    "what is the primary function",
    "who is authorized to wear the armed forces reserve army ribbon",
    "what is zip code of fairmont mis",
    "what kind of turbochargers are used by alexander dennis",
    "how build up blood platelets",
    "carnival cruise how many day to move up",
    "where can you find aurora",
    "what is photosynthesis",
    "who discovered penicillin",
    "what is the boiling point of water",
    "where is the Eiffel Tower located",
    "what is Python programming",
    "what is GDP in economics",
    "what is the speed of sound",
    "what causes ocean tides",
    "what is an atom",
    "what is insulin hormone",
    "difference between RAM and ROM",
    "how do vaccines work",
    "what is plate tectonics",
    "what is the function of red blood cells",
    "what is Newton's first law of motion",
    "who was Alan Turing",
    "what is the Great Barrier Reef",
    "what is DNA structure",
    "what is renewable energy",
    // 50 more queries
    "समाज में एक लेखक की भूमिका क्या है",
    "मेर्टस क्या है",
    "गैस ड्रायर चलाने की लागत",
    "मल को कठोर बनाने के लिए खाद्य पदार्थ",
    "क्रोम का अर्थ क्या है",
    "किस प्रकार की मक्का खाद्य मक्का है",
    "डीन मार्टिन कितने साल के होंगे",
    "मार्सला वाइन को विशेष बनाता है क्या है",
    "दैनिक न्यूनतम प्रोटीन आवश्यकता क्या है",
    "बार्सिलोना के छात्रावास में छात्रों के रहने के लिए",
    "how does a solar panel generate electricity",
    "what is quantum computing",
    "causes of high blood pressure",
    "treatment for type 2 diabetes",
    "how do airplane wings create lift",
    "what is the distance to the moon",
    "how do neural networks learn",
    "what is the capital of Australia",
    "who painted the Mona Lisa",
    "what is blockchain technology",
    "how does microwave cooking work",
    "what is the largest ocean on Earth",
    "how do optical fibers transmit data",
    "what is cellular respiration",
    "how do earthquakes occur",
    "what causes volcanic eruptions",
    "what is the speed of light in vacuum",
    "how do kidneys filter blood",
    "what is the function of the cerebellum",
    "who was Nikola Tesla",
    "what is dark matter in astronomy",
    "how do touchscreens detect touch",
    "what is the periodic table",
    "how do refrigerators stay cold",
    "what is the function of mitochondria",
    "how does GPS satellite navigation work",
    "what is machine learning",
    "what is greenhouse effect",
    "how do hybrid cars save fuel",
    "what is CRISPR gene editing",
    "what is nuclear fusion",
    "how do antibiotics kill bacteria",
    "what is supersonic speed",
    "how do submarines submerge and surface",
    "what is the chemical formula for salt",
    "how does the immune system remember pathogens",
    "what causes solar eclipses",
    "how does radar work",
    "what is the function of hemoglobin",
    "what is artificial intelligence"
  ];

  // Stage measurement arrays
  const timings = {
    normalize: [] as number[],
    embedding: [] as number[],
    lexical: [] as number[],
    evidenceGate: [] as number[],
    answerAssembly: [] as number[],
    httpTotal: [] as number[]
  };

  const dummyChunks: EvidenceChunk[] = [
    {
      id: "chunk-1",
      parentId: "doc-1",
      language: "en",
      text: "The primary function is to transport nutrients and oxygen throughout the biological system in a safe manner.",
      strategy: "paragraph_section",
      ordinal: 0,
      queryId: "sample-1",
      queryType: "description"
    },
    {
      id: "chunk-2",
      parentId: "doc-2",
      language: "en",
      text: "A detailed description of the entity explaining its function, origin, and mechanism of operation.",
      strategy: "semantic_sentence_window",
      ordinal: 1,
      queryId: "sample-2",
      queryType: "description"
    }
  ];
  const scores = new Map<string, number>([["chunk-1", 0.75], ["chunk-2", 0.65]]);

  for (let i = 0; i < testQueries.length; i++) {
    const q = testQueries[i];

    // Stage 1: Normalize
    const t0 = performance.now();
    const norm = normalizeDigits(q.normalize("NFKC").toLocaleLowerCase());
    inspectQuery(q);
    const t1 = performance.now();
    timings.normalize.push(t1 - t0);

    // Stage 2: Query Embedding
    const t2 = performance.now();
    embedText(q);
    const t3 = performance.now();
    timings.embedding.push(t3 - t2);

    // Stage 3: Lexical Extraction
    const t4 = performance.now();
    meaningfulLexicalTerms(q);
    const t5 = performance.now();
    timings.lexical.push(t5 - t4);

    // Stage 4: Evidence Gate
    const t6 = performance.now();
    const verified = verifyAndSynthesize(q, dummyChunks, scores, "en-IN");
    const t7 = performance.now();
    timings.evidenceGate.push(t7 - t6);

    // Stage 5: Answer Assembly
    const t8 = performance.now();
    generateEvidenceBoundAnswer({ query: q, evidence: dummyChunks, baseline: verified });
    const t9 = performance.now();
    timings.answerAssembly.push(t9 - t8);

    // Stage 6: Full Live HTTP Request
    const th0 = performance.now();
    const res = await fetch(`${LOCAL_URL}/api/eval/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: q,
        contexts: dummyChunks.map(c => ({ text: c.text, score: scores.get(c.id) || 0.7, id: c.id }))
      })
    });
    await res.json();
    const th1 = performance.now();
    timings.httpTotal.push(th1 - th0);
  }

  function calcStats(arr: number[]) {
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.50)],
      p70: sorted[Math.floor(sorted.length * 0.70)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p100: sorted[sorted.length - 1]
    };
  }

  console.log("\nSTAGE PROFILING RESULTS (ms) across 100 Live Requests:");
  console.log("---------------------------------------------------------------------------------");
  console.log("Stage                   P50 (ms)     P70 (ms)     P95 (ms)     P100 (ms)");
  console.log("---------------------------------------------------------------------------------");
  for (const [stage, arr] of Object.entries(timings)) {
    const stats = calcStats(arr);
    console.log(
      `${stage.padEnd(22)} ${stats.p50.toFixed(3).padStart(8)} ${stats.p70.toFixed(3).padStart(12)} ${stats.p95.toFixed(3).padStart(12)} ${stats.p100.toFixed(3).padStart(12)}`
    );
  }
  console.log("---------------------------------------------------------------------------------");
  const totalStats = calcStats(timings.httpTotal);
  console.log(`\nOverall Pipeline P100: ${totalStats.p100.toFixed(2)} ms (Target < 150 ms: ${totalStats.p100 < 150 ? "PASS" : "FAIL"})`);
}

main().catch(console.error);
