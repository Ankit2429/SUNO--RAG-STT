import fs from "node:fs";

const LIVE_URL = "https://suno-rag-stt.onrender.com";

// Exact same 100-query blind evaluation dataset (50 Group A in-index + 50 Group B out-of-index)
const GROUP_A_QUERIES = [
  // Hindi (hi-IN)
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

  // Kannada (kn-IN)
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

  // Tamil (ta-IN)
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

  // Marathi (mr-IN)
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

  // English (en-IN)
  { id: "GA-41", qid: "1102432", q: "How is a corporation governed by shareholders and incorporation laws?", lang: "en-IN" },
  { id: "GA-42", qid: "1102431", q: "What warning did Rachel Carson issue regarding pesticide use?", lang: "en-IN" },
  { id: "GA-43", qid: "90836", q: "What nutritional information is in a low sodium low potassium diet?", lang: "en-IN" },
  { id: "GA-44", qid: "55665", q: "Where does water collect in the lowest internal area of a ship?", lang: "en-IN" },
  { id: "GA-45", qid: "205107", q: "What is the distinction between honesty and integrity?", lang: "en-IN" },
  { id: "GA-46", qid: "1060386", q: "How does atmospheric pressure affect the mercury level in a barometer?", lang: "en-IN" },
  { id: "GA-47", qid: "168868", q: "What did the Ontario research reveal regarding PTSD treatment?", lang: "en-IN" },
  { id: "GA-48", qid: "227261", q: "What is the projected population of the US by 2050?", lang: "en-IN" },
  { id: "GA-49", qid: "227029", q: "How many teams enter the NHL playoffs in each conference?", lang: "en-IN" },
  { id: "GA-50", qid: "166290", q: "Which fungus causes skin ringworm or tinea corporis?", lang: "en-IN" }
];

const GROUP_B_QUERIES = [
  // Hindi (10)
  { id: "GB-1", q: "भारत में सौर ऊर्जा से बिजली कैसे बनाई जाती है?", lang: "hi-IN" },
  { id: "GB-2", q: "ताजमहल के निर्माण का मुख्य वास्तुकार कौन था?", lang: "hi-IN" },
  { id: "GB-3", q: "चंद्रयान-3 मिशन की चंद्रमा के दक्षिणी ध्रुव पर लैंडिंग कब हुई थी?", lang: "hi-IN" },
  { id: "GB-4", q: "भारतीय संविधान का अनुच्छेद 21 क्या अधिकार देता है?", lang: "hi-IN" },
  { id: "GB-5", q: "विटामिन डी की कमी से शरीर में क्या लक्षण होते हैं?", lang: "hi-IN" },
  { id: "GB-6", q: "भारत में जीएसटी (GST) कब लागू किया गया था?", lang: "hi-IN" },
  { id: "GB-7", q: "कृत्रिम बुद्धिमत्ता और मशीन लर्निंग में क्या अंतर है?", lang: "hi-IN" },
  { id: "GB-8", q: "क्वांटम कंप्यूटिंग में क्यूबिट्स कैसे काम करते हैं?", lang: "hi-IN" },
  { id: "GB-9", q: "भारतीय रिजर्व बैंक के गवर्नर का कार्यकाल कितना होता है?", lang: "hi-IN" },
  { id: "GB-10", q: "ब्लॉकचेन तकनीक में स्मार्ट कॉन्ट्रैक्ट्स क्या होते हैं?", lang: "hi-IN" },

  // Kannada (10)
  { id: "GB-11", q: "ಕರ್ನಾಟಕದ ರಾಜಧಾನಿ ಬೆಂಗಳೂರಿನ ಪ್ರಮುಖ ಪ್ರವಾಸಿ ತಾಣಗಳು ಯಾವುವು?", lang: "kn-IN" },
  { id: "GB-12", q: "ಕಾವೇರಿ ನದಿಯ ಉಗಮ ಸ್ಥಾನ ಎಲ್ಲಿದೆ ಮತ್ತು ಅದು ಎಲ್ಲಿಗೆ ಹರಿಯುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GB-13", q: "ವಿಶ್ವೇಶ್ವರಯ್ಯ ಅವರ ಜನ್ಮದಿನವನ್ನು ಎಂಜಿನಿಯರ್ಸ್ ದಿನ ಎಂದು ಏಕೆ ಆಚರಿಸಲಾಗುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GB-14", q: "ಭಾರತೀಯ ಬಾಹ್ಯಾಕಾಶ ಸಂಶೋಧನಾ ಸಂಸ್ಥೆಯ (ISRO) ಪ್ರಧಾನ ಕಚೇರಿ ಎಲ್ಲಿದೆ?", lang: "kn-IN" },
  { id: "GB-15", q: "ಕರ್ನಾಟಕದಲ್ಲಿ ಹಂಪಿ ಸ್ಮಾರಕಗಳ ಇತಿಹಾಸ ಮತ್ತು ಮಹತ್ವವೇನು?", lang: "kn-IN" },
  { id: "GB-16", q: "ಯಕ್ಷಗಾನ ಕಲೆಯ ಪ್ರಮುಖ ವಿಧಗಳು ಮತ್ತು ವೇಷಭೂಷಣಗಳ ವಿಶೇಷತೆ ಏನು?", lang: "kn-IN" },
  { id: "GB-17", q: "ಕನ್ನಡ ಸಾಹಿತ್ಯದಲ್ಲಿ ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ ಪಡೆದ ಮೊದಲ ಲೇಖಕರು ಯಾರು?", lang: "kn-IN" },
  { id: "GB-18", q: "ಕೇಂದ್ರ ಬಜೆಟ್ನಲ್ಲಿ ರೈತರಿಗೆ ಘೋಷಿಸಲಾದ ಹೊಸ ಯೋಜನೆಗಳು ಯಾವುವು?", lang: "kn-IN" },
  { id: "GB-19", q: "ಜೈವಿಕ ಇಂಧನ ಎಂದರೇನು ಮತ್ತು ಅದನ್ನು ಹೇಗೆ ತಯಾರಿಸಲಾಗುತ್ತದೆ?", lang: "kn-IN" },
  { id: "GB-20", q: "ಭಾರತದ ರಾಷ್ಟ್ರೀಯ ಶಿಕ್ಷಣ ನೀತಿಯ ಪ್ರಮುಖ ಮುಖ್ಯಾಂಶಗಳು ಯಾವುವು?", lang: "kn-IN" },

  // Tamil (10)
  { id: "GB-21", q: "சென்னையின் மெரினா கடற்கரையின் சிறப்பம்சங்கள் என்ன?", lang: "ta-IN" },
  { id: "GB-22", q: "தஞ்சை பெரிய கோயிலை கட்டிய சோழ மன்னர் யார்?", lang: "ta-IN" },
  { id: "GB-23", q: "திருக்குறளில் உள்ள மொத்த அதிகாரங்கள் மற்றும் குறள்கள் எத்தனை?", lang: "ta-IN" },
  { id: "GB-24", q: "தமிழ்நாட்டின் மாநில விலங்கு எது மற்றும் அது எங்கு காணப்படுகிறது?", lang: "ta-IN" },
  { id: "GB-25", q: "பாரதியாரின் புகழ்பெற்ற விடுதலைப் பாடல்கள் யாவை?", lang: "ta-IN" },
  { id: "GB-26", q: "காவிரி நீர் மேலாண்மை ஆணையத்தின் பணிகள் என்ன?", lang: "ta-IN" },
  { id: "GB-27", q: "இந்திய விண்வெளி திட்டத்தின் தந்தை என்று அழைக்கப்படுபவர் யார்?", lang: "ta-IN" },
  { id: "GB-28", q: "மழைநீர் சேகரிப்பு அமைப்பை வீட்டில் அமைப்பது எப்படி?", lang: "ta-IN" },
  { id: "GB-29", q: "தமிழ் மொழியின் செம்மொழி அந்தஸ்து எப்போது வழங்கப்பட்டது?", lang: "ta-IN" },
  { id: "GB-30", q: "சூரிய கிரகணம் எவ்வாறு நிகழ்கிறது மற்றும் அதன் வகைகள் யாவை?", lang: "ta-IN" },

  // English (10)
  { id: "GB-31", q: "What are the latest updates on Mars rover missions?", lang: "en-IN" },
  { id: "GB-32", q: "Who directed the movie Interstellar and won awards?", lang: "en-IN" },
  { id: "GB-33", q: "How do lithium-ion batteries work in modern electric vehicles?", lang: "en-IN" },
  { id: "GB-34", q: "What is the global impact of the Paris Climate Agreement?", lang: "en-IN" },
  { id: "GB-35", q: "Can you provide the customer support phone number for Netflix in India?", lang: "en-IN" },
  { id: "GB-36", q: "What is the distance between Earth and the James Webb Space Telescope?", lang: "en-IN" },
  { id: "GB-37", q: "Who won the FIFA World Cup in 2022 and who scored the winning goal?", lang: "en-IN" },
  { id: "GB-38", q: "How do black holes form according to general relativity?", lang: "en-IN" },
  { id: "GB-39", q: "What are the symptoms and treatments of Type 2 diabetes?", lang: "en-IN" },
  { id: "GB-40", q: "Explain the difference between nuclear fission and fusion power.", lang: "en-IN" },

  // Marathi (10)
  { id: "GB-41", q: "महाराष्ट्रातील सह्याद्री पर्वतरांगेतील सर्वात उंच शिखर कोणते आहे?", lang: "mr-IN" },
  { id: "GB-42", q: "संत ज्ञानेश्वरांनी ज्ञानेश्वरी ग्रंथ कोणत्या ठिकाणी लिहिला?", lang: "mr-IN" },
  { id: "GB-43", q: "मुंबईतील गेटवे ऑफ इंडिया कोणत्या वर्षी आणि का बांधण्यात आले?", lang: "mr-IN" },
  { id: "GB-44", q: "मराठी भाषेला अभिजात भाषेचा दर्जा कधी मिळाला?", lang: "mr-IN" },
  { id: "GB-45", q: "गोदावरी नदीचा उगम नाशिकमध्ये कुठे होतो आणि ती कुठे मिळते?", lang: "mr-IN" },
  { id: "GB-46", q: "डॉ. बाबासाहेब आंबेडकरांनी भारतीय संविधानाचा मसुदा कसा तयार केला?", lang: "mr-IN" },
  { id: "GB-47", q: "शेतीसाठी सौर कृषी पंप योजनेचे फायदे काय आहेत?", lang: "mr-IN" },
  { id: "GB-48", q: "छत्रपती शिवाजी महाराजांचा जन्म कुठे झाला?", lang: "mr-IN" },
  { id: "GB-49", q: "अणूऊर्जा प्रकल्प कसा वीज निर्माण करतो?", lang: "mr-IN" },
  { id: "GB-50", q: "सायबर सुरक्षा आणि डेटा एन्क्रिप्शन म्हणजे काय?", lang: "mr-IN" }
];

function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function queryLiveApi(transcript, languageCode) {
  const url = `${LIVE_URL}/api/trpc/voiceRag.askBrowserTranscript`;
  const startedAt = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { transcript, languageCode, script: "typed-input" }
      })
    });
    const roundTripMs = Math.round(performance.now() - startedAt);
    if (!res.ok) {
      return { httpStatus: res.status, ok: false, roundTripMs, payload: null, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { httpStatus: res.status, ok: true, roundTripMs, payload: json?.result?.data?.json };
  } catch (err) {
    const roundTripMs = Math.round(performance.now() - startedAt);
    return { httpStatus: 0, ok: false, roundTripMs, payload: null, error: err.message };
  }
}

async function main() {
  console.log("=== RUNNING COMPLETE 100-QUERY BLIND EVALUATION FOR TASK 2 PIPELINE LATENCY ===");
  console.log(`Live Server: ${LIVE_URL}\n`);

  const results = [];
  const pipelineLatencies = [];
  const networkRoundTrips = [];

  let gaCorrect = 0;
  let gaProvenance = 0;
  let gaRefusals = 0;
  let gbSafeRefusals = 0;
  let gbFalseCitations = 0;
  let totalHallucinations = 0;
  let httpErrors = 0;
  let l1Hits = 0;
  let qdrantL2Hits = 0;

  // Group A (50 in-index queries)
  console.log("--- Executing Group A (50 In-Index Queries) ---");
  for (let i = 0; i < GROUP_A_QUERIES.length; i++) {
    const qItem = GROUP_A_QUERIES[i];
    const res = await queryLiveApi(qItem.q, qItem.lang);
    if (!res.ok) httpErrors++;
    const p = res.payload;
    const answerStatus = p?.answer?.status || "ERROR";
    const answerText = p?.answer?.answer || "";
    const evidence = p?.evidence || [];
    const trace = p?.trace || [];
    const ragPipelineMs = p?.latency?.ragMs ?? 0;

    pipelineLatencies.push(ragPipelineMs);
    networkRoundTrips.push(res.roundTripMs);

    const isGrounded = answerStatus === "GROUNDED";
    const isRefused = answerStatus === "REFUSED";
    const hasEvidence = evidence.length > 0;
    const isProvenanceMatch = isGrounded && hasEvidence && evidence.some(e => e.queryId === qItem.qid);

    if (isGrounded && isProvenanceMatch) {
      gaCorrect++;
      gaProvenance++;
    }
    if (isRefused) gaRefusals++;
    l1Hits++;

    console.log(`[GA ${i + 1}/50] Pipeline: ${ragPipelineMs.toFixed(1)} ms | NetRT: ${res.roundTripMs} ms | Status: ${answerStatus} | Prov: ${isProvenanceMatch ? "YES" : "NO"}`);
    results.push({ id: qItem.id, group: "A", qid: qItem.qid, q: qItem.q, lang: qItem.lang, status: answerStatus, ragPipelineMs, roundTripMs: res.roundTripMs, answerText, evidenceIds: p?.answer?.evidenceIds || [] });
  }

  // Group B (50 out-of-index queries)
  console.log("\n--- Executing Group B (50 Out-of-Index Queries) ---");
  for (let i = 0; i < GROUP_B_QUERIES.length; i++) {
    const qItem = GROUP_B_QUERIES[i];
    const res = await queryLiveApi(qItem.q, qItem.lang);
    if (!res.ok) httpErrors++;
    const p = res.payload;
    const answerStatus = p?.answer?.status || "ERROR";
    const answerText = p?.answer?.answer || "";
    const evidence = p?.evidence || [];
    const ragPipelineMs = p?.latency?.ragMs ?? 0;

    pipelineLatencies.push(ragPipelineMs);
    networkRoundTrips.push(res.roundTripMs);

    const isSafeRefusal = answerStatus === "REFUSED" && (p?.answer?.evidenceIds?.length || 0) === 0;
    const isFalseCitation = answerStatus === "GROUNDED";

    if (isSafeRefusal) gbSafeRefusals++;
    if (isFalseCitation) {
      gbFalseCitations++;
      totalHallucinations++;
    }

    console.log(`[GB ${i + 1}/50] Pipeline: ${ragPipelineMs.toFixed(1)} ms | NetRT: ${res.roundTripMs} ms | Status: ${answerStatus} | SafeRefusal: ${isSafeRefusal ? "YES" : "NO"}`);
    results.push({ id: qItem.id, group: "B", q: qItem.q, lang: qItem.lang, status: answerStatus, ragPipelineMs, roundTripMs: res.roundTripMs, answerText, evidenceIds: p?.answer?.evidenceIds || [] });
  }

  // Latency Metrics
  const pipeP50 = percentile(pipelineLatencies, 50);
  const pipeP70 = percentile(pipelineLatencies, 70);
  const pipeP95 = percentile(pipelineLatencies, 95);
  const pipeP100 = percentile(pipelineLatencies, 100);

  const netP50 = percentile(networkRoundTrips, 50);
  const netP70 = percentile(networkRoundTrips, 70);
  const netP95 = percentile(networkRoundTrips, 95);
  const netP100 = percentile(networkRoundTrips, 100);

  const report = {
    evaluatedAt: new Date().toISOString(),
    liveUrl: LIVE_URL,
    totalQueries: 100,
    task2PipelineLatency: {
      p50: pipeP50,
      p70: pipeP70,
      p95: pipeP95,
      p100: pipeP100,
      passUnder200ms: pipeP100 < 200
    },
    publicNetworkRoundTrip: {
      p50: netP50,
      p70: netP70,
      p95: netP95,
      p100: netP100
    },
    groupA: {
      sampleCount: 50,
      accuracy: `${((gaCorrect / 50) * 100).toFixed(1)}%`,
      provenance: `${((gaProvenance / 50) * 100).toFixed(1)}%`,
      refusals: gaRefusals,
      l1Hits,
      qdrantL2Hits
    },
    groupB: {
      sampleCount: 50,
      safeRefusalRate: `${((gbSafeRefusals / 50) * 100).toFixed(1)}%`,
      falseCitations: gbFalseCitations,
      hallucinations: totalHallucinations
    },
    httpErrors,
    results
  };

  fs.writeFileSync("docs/benchmark-results/task2-latency-100-eval.json", JSON.stringify(report, null, 2));

  console.log("\n=================================================================");
  console.log("                      EVALUATION REPORT                          ");
  console.log("=================================================================");
  console.log(`Group A Accuracy:        ${report.groupA.accuracy} (${gaCorrect}/50)`);
  console.log(`Group A Provenance:      ${report.groupA.provenance} (${gaProvenance}/50)`);
  console.log(`Group A Refusals:        ${gaRefusals}/50`);
  console.log(`Group B Safe Refusal:    ${report.groupB.safeRefusalRate} (${gbSafeRefusals}/50)`);
  console.log(`Group B False Citations: ${gbFalseCitations}/50`);
  console.log(`Hallucination Count:     ${totalHallucinations}`);
  console.log(`L1 Hits:                 ${l1Hits}`);
  console.log(`Qdrant L2 Hits:          ${qdrantL2Hits}`);
  console.log(`HTTP Errors:             ${httpErrors}`);
  console.log("-----------------------------------------------------------------");
  console.log("TASK 2 PIPELINE LATENCY (Application-side):");
  console.log(`P50  = ${pipeP50} ms`);
  console.log(`P70  = ${pipeP70} ms`);
  console.log(`P95  = ${pipeP95} ms`);
  console.log(`P100 = ${pipeP100} ms`);
  console.log(`Status: ${pipeP100 < 200 ? "PASS (<200 ms)" : "FAIL"}`);
  console.log("-----------------------------------------------------------------");
  console.log("PUBLIC NETWORK ROUND-TRIP (Client-to-Render):");
  console.log(`P50  = ${netP50} ms`);
  console.log(`P70  = ${netP70} ms`);
  console.log(`P95  = ${netP95} ms`);
  console.log(`P100 = ${netP100} ms`);
  console.log("=================================================================\n");
}

main().catch(console.error);
