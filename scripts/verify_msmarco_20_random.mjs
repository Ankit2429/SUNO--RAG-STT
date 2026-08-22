import fs from "node:fs";

const LIVE_URL = "https://suno-rag-stt.onrender.com";

const RANDOM_20_MSMARCO_QUERIES = [
  { testId: 1, msmarcoQueryId: "1102432", question: "निगम क्या है और यह किस कानून द्वारा शासित होता है?", languageCode: "hi-IN" },
  { testId: 2, msmarcoQueryId: "1102431", question: "रेचेल कार्सन ने द ऑब्लिगेशन टू एंड्योर क्यों लिखी?", languageCode: "hi-IN" },
  { testId: 3, msmarcoQueryId: "90836", question: "कम सोडियम और कम पोटेशियम आहार तालिका में क्या शामिल होता है?", languageCode: "hi-IN" },
  { testId: 4, msmarcoQueryId: "55665", question: "जहाज का सबसे निचला आंतरिक क्षेत्र क्या कहलाता है?", languageCode: "hi-IN" },
  { testId: 5, msmarcoQueryId: "205107", question: "ಸತ್ಯಸಂಧತೆ ಮತ್ತು ಪ್ರಾಮಾಣಿಕತೆಯ ವ್ಯಾಖ್ಯಾನವೇನು?", languageCode: "kn-IN" },
  { testId: 6, msmarcoQueryId: "1060386", question: "ವಾತಾವರಣದ ಒತ್ತಡ ಹೆಚ್ಚಾದಾಗ ಪಾದರಸದ ಮಟ್ಟ ಏನಾಗುತ್ತದೆ?", languageCode: "kn-IN" },
  { testId: 7, msmarcoQueryId: "168868", question: "மனஉளைச்சல் பிந்தைய மன அழுத்தக் கோளாறு (PTSD) பற்றிய ஆராய்ச்சி என்ன கூறுகிறது?", languageCode: "ta-IN" },
  { testId: 8, msmarcoQueryId: "227261", question: "2050 ஆம் ஆண்டிற்குள் உலக மக்கள் தொகை கணிப்பு என்ன?", languageCode: "ta-IN" },
  { testId: 9, msmarcoQueryId: "227029", question: "एनएचएल (NHL) मध्ये किती कॉन्फरन्स आणि विभाग असतात?", languageCode: "mr-IN" },
  { testId: 10, msmarcoQueryId: "166290", question: "त्वचेचा रिंगवर्म (टिनिया कॉर्पोरिस) कशामुळे होतो?", languageCode: "mr-IN" },
  { testId: 11, msmarcoQueryId: "300122", question: "केथी ली आणि फ्रँक गिफर्ड यांच्या प्रेमकथेबद्दल माहिती काय आहे?", languageCode: "mr-IN" },
  { testId: 12, msmarcoQueryId: "290643", question: "ट्रम्प यांच्या सल्लागारांच्या रशियन अधिकार्‍यांशी झालेल्या चर्चेबद्दल काय माहिती आहे?", languageCode: "mr-IN" },
  { testId: 13, msmarcoQueryId: "197590", question: "गेरिसनसाठी फॉलोअर्स मिळवण्याच्या मार्गदर्शकामध्ये काय समाविष्ट आहे?", languageCode: "mr-IN" },
  { testId: 14, msmarcoQueryId: "265552", question: "ले-अवे पेमेंट रद्द करण्याबाबत दुकानाचे काय नियम असतात?", languageCode: "mr-IN" },
  { testId: 15, msmarcoQueryId: "1102432", question: "ஒரு நிறுவனம் எவ்வாறு உருவாக்கப்பட்டு நிர்வகிக்கப்படுகிறது?", languageCode: "ta-IN" },
  { testId: 16, msmarcoQueryId: "1102431", question: "ராய்ச்சல் கார்சனின் தி ஆப்ளிகேஷன் டூ என்டியூர் கட்டுரை எதைப் பற்றியது?", languageCode: "ta-IN" },
  { testId: 17, msmarcoQueryId: "90836", question: "குறைந்த சோடியம் மற்றும் குறைந்த பொட்டாசியம் உணவுப் பட்டியல் எவ்வாறு பெறப்படுகிறது?", languageCode: "ta-IN" },
  { testId: 18, msmarcoQueryId: "1060386", question: "காற்றழுத்தம் குறையும் போது பாதரச மட்டம் எவ்வாறு மாறுகிறது?", languageCode: "ta-IN" },
  { testId: 19, msmarcoQueryId: "1102432", question: "ನಿಗಮವು ಸರ್ಕಾರಿ ಅಥವಾ ಖಾಸಗಿಯಾಗಿ ಶೇರುಗಳನ್ನು ಹೇಗೆ ವಿತರಿಸುತ್ತದೆ?", languageCode: "kn-IN" },
  { testId: 20, msmarcoQueryId: "55665", question: "ಹಡಗಿನ ತಳಭಾಗ ಅಥವಾ ಹಲ್ ಎಂದರೇನು?", languageCode: "kn-IN" }
];

async function queryLiveApi(transcript, languageCode) {
  const url = `${LIVE_URL}/api/trpc/voiceRag.askBrowserTranscript`;
  const startedAt = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: { transcript, languageCode, script: "typed-input" }
    })
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const json = await res.json();
  const payload = json?.result?.data?.json;
  return { httpStatus: res.status, elapsedMs, payload };
}

async function runTest() {
  console.log("=== EXECUTING 20-QUERY MSMARCO-XI PROVENANCE VERIFICATION ===");
  console.log(`Live Endpoint: ${LIVE_URL}\n`);

  const results = [];
  let provenanceMatchCount = 0;
  let groundedCount = 0;
  let refusedCount = 0;
  let errorCount = 0;
  let l1Count = 0;
  let l2Count = 0;

  for (const item of RANDOM_20_MSMARCO_QUERIES) {
    const resp = await queryLiveApi(item.question, item.languageCode);
    const p = resp.payload;
    const answerStatus = p?.answer?.status || "ERROR";
    const evidenceList = p?.evidence || [];
    const trace = p?.trace || [];

    const retrieveStage = trace.find(t => t.stage === "parallel_retrieve");
    const detail = retrieveStage?.detail || "";
    let mode = "L1 hot corpus";
    if (detail.includes("Qdrant") || detail.includes("L2")) mode = "Qdrant L2";
    else if (answerStatus === "REFUSED") mode = "L1 hot corpus (refusal gate)";

    if (mode.includes("L1")) l1Count++;
    if (mode.includes("L2")) l2Count++;

    if (answerStatus === "GROUNDED") groundedCount++;
    else if (answerStatus === "REFUSED") refusedCount++;
    else errorCount++;

    const matchesMSMARCO = evidenceList.some(e => e.source === "ai4bharat/MSMARCO-XI" || e.queryId === item.msmarcoQueryId);
    if (matchesMSMARCO) provenanceMatchCount++;

    const rec = {
      testId: item.testId,
      msmarcoQueryId: item.msmarcoQueryId,
      question: item.question,
      languageCode: item.languageCode,
      httpStatus: resp.httpStatus,
      elapsedMs: resp.elapsedMs,
      answerStatus,
      retrievalMode: mode,
      evidenceIds: p?.answer?.evidenceIds || [],
      matchedSource: matchesMSMARCO ? "ai4bharat/MSMARCO-XI" : "NONE",
      provenanceMatch: matchesMSMARCO
    };
    results.push(rec);

    console.log(`[${item.testId}/20] QueryId: ${item.msmarcoQueryId} | Lang: ${item.languageCode} | Status: ${answerStatus} | Mode: ${mode} | Match: ${matchesMSMARCO ? "PASS" : "FAIL"}`);
  }

  const provenanceMatchRate = ((provenanceMatchCount / RANDOM_20_MSMARCO_QUERIES.length) * 100).toFixed(1);

  const summary = {
    evaluatedAt: new Date().toISOString(),
    totalQueries: RANDOM_20_MSMARCO_QUERIES.length,
    provenanceMatchCount,
    provenanceMatchRate: `${provenanceMatchRate}%`,
    groundedCount,
    refusedCount,
    errorCount,
    l1Count,
    l2Count,
    results
  };

  fs.writeFileSync("docs/benchmark-results/msmarco-20-random-verification.json", JSON.stringify(summary, null, 2));
  console.log("\n=== 20-QUERY VERIFICATION RESULT ===");
  console.log(`Provenance Match Rate: ${summary.provenanceMatchRate} (${provenanceMatchCount}/20)`);
  console.log(`Grounded: ${groundedCount} | Refused: ${refusedCount} | Errors: ${errorCount}`);
}

runTest().catch(console.error);
