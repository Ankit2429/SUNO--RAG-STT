import { hybridRetrieve } from "../server/rag/retrieval.ts";
import { verifyAndSynthesize } from "../server/rag/guardrails.ts";
import fs from "fs";

// GROUP A: 50 Fresh queries
const GROUP_A_QUERIES = [
  { id: "GA-1", qid: "1102432", q: "निगम का मुख्य उद्देश्य क्या होता है?", lang: "hi-IN" },
  { id: "GA-2", qid: "1102431", q: "ऑब्लिगेशन टू एंड्योर निबंध में किस समस्या पर चेतावनी दी गई है?", lang: "hi-IN" },
  { id: "GA-3", qid: "90836", q: "स्वास्थ्य आहार में पोटेशियम और सोडियम की भूमिका क्या है?", lang: "hi-IN" },
  { id: "GA-4", qid: "55665", q: "जहाज के निचले हिस्से या हल का क्या महत्व है?", lang: "hi-IN" },
  { id: "GA-5", qid: "205107", q: "सत्य निष्ठा और ईमानदारी में क्या अंतर है?", lang: "hi-IN" },
  { id: "GA-6", qid: "1060386", q: "बैरोमीटर में पारे का स्तर वायुमंडलीय दबाव से कैसे बदलता है?", lang: "hi-IN" },
  { id: "GA-7", qid: "1090356", q: "स्ट्रथर्स प्राथमिक विद्यालय कितने छात्रों को शिक्षा देता है?", lang: "hi-IN" },
  { id: "GA-8", qid: "168868", q: "कनाडा में पीटीएसडी (PTSD) पर हुए शोध के क्या निष्कर्ष हैं?", lang: "hi-IN" },
  { id: "GA-9", qid: "300122", q: "कैथी ली और फ्रैंक गिफर्ड की प्रेम कहानी का क्या इतिहास है?", lang: "hi-IN" },
  { id: "GA-10", qid: "290643", q: "ट्रम्प सलाहकारों और रूसी अधिकारियों की बातचीत पर क्या रिपोर्ट है?", lang: "hi-IN" },
  { id: "GA-11", qid: "1102432", q: "ನಿಗಮವು ತನ್ನ ಶೇರುದಾರರಿಂದ ಹೇಗೆ ನಿರ್ವಹಿಸಲ್ಪಡುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GA-12", qid: "1102431", q: "ರೇಚಲ್ ಕಾರ್ಸನ್ ಅವರ ಬರಹದ ಶೈಲಿ ಮತ್ತು ತಂತ್ರವೇನು?", lang: "kn-IN" },
  { id: "GA-13", qid: "90836", q: "ಕಡಿಮೆ ಸೋಡಿಯಂ ಆಹಾರದ ಪೌಷ್ಟಿಕಾಂಶದ ವಿವರಗಳು ಎಲ್ಲಿ ಲಭ್ಯವಿವೆ?", lang: "kn-IN" },
  { id: "GA-14", qid: "55665", q: "ಕಾರ್ಗೋ ಹಡಗಿನಲ್ಲಿ ಬಿಲ್ಜ್ ಎಂದರೆ ಏನು?", lang: "kn-IN" },
  { id: "GA-15", qid: "205107", q: "ಪ್ರಾಮಾಣಿಕತೆ ಮತ್ತು ಸತ್ಯಸಂಧತೆಯ ನಡುವಿನ ವ್ಯತ್ಯಾಸವೇನು?", lang: "kn-IN" },
  { id: "GA-16", qid: "1060386", q: "ವಾತಾವರಣದ ಒತ್ತಡವು ಬ್ಯಾರೋಮೀಟರ್ ಮೇಲೆ ಹೇಗೆ ಪ್ರಭಾವ ಬೀರುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GA-17", qid: "168868", q: "ಪಿಟಿಎಸ್ಡಿ (PTSD) ರೋಗಿಗಳಿಗೆ ಗಾಂಜಾ ಸಹಾಯ ಮಾಡುತ್ತದೆ ಎಂಬ ಸಂಶೋಧನೆ ಎಲ್ಲಿದೆ?", lang: "kn-IN" },
  { id: "GA-18", qid: "227261", q: "2050 ರ ವೇಳೆಗೆ ಅಮೆರಿಕದ ಜನಸಂಖ್ಯೆ ಎಷ್ಟು ಹೆಚ್ಚಾಗಬಹುದು?", lang: "kn-IN" },
  { id: "GA-19", qid: "227029", q: "ಎನ್ಹೆಚ್ಎಲ್ ಕಾನ್ಫರೆನ್ಸ್ನಲ್ಲಿ ಎಷ್ಟು ತಂಡಗಳು ಪ್ಲೇಆಫ್ಗೆ ಅರ್ಹತೆ ಪಡೆಯುತ್ತವೆ?", lang: "kn-IN" },
  { id: "GA-20", qid: "166290", q: "ರಿಂಗ್ವರ್ಮ್ ಶಿಲೀಂಧ್ರವು ಮನುಷ್ಯರಲ್ಲಿ ಹೇಗೆ ಹರಡುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GA-21", qid: "1102432", q: "ஒரு நிறுவனம் எவ்வாறு பங்குகளின் மூலம் நிர்வகிக்கப்படுகிறது?", lang: "ta-IN" },
  { id: "GA-22", qid: "1102431", q: "ரேச்சல் கார்சன் சுற்றுச்சூழல் பற்றிய கட்டுரையில் என்ன எச்சரித்துள்ளார்?", lang: "ta-IN" },
  { id: "GA-23", qid: "90836", q: "குறைந்த சோடியம் உணவுப் பட்டியலில் உள்ள ஊட்டச்சத்து தகவல்கள் யாவை?", lang: "ta-IN" },
  { id: "GA-24", qid: "55665", q: "சரக்குக் கப்பலின் பில்ஜ் பகுதியில் நீர் எவ்வாறு சேகரிக்கப்படுகிறது?", lang: "ta-IN" },
  { id: "GA-25", qid: "205107", q: "நேர்மை மற்றும் உண்மைத்தன்மை பற்றிய கருத்துக்கள் யாவை?", lang: "ta-IN" },
  { id: "GA-26", qid: "1060386", q: "பாரோமீட்டரில் பாதரசத்தின் உயரம் எவ்வாறு அளவிடப்படுகிறது?", lang: "ta-IN" },
  { id: "GA-27", qid: "168868", q: "கனடா ஆராய்ச்சியின் படி PTSD பாதிப்புக்கு தீர்வு என்ன?", lang: "ta-IN" },
  { id: "GA-28", qid: "227261", q: "உலக மக்கள் தொகை வளர்ச்சி மற்றும் காற்று மாசுபாடு பற்றிய தகவல் என்ன?", lang: "ta-IN" },
  { id: "GA-29", qid: "227029", q: "NHL விளையாட்டு தொடரில் எத்தனை அணிகள் போட்டியிடுகின்றன?", lang: "ta-IN" },
  { id: "GA-30", qid: "166290", q: "பூஞ்சை தொற்றினால் ஏற்படும் ரிங்வோர்ம் நோய் அறிகுறிகள் யாவை?", lang: "ta-IN" },
  { id: "GA-31", qid: "1102432", q: "कंपनीचे भागधारक तिचे व्यवस्थापन कसे करतात?", lang: "mr-IN" },
  { id: "GA-32", qid: "1102431", q: "राचेल कार्सन यांच्या ऑब्लिगेशन टू एंड्युर निबंधाचे महत्त्व काय आहे?", lang: "mr-IN" },
  { id: "GA-33", qid: "90836", q: "कमी सोडियम आणि कमी पोटॅशियम आहार योजनेची माहिती काय आहे?", lang: "mr-IN" },
  { id: "GA-34", qid: "55665", q: "जहाजाच्या तळाशी पाणी साचणाऱ्या भागाला काय म्हणतात?", lang: "mr-IN" },
  { id: "GA-35", qid: "205107", q: "प्रमाणिकपणा आणि सत्याधारित आचरण याबद्दल काय सांगितले आहे?", lang: "mr-IN" },
  { id: "GA-36", qid: "1060386", q: "हवेचा दाब वाढल्यावर बॅरोमीटरमधील पार्याची पातळी कशी बदलते?", lang: "mr-IN" },
  { id: "GA-37", qid: "168868", q: "कॅनडामधील अभ्यासानुसार पीटीएसडी रुग्णांवर काय परिणाम होतो?", lang: "mr-IN" },
  { id: "GA-38", qid: "227261", q: "२०५० पर्यंत जगाची आणि अमेरिकेची लोकसंख्या किती वाढेल?", lang: "mr-IN" },
  { id: "GA-39", qid: "227029", q: "एनएचएल प्लेऑफ फेरीमध्ये किती संघ सहभागी होतात?", lang: "mr-IN" },
  { id: "GA-40", qid: "166290", q: "ट्रायकोफायटन रुब्रम बुरशीमुळे कोणता आजार होतो?", lang: "mr-IN" },
  { id: "GA-41", qid: "1102432", q: "How is a corporation governed by shareholders and incorporation laws?", lang: "en-IN" },
  { id: "GA-42", qid: "1102431", q: "What warning did Rachel Carson issue regarding pesticide use?", lang: "en-IN" },
  { id: "GA-43", qid: "90836", q: "What nutritional information is in a low sodium low potassium diet?", lang: "en-IN" },
  { id: "GA-44", qid: "55665", q: "Where does water collect in the lowest internal area of a ship?", lang: "en-IN" },
  { id: "GA-45", qid: "205107", q: "What is the distinction between honesty and adherence to facts?", lang: "en-IN" },
  { id: "GA-46", qid: "1060386", q: "How does atmospheric pressure affect the mercury level in a barometer?", lang: "en-IN" },
  { id: "GA-47", qid: "168868", q: "What did the Ontario research reveal regarding PTSD treatment?", lang: "en-IN" },
  { id: "GA-48", qid: "227261", q: "What is the projected population of the US by 2050?", lang: "en-IN" },
  { id: "GA-49", qid: "227029", q: "How many teams enter the NHL playoffs in each conference?", lang: "en-IN" },
  { id: "GA-50", qid: "166290", q: "Which fungus causes skin ringworm or tinea corporis?", lang: "en-IN" }
];

// GROUP B: 50 Fresh out-of-index queries
const GROUP_B_QUERIES = [
  { id: "GB-1", q: "What is the distance between Jupiter and Saturn in kilometers?", lang: "en-IN" },
  { id: "GB-2", q: "What are the core components of the Linux kernel memory manager?", lang: "en-IN" },
  { id: "GB-3", q: "Who was elected mayor of Tokyo in 1995?", lang: "en-IN" },
  { id: "GB-4", q: "What is the chemical reaction formula for synthesizing aspirin?", lang: "en-IN" },
  { id: "GB-5", q: "How many species of hummingbirds live in the Amazon basin?", lang: "en-IN" },
  { id: "GB-6", q: "What is the tuition cost at Melbourne University in 2026?", lang: "en-IN" },
  { id: "GB-7", q: "Who directed the film Inception in 2010?", lang: "en-IN" },
  { id: "GB-8", q: "What is the rules governing offside in ice hockey?", lang: "en-IN" },
  { id: "GB-9", q: "How to fix a leaky kitchen faucet cartridge?", lang: "en-IN" },
  { id: "GB-10", q: "What are the symptoms of acute appendicitis in adults?", lang: "en-IN" },
  { id: "GB-11", q: "ताज महल का निर्माण किस सम्राट ने करवाया था?", lang: "hi-IN" },
  { id: "GB-12", q: "भारत के प्रथम राष्ट्रपति कौन थे?", lang: "hi-IN" },
  { id: "GB-13", q: "सोलर पैनल सौर ऊर्जा को बिजली में कैसे बदलते हैं?", lang: "hi-IN" },
  { id: "GB-14", q: "कंप्यूटर रिस्पॉन्स टाइम कैसे कम करें?", lang: "hi-IN" },
  { id: "GB-15", q: "डिजिटल सिग्नेचर तकनीक कैसे काम करती है?", lang: "hi-IN" },
  { id: "GB-16", q: "चंद्रयान 3 मिशन के लैंडर का नाम क्या था?", lang: "hi-IN" },
  { id: "GB-17", q: "विटामिन सी की कमी से कौन सा रोग होता है?", lang: "hi-IN" },
  { id: "GB-18", q: "संविधान के अनुच्छेद 21 का क्या महत्व है?", lang: "hi-IN" },
  { id: "GB-19", q: "स्मार्टफोन बैटरी की लाइफ कैसे बढ़ाएं?", lang: "hi-IN" },
  { id: "GB-20", q: "क्वांटम कंप्यूटिंग और क्लासिकल कंप्यूटिंग में क्या अंतर है?", lang: "hi-IN" },
  { id: "GB-21", q: "ಕರ್ನಾಟಕದ ರಾಜ್ಯ ರಾಜಧಾನಿ ನಗರ ಯಾವುದು?", lang: "kn-IN" },
  { id: "GB-22", q: "ವಿಶ್ವದ ಅತ್ಯಂತ ಎತ್ತರದ ಶಿಖರ ಯಾವುದು?", lang: "kn-IN" },
  { id: "GB-23", q: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಪ್ರಕ್ರಿಯೆ ಹೇಗೆ ನಡೆಯುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GB-24", q: "ಕಂಪ್ಯೂಟರ್ ಹಾರ್ಡ್ ಡಿಸ್ಕ್ ಹೇಗೆ ಡೇಟಾ ಶೇಖರಿಸುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GB-25", q: "ವಿಟಮಿನ್ ಡಿ ಕೊರತೆಯ ಲಕ್ಷಣಗಳು ಯಾವುವು?", lang: "kn-IN" },
  { id: "GB-26", q: "ಬೆಂಗಳೂರಿನ ಮೆಟ್ರೋ ರೈಲು ಯೋಜನೆ ಯಾವಾಗ ಪ್ರಾರಂಭವಾಯಿತು?", lang: "kn-IN" },
  { id: "GB-27", q: "ವಿಶ್ವಸಂಸ್ಥೆಯ ಪ್ರಧಾನ ಕಚೇರಿ ಎಲ್ಲಿದೆ?", lang: "kn-IN" },
  { id: "GB-28", q: "ಕನ್ನಡ ಸಾಹಿತ್ಯದಲ್ಲಿ ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ ಪಡೆದವರು ಯಾರು?", lang: "kn-IN" },
  { id: "GB-29", q: "ಸೌರಮಂಡಲದ ಅತಿ ದೊಡ್ಡ ಗ್ರಹ ಯಾವುದು?", lang: "kn-IN" },
  { id: "GB-30", q: "ಇಂಟರ್ನೆಟ್ ಪ್ರೋಟೋಕಾಲ್ (IP) ವಿಳಾಸ ಎಂದರೇನು?", lang: "kn-IN" },
  { id: "GB-31", q: "தமிழ்நாட்டின் தலைநகரம் எது?", lang: "ta-IN" },
  { id: "GB-32", q: "சூரிய குடும்பத்தில் மிகப்பெரிய கோள் எது?", lang: "ta-IN" },
  { id: "GB-33", q: "ஒளிச்சேர்க்கை எவ்வாறு நடைபெறுகிறது?", lang: "ta-IN" },
  { id: "GB-34", q: "கணினி நினைவகம் (RAM) எவ்வாறு செயல்படுகிறது?", lang: "ta-IN" },
  { id: "GB-35", q: "இந்தியாவின் முதல் விண்வெளி வீரர் யார்?", lang: "ta-IN" },
  { id: "GB-36", q: "மின்சார மோட்டார் எவ்வாறு சுழல்கிறது?", lang: "ta-IN" },
  { id: "GB-37", q: "வைட்டமின் பி12 குறைபாட்டின் அறிகுறிகள் யாவை?", lang: "ta-IN" },
  { id: "GB-38", q: "திருக்குறளை எழுதியவர் யார்?", lang: "ta-IN" },
  { id: "GB-39", q: "விண்வெளியில் ஈர்ப்பு விசை எவ்வாறு செயல்படுகிறது?", lang: "ta-IN" },
  { id: "GB-40", q: "இணையதள பாதுகாப்பு மற்றும் ஃபயர்வால் என்றால் என்ன?", lang: "ta-IN" },
  { id: "GB-41", q: "ताज महाल बांधणारा सम्राट कोण होता?", lang: "mr-IN" },
  { id: "GB-42", q: "महाराष्ट्राची राजधानी कोणती आहे?", lang: "mr-IN" },
  { id: "GB-43", q: "प्रकाशसंश्लेषण प्रक्रिया कशी होते?", lang: "mr-IN" },
  { id: "GB-44", q: "संगणक रॅम (RAM) कशी कार्य करते?", lang: "mr-IN" },
  { id: "GB-45", q: "व्हिटॅमिन डी च्या कमતરतेची लक्षणे कोणती?", lang: "mr-IN" },
  { id: "GB-46", q: "मुंबईतील पहिली लोकल ट्रेन कधी धावली?", lang: "mr-IN" },
  { id: "GB-47", q: "संयुक्त राष्ट्रांचे मुख्यालय कोठे आहे?", lang: "mr-IN" },
  { id: "GB-48", q: "मराठी साहित्यातील पहिले ज्ञानपीठ विजेते कोण?", lang: "mr-IN" },
  { id: "GB-49", q: "सूर्यमालेतील सर्वात मोठा ग्रह कोणता?", lang: "mr-IN" },
  { id: "GB-50", q: "आयપી एड्रेस म्हणजे काय?", lang: "mr-IN" }
];

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function runEvaluation() {
  console.log("=== IN-PROCESS 100-QUERY BLIND EVALUATION ===");
  const startTotal = Date.now();

  const groupAResults = [];
  const groupBResults = [];

  for (let i = 0; i < GROUP_A_QUERIES.length; i++) {
    const item = GROUP_A_QUERIES[i];
    const start = Date.now();
    const ret = await hybridRetrieve(item.q, item.lang);
    const ans = verifyAndSynthesize(item.q, ret.evidence, ret.scores, item.lang);
    const elapsed = Date.now() - start;

    const isGrounded = ans.status === "GROUNDED";
    const isRefused = ans.status === "REFUSED";
    const evidenceIds = ans.evidenceIds || [];

    const expectedCompanionId = `en-companion-${item.qid}`;
    const provenanceMatch = isGrounded && (evidenceIds.includes(expectedCompanionId) || ret.evidence.some(c => c.queryId === item.qid));
    const isCorrect = isGrounded && provenanceMatch;

    groupAResults.push({
      id: item.id,
      qid: item.qid,
      question: item.q,
      lang: item.lang,
      elapsed,
      status: ans.status,
      answer: ans.answer,
      evidenceIds,
      isGrounded,
      isRefused,
      provenanceMatch,
      isCorrect,
    });
  }

  for (let i = 0; i < GROUP_B_QUERIES.length; i++) {
    const item = GROUP_B_QUERIES[i];
    const start = Date.now();
    const ret = await hybridRetrieve(item.q, item.lang);
    const ans = verifyAndSynthesize(item.q, ret.evidence, ret.scores, item.lang);
    const elapsed = Date.now() - start;

    const isRefused = ans.status === "REFUSED";
    const isGrounded = ans.status === "GROUNDED";
    const evidenceIds = ans.evidenceIds || [];

    const isSafeRefusal = isRefused && evidenceIds.length === 0;
    const isFalseCitation = isGrounded && evidenceIds.length > 0;

    groupBResults.push({
      id: item.id,
      question: item.q,
      lang: item.lang,
      elapsed,
      status: ans.status,
      answer: ans.answer,
      evidenceIds,
      isSafeRefusal,
      isFalseCitation,
    });
  }

  const gaLatencies = groupAResults.map(r => r.elapsed);
  const gbLatencies = groupBResults.map(r => r.elapsed);
  const allLatencies = [...gaLatencies, ...gbLatencies];

  const gaCorrect = groupAResults.filter(r => r.isCorrect).length;
  const gaProvMatches = groupAResults.filter(r => r.provenanceMatch).length;
  const gaRefused = groupAResults.filter(r => r.isRefused).length;

  const gbSafeRefusals = groupBResults.filter(r => r.isSafeRefusal).length;
  const gbFalseCitations = groupBResults.filter(r => r.isFalseCitation).length;

  console.log("\n================ EVALUATION SUMMARY ================");
  console.log(`Group A Accuracy: ${((gaCorrect / 50) * 100).toFixed(1)}% (${gaCorrect}/50)`);
  console.log(`Group A Provenance Match: ${((gaProvMatches / 50) * 100).toFixed(1)}% (${gaProvMatches}/50)`);
  console.log(`Group A Refusals: ${gaRefused}/50`);
  console.log(`Group B Safe Refusal Rate: ${((gbSafeRefusals / 50) * 100).toFixed(1)}% (${gbSafeRefusals}/50)`);
  console.log(`Group B False Citations: ${gbFalseCitations}/50`);
  console.log(`Latency P50: ${percentile(allLatencies, 50)} ms | P90: ${percentile(allLatencies, 90)} ms | P95: ${percentile(allLatencies, 95)} ms | P100: ${percentile(allLatencies, 100)} ms`);
  console.log("=====================================================");

  const report = {
    evaluatedAt: new Date().toISOString(),
    groupA: {
      accuracyPct: `${((gaCorrect / 50) * 100).toFixed(1)}%`,
      provenancePct: `${((gaProvMatches / 50) * 100).toFixed(1)}%`,
      correct: gaCorrect,
      provenanceMatches: gaProvMatches,
      refused: gaRefused,
    },
    groupB: {
      safeRefusalPct: `${((gbSafeRefusals / 50) * 100).toFixed(1)}%`,
      safeRefusals: gbSafeRefusals,
      falseCitations: gbFalseCitations,
    },
    latency: {
      p50: percentile(allLatencies, 50),
      p90: percentile(allLatencies, 90),
      p95: percentile(allLatencies, 95),
      p100: percentile(allLatencies, 100),
    },
    resultsA: groupAResults,
    resultsB: groupBResults,
  };

  fs.writeFileSync("docs/benchmark-results/in-process-100-eval.json", JSON.stringify(report, null, 2));
}

runEvaluation().catch(console.error);
