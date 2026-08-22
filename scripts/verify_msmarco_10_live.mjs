import fs from "node:fs";

const LIVE_URL = "https://suno-rag-stt.onrender.com";

const TEST_QUERIES = [
  {
    testNum: 1,
    msmarcoQueryId: "1102432",
    question: "निगम क्या है और यह किस कानून द्वारा शासित होता है?",
    languageCode: "hi-IN",
    topic: "Corporation definition & incorporation laws"
  },
  {
    testNum: 2,
    msmarcoQueryId: "1102431",
    question: "रेचेल कार्सन ने द ऑब्लिगेशन टू एंड्योर क्यों लिखा था?",
    languageCode: "hi-IN",
    topic: "Rachel Carson Silent Spring / pesticide warning"
  },
  {
    testNum: 3,
    msmarcoQueryId: "90836",
    question: "कम सोडियम और कम पोटेशियम आहार तालिका में क्या शामिल होता है?",
    languageCode: "hi-IN",
    topic: "Low sodium low potassium diet"
  },
  {
    testNum: 4,
    msmarcoQueryId: "55665",
    question: "जहाज का सबसे निचला आंतरिक क्षेत्र क्या कहलाता है?",
    languageCode: "hi-IN",
    topic: "Ship bottom bilge / cargo ship hull"
  },
  {
    testNum: 5,
    msmarcoQueryId: "205107",
    question: "ಸತ್ಯಸಂಧತೆ ಮತ್ತು ಪ್ರಾಮಾಣಿಕತೆಯ ವ್ಯಾಖ್ಯಾನವೇನು?",
    languageCode: "kn-IN",
    topic: "Honesty / truthfulness to facts definition"
  },
  {
    testNum: 6,
    msmarcoQueryId: "1060386",
    question: "ವಾತಾವರಣದ ಒತ್ತಡ ಹೆಚ್ಚಾದಾಗ ಪಾದರಸದ ಮಟ್ಟ ಏನಾಗುತ್ತದೆ?",
    languageCode: "kn-IN",
    topic: "Atmospheric pressure mercury barometer level"
  },
  {
    testNum: 7,
    msmarcoQueryId: "168868",
    question: "மனஉளைச்சல் பிந்தைய மன அழுத்தக் கோளாறு (PTSD) பற்றிய ஆராய்ச்சி என்ன கூறுகிறது?",
    languageCode: "ta-IN",
    topic: "Post-traumatic stress disorder (PTSD) research"
  },
  {
    testNum: 8,
    msmarcoQueryId: "227261",
    question: "2050 ஆம் ஆண்டிற்குள் உலக மக்கள் தொகை கணிப்பு என்ன?",
    languageCode: "ta-IN",
    topic: "World population forecast 2050"
  },
  {
    testNum: 9,
    msmarcoQueryId: "227029",
    question: "एनएचएल (NHL) मध्ये किती कॉन्फरन्स आणि विभाग असतात?",
    languageCode: "mr-IN",
    topic: "NHL conference divisions structure"
  },
  {
    testNum: 10,
    msmarcoQueryId: "166290",
    question: "त्वचेचा रिंगवर्म (टिनिया कॉर्पोरिस) कशामुळे होतो?",
    languageCode: "mr-IN",
    topic: "Skin ringworm tinea corporis fungal cause"
  }
];

async function queryLiveApi(transcript, languageCode) {
  const url = `${LIVE_URL}/api/trpc/voiceRag.askBrowserTranscript`;
  const startedAt = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: {
        transcript,
        languageCode,
        script: "typed-input"
      }
    })
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const json = await res.json();
  const payload = json?.result?.data?.json;
  return {
    httpStatus: res.status,
    elapsedMs,
    payload
  };
}

async function runVerification() {
  console.log("=== STARTING REAL MSMARCO-XI DATASET VERIFICATION TEST ===");
  console.log(`Live Target URL: ${LIVE_URL}\n`);

  const results = [];

  for (const item of TEST_QUERIES) {
    console.log(`\n--- Test ${item.testNum}/10 [MSMARCO-XI queryId: ${item.msmarcoQueryId}] ---`);
    console.log(`Question (${item.languageCode}): "${item.question}"`);

    const resp = await queryLiveApi(item.question, item.languageCode);
    const p = resp.payload;

    const answerStatus = p?.answer?.status || "ERROR";
    const answerText = p?.answer?.answer || "";
    const evidenceList = p?.evidence || [];
    const trace = p?.trace || [];

    // Determine retrieval route (L1 hot vs Qdrant L2)
    const retrieveStage = trace.find(t => t.stage === "parallel_retrieve");
    const routeDetail = retrieveStage?.detail || "";
    let tierUsed = "unknown";
    if (routeDetail.includes("L1 language cache") || routeDetail.includes("in-process")) {
      tierUsed = "L1 hot corpus";
    } else if (routeDetail.includes("Qdrant") || routeDetail.includes("L2")) {
      tierUsed = "Qdrant L2";
    } else if (answerStatus === "REFUSED") {
      tierUsed = "refusal";
    }

    const matchedEvidence = evidenceList.map(e => ({
      id: e.id,
      queryId: e.queryId,
      source: e.source,
      strategy: e.strategy,
      language: e.language,
      textSnippet: e.text ? e.text.slice(0, 120) + "..." : "",
      selected: e.selected
    }));

    // Verify if returned queryId or source matches MSMARCO-XI
    const isMSMARCOVerified = evidenceList.some(e => e.source === "ai4bharat/MSMARCO-XI" || e.queryId === item.msmarcoQueryId || e.id.includes(item.msmarcoQueryId));
    const isGrounded = answerStatus === "GROUNDED" && evidenceList.some(e => e.selected);

    const record = {
      testNum: item.testNum,
      msmarcoQueryId: item.msmarcoQueryId,
      question: item.question,
      languageCode: item.languageCode,
      httpStatus: resp.httpStatus,
      elapsedMs: resp.elapsedMs,
      answerStatus,
      answerText,
      tierUsed,
      routeDetail,
      evidenceList: matchedEvidence,
      isMSMARCOVerified,
      isGrounded
    };

    results.push(record);

    console.log(`Status: ${answerStatus} | Tier: ${tierUsed} | Time: ${resp.elapsedMs} ms`);
    console.log(`Answer: "${answerText}"`);
    console.log(`MSMARCO-XI Verified: ${isMSMARCOVerified ? "YES" : "NO"}`);
    if (matchedEvidence.length > 0) {
      console.log(`Primary Evidence Chunk:`, matchedEvidence[0]);
    }
  }

  // Summary calculation
  const total = results.length;
  const verifiedCount = results.filter(r => r.isMSMARCOVerified).length;
  const l1Count = results.filter(r => r.tierUsed === "L1 hot corpus").length;
  const l2Count = results.filter(r => r.tierUsed === "Qdrant L2").length;
  const refusedCount = results.filter(r => r.answerStatus === "REFUSED").length;
  const incorrectCount = results.filter(r => r.answerStatus === "ERROR").length;
  const hallucinationCount = results.filter(r => r.answerStatus === "GROUNDED" && !r.isMSMARCOVerified).length;

  const summary = {
    pass: verifiedCount >= 8 && hallucinationCount === 0,
    total,
    verifiedCount,
    l1Count,
    l2Count,
    refusedCount,
    incorrectCount,
    hallucinationCount,
    results
  };

  fs.writeFileSync("docs/benchmark-results/live-msmarco-verification.json", JSON.stringify(summary, null, 2));
  console.log("\n================ SUMMARY RESULTS ================");
  console.log(`MSMARCO-XI DATASET RETRIEVAL: ${summary.pass ? "PASS" : "FAIL"}`);
  console.log(`Questions tested: ${total}`);
  console.log(`Verified from MSMARCO-XI: ${verifiedCount}/${total}`);
  console.log(`L1 hot corpus: ${l1Count}/${total}`);
  console.log(`Qdrant L2: ${l2Count}/${total}`);
  console.log(`Refused: ${refusedCount}/${total}`);
  console.log(`Incorrect: ${incorrectCount}/${total}`);
  console.log(`Hallucinations: ${hallucinationCount}/${total}`);
}

runVerification().catch(console.error);
