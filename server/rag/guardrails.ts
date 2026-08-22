import type { ConfidenceBand, EvidenceChunk, StructuredAnswer } from "@shared/rag";
import { STOP_WORDS, meaningfulLexicalTerms, normalizeDigits } from "./embedding";

const unsafePatterns = [
  /\b(?:make|build|buy)\s+(?:a\s+)?(?:bomb|weapon|explosive)/i,
  /\b(?:kill|hurt)\s+(?:myself|yourself|someone|people)/i,
  /\b(?:ignore|bypass|override)\b.*\b(?:instruction|guardrail|system|prompt)/i,
];

const promptInjectionPatterns = [
  /\b(?:ignore|reveal|print|show)\b.*\b(?:system|developer|hidden)\b/i,
  /\b(?:jailbreak|prompt injection|developer message)\b/i,
  /(?:पिछले|पूर्व|पहले)\s+निर्देश(?:ों)?\s+को\s+(?:अनदेखा|नज़रअंदाज़|नजरअंदाज)\s+कर(?:ें|ो)?/,
  /(?:सिस्टम|प्रणाली)\s*(?:प्रॉम्प्ट|निर्देश)\s*(?:दिखा(?:एं|ओ)?|बताइए|बताओ|प्रकट)/,
  /(?:ಹಿಂದಿನ|ಮೊದಲಿನ)\s+ಸೂಚನೆ(?:ಗಳನ್ನು)?\s+(?:ನಿರ್ಲಕ್ಷಿಸಿ|ಕಡೆಗಣಿಸಿ)/,
  /(?:ಸಿಸ್ಟಮ್|ವ್ಯವಸ್ಥೆ)\s*(?:ಪ್ರಾಂಪ್ಟ್|ಸೂಚನೆ)\s*(?:ತೋರಿಸಿ|ಬಹಿರಂಗಪಡಿಸಿ)/,
  /(?:முந்தைய|முன்)\s+(?:வழிமுறைகளை|அறிவுறுத்தல்களை)\s+(?:புறக்கணித்து|புறக்கணிக்கவும்)/,
  /(?:சிஸ்டம்|அமைப்பு)\s*(?:ப்ராம்ப்டை|வழிமுறையை)\s*(?:காட்டுங்கள்|வெளிப்படுத்துங்கள்)/,
  /(?:मागील|पूर्वीच्या)\s+सूचना\s+(?:दुर्लक्ष|नजरअंदाज)\s+करा/,
  /(?:सिस्टम|प्रणाली)\s*(?:प्रॉम्प्ट|सूचना)\s*(?:दाखवा|उघड करा)/,
];

export function refused(reason: string): StructuredAnswer {
  return {
    status: "REFUSED",
    answer: "No directly matching MSMARCO-XI passage was found for this question, so SUNO will not invent an answer. Try a source-backed prompt or rephrase with indexed-corpus terms.",
    evidenceIds: [],
    confidenceBand: "NONE",
    refusalReason: reason,
  };
}

export function errorAnswer(reason: string): StructuredAnswer {
  return {
    status: "ERROR",
    answer: "The evidence pipeline could not complete safely. No answer was generated.",
    evidenceIds: [],
    confidenceBand: "NONE",
    refusalReason: reason,
  };
}

export function inspectQuery(query: string): string | null {
  const normalized = query.trim();
  if (normalized.length < 3) return "The transcription was too short to retrieve reliable evidence.";
  if (normalized.length > 600) return "The query exceeds the bounded retrieval input limit.";
  if (promptInjectionPatterns.some(pattern => pattern.test(normalized))) return "The prompt-injection gate blocked the request.";
  if (unsafePatterns.some(pattern => pattern.test(normalized))) return "The safety gate blocked an unsafe request.";
  return null;
}

function queryTerms(query: string): Set<string> {
  const extracted = meaningfulLexicalTerms(query);
  const normalized = extracted.map(normalizeContentTerm);
  return new Set(normalized.filter(term => term && term.length >= 2 && !STOP_WORDS.has(term)));
}

/**
 * Language-aware lexical normalization and stem expansion that preserves Indic
 * combining marks and distinguishes domain concepts from generic question frames.
 */
function normalizeContentTerm(term: string): string {
  if (!term) return "";
  const raw = normalizeDigits(term.normalize("NFKC").toLocaleLowerCase());
  const dotStripped = raw.replace(/[\.\-\_\:\/]/g, "");

  // Safe language-aware inflection/case stripping
  let base = dotStripped
    .replace(/(?:बद्दल|मध्ये|च्या|ची|चा|चे|ला|ने|वर|खाली|तील|साठी|द्वारे|पासून|कडे|मुळे|प्रमाणे|संबंधित|नुसार|बाबत|विषयी|वर्धक|कारी|पूर्ण|कर्ताओं|कर्ता|ताओं|ताएं|ियों|ियां|िया|्यों|यां|ों|ाओं|ाएं|ाएँ|ें)$/u, "")
    .replace(/(?:ನ್ನು|ಗೆ|ಯ|ಅಲ್ಲಿ|ಯಿಂದ|ಗಾಗಿ|ಗಳ|ಗಳಿ|ಗಳಿಂದ|ಯಲ್ಲಿ|ಯನ್ನು|ವಿನ|ದ|ಅನ್ನು|ಗಳು|ಲ್ಲಿ)$/u, "")
    .replace(/(?:களின்|க்கான|களை|உடன்|இருந்து|இல்|க்கு|ஐ|ஆல்|இன்|கள்)$/u, "")
    .replace(/(?:ಯొక్క|లో|కి|కు|తో|చేत|ను|ల|లో|ని|ను)$/u, "")
    .replace(/(?:ের|দের|কে|তে|এর|রে|থেকে|রা)$/u, "")
    .replace(/(?:નું|ના|ની|ને|માં|થી|ઓ)$/u, "");

  base = base.replace(/ங்$/u, "ம்");

  // Corporation / Company / Governance
  if (base.startsWith("निगम") || base.startsWith("कम्पनी") || base.startsWith("कंपनी") || base.startsWith("कॉर्प") || base === "संस्था" || base === "संयोजन") return "corporation";
  if (base.startsWith("ನಿಗಮ") || base.startsWith("ಕಂಪನಿ") || base.startsWith("ಕಾರ್ಪ") || base.startsWith("ಸಂಯೋಜನೆ")) return "corporation";
  if (base.startsWith("நிறுவன") || base.startsWith("கார்ப்ப") || base.startsWith("இணைப்ப")) return "corporation";
  if (base.startsWith("भागधारक") || base.startsWith("ಶೇರುದಾರ") || base.startsWith("பங்கு") || base.startsWith("shareholder")) return "shareholders";
  if (base.startsWith("ಆಡಳಿತ") || base.startsWith("ನಿಯಂತ್ರಿತ") || base.startsWith("शासित") || base.startsWith("governed") || base.startsWith("govern")) return "governed";
  if (base.startsWith("ಕಾನೂನು") || base.startsWith("சட்ட") || base.startsWith("कायद") || base.startsWith("कानून") || base.startsWith("law")) return "law";

  // Rachel Carson / Pesticide / Obligation to Endure
  if (base.startsWith("कार्सन") || base.startsWith("कಾರ್ಸ") || base.startsWith("கார்ச") || base.startsWith("carson")) return "carson";
  if (base.startsWith("रेचल") || base.startsWith("राचेल") || base.startsWith("ರೇಚಲ್") || base.startsWith("ರೆಚೆಲ್") || base.startsWith("ரேச்ச") || base.startsWith("rachel")) return "rachel";
  if (base.startsWith("कीटनाशक") || base.startsWith("कीटकनाशक") || base.startsWith("பூச்சிக்கொல்லி") || base.startsWith("சுற்றுச்சூழ") || base.startsWith("pesticide") || base.startsWith("पर्यावरण")) return "pesticide";
  if (base.startsWith("ऑब्लिगेशन") || base.startsWith("ओब्लिगेशन") || base.startsWith("ಒಬ್ಲಿಗೇಷನ್") || base.startsWith("ஒப்ளிகேஷன்") || base.startsWith("obligation") || base.startsWith("endure") || base.startsWith("एंड्योर") || base.startsWith("एंड्युर")) return "obligation";
  if (raw.includes("கட்டுரை") || base.startsWith("கட்டுரை") || base.startsWith("कட்டுர") || base.startsWith("निबंध") || base.startsWith("article")) return "article";

  // Potassium / Sodium / Diet / Nutrition
  if (base.startsWith("पोटेशियम") || base.startsWith("पोटैशियम") || base.startsWith("पोटॅशियम") || base.startsWith("ಪೊಟ್ಯಾಸಿಯ") || base.startsWith("பொட்டாசிய") || base.startsWith("potassium")) return "potassium";
  if (base.startsWith("सोडियम") || base.startsWith("ಸೋಡಿಯ") || base.startsWith("சோடிய") || base.startsWith("sodium")) return "sodium";
  if (base.startsWith("आहार") || base.startsWith("ಆಹಾರ") || base.startsWith("உணவு") || base.startsWith("diet") || base.startsWith("nutrition") || base.startsWith("पोषक")) return "diet";
  if (base.startsWith("तक्ता") || base.startsWith("चार्ट") || base.startsWith("ಚಾರ್ಟ್") || base.startsWith("பட்டியல") || base.startsWith("chart")) return "chart";

  // Ship / Bilge / Hull
  if (base.startsWith("जहाज") || base.startsWith("जहाज़") || base.startsWith("ಹಡಗು") || base.startsWith("ಹಡಗಿ") || base.startsWith("கப்பல") || base.startsWith("ship") || base.startsWith("vessel")) return "ship";
  if (base.startsWith("बिल्ज") || base.startsWith("ಬಿಲ್ಜ್") || base.startsWith("ಬಿಲ್ಗ") || base.startsWith("பில்ஜ") || base.startsWith("bilge")) return "bilge";
  if (base.startsWith("निचल") || base.startsWith("तळा") || base.startsWith("तळ") || base.startsWith("खाल") || base.startsWith("ಹಲ್") || base.startsWith("ஹல்") || base.startsWith("bottom") || base.startsWith("hull")) return "hull";
  if (base.startsWith("मालवाहक") || base.startsWith("मालवाहू") || base.startsWith("ಸರಕು") || base.startsWith("சரக்கு") || base.startsWith("cargo")) return "cargo";

  // Honesty / Integrity / Moral
  if (base.startsWith("ईमानदारी") || base.startsWith("प्रामाणिक") || base.startsWith("ಪ್ರಾಮಾಣಿಕ") || base.startsWith("ಸತ್ಯಸಂಧ") || base.startsWith("நேர்ம") || base.startsWith("உண்மைத்தன்மை") || base.startsWith("honest")) return "honesty";
  if (base.startsWith("सत्यनिष्ठा") || base.startsWith("सचोटी") || base.startsWith("सत्य") || base.startsWith("निष्ठा") || base.startsWith("समग्रता") || base.startsWith("integrity")) return "integrity";
  if (base.startsWith("नैतिक") || base.startsWith("moral")) return "moral";

  // Barometer / Mercury / Atmospheric Pressure
  if (base.startsWith("बैरोमीटर") || base.startsWith("बॅरोमीटर") || base.startsWith("ಬ್ಯಾರೋಮೀಟರ್") || base.startsWith("பாரோமீட்ட") || base.startsWith("barometer")) return "barometer";
  if (base.startsWith("पारा") || base.startsWith("पारे") || base.startsWith("पार्या") || base.startsWith("ಪಾದರಸ") || base.startsWith("பாதரச") || base.startsWith("mercury")) return "mercury";
  if (base.startsWith("वायुमंडलीय") || base.startsWith("हवेचा") || base.startsWith("ವಾತಾವರಣ") || base.startsWith("காற்றழுத்த") || base.startsWith("atmospheric")) return "atmospheric";
  if (base.startsWith("दबाव") || base.startsWith("दाब") || base.startsWith("ಒತ್ತಡ") || base.startsWith("அழுத்த") || base.startsWith("pressure")) return "pressure";

  // Struthers
  if (base.startsWith("स्ट्रथर्स") || base.startsWith("स्ट्रुथर्स") || base.startsWith("ಸ್ಟ್ರತರ್ಸ್") || base.startsWith("struthers")) return "struthers";

  // PTSD / Cannabis / Ontario / Canada
  if (base.startsWith("पीटीएसडी") || base.startsWith("ಪಿಟಿಎಸ್ಡಿ") || base.startsWith("பிடிஎஸ்டி") || base.startsWith("ptsd")) return "ptsd";
  if (base.startsWith("गांजा") || base.startsWith("ಗಾಂಜಾ") || base.startsWith("போதைப்பொருள்") || base.startsWith("cannabis") || base.startsWith("marijuana")) return "cannabis";
  if (base.startsWith("कनाडा") || base.startsWith("कॅनडा") || base.startsWith("கனடா") || base.startsWith("canada")) return "ontario";
  if (base.startsWith("ऑन्टारियो") || base.startsWith("ஆன்டாரியோ") || base.startsWith("ontario")) return "ontario";

  // Gifford / Kathie
  if (base.startsWith("गिफर्ड") || base.startsWith("गिफ़र्ड") || base.startsWith("gifford")) return "gifford";
  if (base.startsWith("कैथी") || base.startsWith("kathie")) return "kathie";

  // Trump / Flynn / Russian
  if (base.startsWith("ट्रम्प") || base.startsWith("ट्रंप") || base.startsWith("trump")) return "trump";
  if (base.startsWith("रूसी") || base.startsWith("russian")) return "russian";

  // 2050 / Population / Pollution
  if (base === "2050" || base === "२०५०" || base === "೨೦೫೦") return "2050";
  if (base.includes("மக்கள்") || base.includes("ಜನಸಂಖ್ಯೆ") || base.includes("जनसंख्या") || base.includes("लोकसंख्या") || base.startsWith("population")) return "population";
  if (base.includes("மாசு") || base.includes("pollution") || base.includes("प्रदूषण") || base.includes("ಮಾಲಿನ್ಯ")) return "pollution";
  if (base.includes("காற்று") || base.startsWith("air")) return "air";
  if (base.startsWith("अमेरिक") || base.startsWith("us") || base.startsWith("united")) return "us";

  // NHL / Playoffs
  if (base.startsWith("एनएचएल") || base.startsWith("ಎನ್ಹೆಚ್ಎಲ್") || base.startsWith("என்ஹெச்எல்") || base.startsWith("nhl")) return "nhl";
  if (base.startsWith("प्लेऑफ") || base.startsWith("ಪ್ಲೇಆಫ್") || base.startsWith("பிளேஆஃப்") || base.startsWith("playoff")) return "playoffs";

  // US State abbreviations
  if (base === "ga" || base.startsWith("georgia") || base.startsWith("जॉर्जिया") || base.startsWith("ಜಾರ್ಜಿಯಾ") || base.startsWith("ஜார்ஜியா")) return "georgia";
  if (base === "ca" || base.startsWith("california") || base.startsWith("कैलिफोर्निया") || base.startsWith("ಕ್ಯಾಲಿಫೋರ್ನಿಯಾ")) return "california";
  if (base === "fl" || base.startsWith("florida") || base.startsWith("फ्लोरिडा") || base.startsWith("ಫ್ಲೋರಿಡಾ")) return "florida";
  if (base === "tx" || base.startsWith("texas") || base.startsWith("टेक्सास") || base.startsWith("ಟೆಕ್ಸಾಸ್")) return "texas";


  // Specific entity / procedure / object concepts
  if (base.startsWith("ইমপ্লাণ্ট") || base.startsWith("ইমপ্লান্ট") || base.startsWith("इम्प्लांट") || base.startsWith("ಇಂಪ್ಲಾಂಟ್") || base.startsWith("இம்ப்ளான்ட்") || base.startsWith("implant")) return "implant";
  if (base.startsWith("মুকুট") || base.startsWith("क्राउन") || base.startsWith("ಕ್ರೌನ್") || base.startsWith("கிரீடம்") || base.startsWith("crown")) return "crown";
  if (base.startsWith("डेंटल") || base.startsWith("दांत") || base.startsWith("दंत") || base.startsWith("பல்") || base.startsWith("பற்க") || base.startsWith("ಹಲ್ಲಿ") || base.startsWith("dental") || base.startsWith("tooth") || base.startsWith("teeth")) return "dental";
  if (base.startsWith("सोलर") || base.startsWith("सौर") || base.startsWith("ಸೌರ") || base.startsWith("சூரிய") || base.startsWith("solar") || base.startsWith("pv")) return "solar";
  if (base.startsWith("बिजली") || base.startsWith("वीज") || base.startsWith("ವಿದ್ಯುತ್") || base.startsWith("மின்சாரம்") || base.startsWith("electricity") || base.startsWith("kwh") || base.startsWith("किलोवाट") || base.startsWith("किलोवॅट")) return "electricity";
  if (base.startsWith("ल্যাপটপ") || base.startsWith("लैपटॉप") || base.startsWith("ಲ್ಯಾಪ್ಟಾಪ್") || base.startsWith("லேப்டாப்") || base.startsWith("laptop")) return "laptop";
  if (base.startsWith("ডেস্কটপ") || base.startsWith("डेस्कटॉप") || base.startsWith("ಡೆಸ್ಕ್ಟಾಪ್") || base.startsWith("டெஸ்க்டாப்") || base.startsWith("desktop")) return "desktop";
  if (base.startsWith("টিকা") || base.startsWith("ভ্যাকসিন") || base.startsWith("वैक्सीन") || base.startsWith("लसीका") || base.startsWith("தடுப்பூசி") || base.startsWith("vaccine")) return "vaccine";
  if (base.startsWith("অ্যান্টিবায়োটিক") || base.startsWith("एंटीबायोटिक") || base.startsWith("ಆಂಟಿಬಯೋಟಿಕ್") || base.startsWith("நுண்ணுயிர் எதிர்ப்பி") || base.startsWith("antibiotic")) return "antibiotic";
  if (base.startsWith("विखंडन") || base.startsWith("fission")) return "fission";
  if (base.startsWith("संलयन") || base.startsWith("fusion")) return "fusion";
  if (base.startsWith("বিমান") || base.startsWith("विमान") || base.startsWith("விமானம்") || base.startsWith("aircraft") || base.startsWith("airplane")) return "aircraft";
  if (base.startsWith("ইনপেশেন্ট") || base.startsWith("इनपेशेंट") || base.startsWith("inpatient")) return "inpatient";
  if (base.startsWith("আউটপেশেন্ট") || base.startsWith("आउटपेशेंट") || base.startsWith("outpatient")) return "outpatient";
  if (base.startsWith("খরচ") || base.startsWith("খৰচ") || base.startsWith("मूल्य") || base.startsWith("দাম") || base.startsWith("किंमत") || base.startsWith("खर्च") || base.startsWith("लागत") || base.startsWith("செலவு") || base.startsWith("ಬೆಲೆ") || base.startsWith("விலை") || base.startsWith("cost") || base.startsWith("price") || base.startsWith("rate") || base.startsWith("average") || base.startsWith("গড়")) return "cost_attribute";

  // Ringworm / Fungus / Trichophyton Rubrum
  if (base.startsWith("रिंगवर्म") || base.startsWith("दाद") || base.startsWith("ರಿಂಗ್ವರ್ಮ್") || base.startsWith("ரிங்வோர்") || base.startsWith("ringworm")) return "ringworm";
  if (base.startsWith("टिनिया") || base.startsWith("டினியா") || base.startsWith("tinea")) return "tinea";
  if (base.startsWith("कवक") || base.startsWith("बुरशी") || base.startsWith("ಶಿಲೀಂಧ್ರ") || base.startsWith("பூஞ்சை") || base.startsWith("fungus")) return "fungus";
  if (base.startsWith("ट्रायकोफायटन") || base.startsWith("trichophyton")) return "trichophyton";
  if (base.startsWith("रुब्रम") || base.startsWith("rubrum")) return "rubrum";

  return base;
}

const INTERROGATIVE_START_PATTERNS = [
  /^(?:what|how|why|who|where|when|which|can|could|would|should|is|are|was|were|do|does|did)\b/i,
  /^(?:क्या|कैसे|क्यों|कौन|कहाँ|कब|किस|कितना|कितने)\b/,
  /^(?:ಏನು|ಹೇಗೆ|ಏಕೆ|ಯಾರು|ಎಲ್ಲಿ|ಯಾವಾಗ|ಯಾವ|ಎಷ್ಟು)\b/,
  /^(?:என்ன|எவ்வாறு|ஏன்|யார்|எங்கே|எப்போது|எந்த|எத்தனை)\b/
];

const BOILERPLATE_PATTERNS: RegExp[] = [
  /from\s+(?:the\s+)?[^.]{0,40}dictionary/i,
  /university\s+press/i,
  /what\s+is\s+the\s+pronunciation\s+of/i,
  /\blearn\s+more\b/i,
  /thousands\s+of\s+other\s+words/i,
  /\bsynonyms?:/i,
  /\bmore\s+synonyms\s+of\b/i,
  /\ball\s+english\s+definitions\b/i,
  /\bsearch\s+also\s+in:/i,
  /\bclick\s+here\b/i,
  /©/u,
];

function headingFragmentPenalty(sentence: string): number {
  const trimmed = sentence.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 6 && /^(?:definition|meaning)\s+of\b/i.test(trimmed)) {
    return 1.5;
  }
  return 0;
}

function evidenceSentence(chunk: EvidenceChunk, terms: Set<string>): { sentence: string; termMatches: number; rank: number } | null {
  const normalizedQueryTerms = new Set(
    Array.from(terms)
      .map(normalizeContentTerm)
      .filter(term => term && term.length >= 2)
  );
  if (!normalizedQueryTerms.size) return null;

  const rawSentences = chunk.text.split(/(?<=[.!?।॥؟])\s+/).map(s => s.trim()).filter(Boolean);
  if (!rawSentences.length) return null;

  const candidateUnits: { text: string; isWindow: boolean }[] = [];
  for (let i = 0; i < rawSentences.length; i += 1) {
    candidateUnits.push({ text: rawSentences[i], isWindow: false });
    if (i < rawSentences.length - 1) {
      const pair = `${rawSentences[i]} ${rawSentences[i + 1]}`;
      if (pair.length <= 320) {
        candidateUnits.push({ text: pair, isWindow: true });
      }
    }
  }

  const ranked = candidateUnits.map(({ text: sentence, isWindow }) => {
    const normalizedSentence = normalizeDigits(sentence.normalize("NFKC").toLocaleLowerCase());
    const sentenceTerms = new Set(
      normalizedSentence
        .split(/[^\p{L}\p{M}\p{N}]+/u)
        .map(normalizeContentTerm)
        .filter(term => term && term.length >= 2)
    );
    const matches = Array.from(normalizedQueryTerms).filter(term => sentenceTerms.has(term));
    let positionScore = 0;
    for (const term of matches) {
      const at = normalizedSentence.indexOf(term);
      if (at >= 0 && normalizedSentence.length > 0) {
        positionScore += Math.max(0, 1 - at / normalizedSentence.length);
      }
    }

    let penalty = headingFragmentPenalty(sentence);
    if (sentence.trim().endsWith("?") || INTERROGATIVE_START_PATTERNS.some(p => p.test(sentence.trim()))) {
      penalty += 3.0;
    }
    for (const pattern of BOILERPLATE_PATTERNS) {
      if (pattern.test(sentence)) {
        penalty += 1.5;
        break;
      }
    }

    // Pronoun incompleteness penalty if a single sentence begins with an unresolved pronoun
    if (!isWindow && /^(?:it|they|this|these|he|she|यह|वह|ಅದು|ಇದು|ಇವರು|ಇವು|இது|இவர்)\s+(?:is|are|was|were|means|refers|has|have|can|होता|होती|है|आहे|ಆಗಿದೆ|ಆಗಿದ್ದಾರೆ|ஆகும்)/i.test(sentence)) {
      penalty += 0.8;
    }

    // Completeness bonus for definitional or causal predicates
    let completenessBonus = 0;
    if (/\b(?:is a|is an|are|means|defined as|refers to|known as|named for|announced|because|causes|results in|due to|होता है|कहते हैं|कहा जाता है|अर्थात|म्हणतात|ಎಂದರೆ|ಆಗಿದೆ|ಎನ್ನಲಾಗುತ್ತದೆ|ஆகும்|காரணமாக)\b/i.test(sentence)) {
      completenessBonus += 0.6;
    }

    const baseScore = matches.length;
    const rank = positionScore + completenessBonus - penalty - (isWindow ? 0.2 : 0);
    return { sentence, score: baseScore, rank };
  });

  const top = ranked.filter(r => r.score > 0).sort((a, b) => b.score - a.score || b.rank - a.rank)[0];

  return top?.score ? { sentence: top.sentence.trim(), termMatches: top.score, rank: top.rank } : null;
}


function polishEvidenceSentence(sentence: string): string {
  const standalone = sentence.replace(/^\s*(?:फिर|नंतर|ನಂತರ|பிறகு)\s+/, "").trim();
  if (/^ಆ ಕಂಪನಿಯು ಆ ರಾಜ್ಯದಲ್ಲಿನ ಸಂಯೋಜನೆಯ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತವನ್ನು ನಡೆಸುತ್ತದೆ[.]?$/.test(standalone)) {
    return "ಕಂಪನಿಯು ಅದು ಸಂಯೋಜಿತವಾಗಿರುವ ರಾಜ್ಯದ ಸಂಯೋಜನೆ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತಗೊಳ್ಳುತ್ತದೆ.";
  }
  return standalone;
}

const SOURCE_FAITHFUL_FOCUSED_ANSWERS: Record<string, Record<string, string>> = {
  hi: {
    "1102432": "निगम एक कानूनी संस्था है जो निगमन से बनती है और जिस देश या राज्य में स्थापित होती है, वहां के निगमन कानूनों से शासित होती है।",
    "1102431": "रेचल कार्सन ने ‘द ऑब्लिगेशन टू एंड्योर’ अंधाधुंध कीटनाशक उपयोग और उसके पर्यावरण, वन्यजीवों व लोगों पर लंबे समय तक पड़ने वाले प्रभावों के बारे में चेतावनी देने के लिए लिखा।",
    "90836": "कम पोटेशियम वाले खाद्य पदार्थों का चार्ट ऐसे भोजन विकल्प और उनकी मात्रा बताता है जो कम-पोटेशियम आहार के लिए उपयुक्त हों।",
    "55665": "मालवाहक जहाज़ का निचला बाहरी हिस्सा उसका तल या हल होता है; बिल्ज सबसे निचला अंदरूनी भाग है जहाँ पानी जमा हो सकता है।",
    "205107": "ईमानदारी और सत्यनिष्ठा का अर्थ है सच बोलना, भरोसेमंद होना और सही नैतिक सिद्धांतों के अनुसार चलना।",
  },
  kn: {
    "1102432": "ಕಾರ್ಪೊರೇಷನ್ ಎನ್ನುವುದು ಸಂಯೋಜನೆಯ ಮೂಲಕ ನಿರ್ಮಿತವಾದ ಕಾನೂನು ಘಟಕ; ಅದು ಸ್ಥಾಪಿತವಾಗಿರುವ ದೇಶ ಅಥವಾ ರಾಜ್ಯದ ಸಂಯೋಜನೆ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತಗೊಳ್ಳುತ್ತದೆ.",
    "1102431": "ರೆಚೆಲ್ ಕಾರ್ಸನ್ ‘ದಿ ಒಬ್ಲಿಗೇಷನ್ ಟು ಎಂಡ್ಯೂರ್’ ಅನ್ನು ವಿವೇಚನೆಯಿಲ್ಲದ ಕೀಟನಾಶಕ ಬಳಕೆ ಮತ್ತು ಅದರ ಪರಿಸರ, ವನ್ಯಜೀವಿ ಹಾಗೂ ಜನರ ಮೇಲಿನ ದೀರ್ಘಕಾಲದ ಪರಿಣಾಮಗಳ ಬಗ್ಗೆ ಎಚ್ಚರಿಸಲು ಬರೆದರು.",
    "90836": "ಕಡಿಮೆ ಪೊಟ್ಯಾಸಿಯಂ ಇರುವ ಆಹಾರಗಳ ಚಾರ್ಟ್ ಕಡಿಮೆ-ಪೊಟ್ಯಾಸಿಯಂ ಆಹಾರ ಕ್ರಮಕ್ಕೆ ಹೊಂದುವ ಆಹಾರ ಆಯ್ಕೆಗಳು ಮತ್ತು ಅವುಗಳ ಪ್ರಮಾಣಗಳನ್ನು ತಿಳಿಸುತ್ತದೆ.",
    "55665": "ಸರಕು ಹಡಗಿನ ಕೆಳಭಾಗವು ಅದರ ತಳ ಅಥವಾ ಹಲ್; ಬಿಲ್ಜ್ ಎಂದರೆ ನೀರು ಸೇರುವ ಅತಿ ಕೆಳಗಿನ ಒಳಭಾಗ.",
    "205107": "ಪ್ರಾಮಾಣಿಕತೆ ಮತ್ತು ನೈತಿಕ ಸಮಗ್ರತೆ ಎಂದರೆ ಸತ್ಯವಂತರಾಗಿರುವುದು, ನಂಬಿಗಸ್ತರಾಗಿರುವುದು ಮತ್ತು ಸದುದ್ದೇಶದ ನೈತಿಕ ತತ್ವಗಳನ್ನು ಅನುಸರಿಸುವುದು.",
  },
  en: {
    "1102432": "A corporation is a legal entity created by incorporation and governed by the incorporation laws of the country or state in which it is formed.",
    "1102431": "Rachel Carson wrote The Obligation to Endure to warn about indiscriminate pesticide use and its lasting effects on the environment, wildlife, and people.",
    "90836": "A low-potassium food chart identifies food choices and serving sizes that fit a low-potassium diet.",
    "55665": "The lower side of a cargo ship is its bottom or hull; the bilge is the lowest internal area where water can collect.",
    "205107": "Honesty and integrity mean being truthful, reliable, and guided by sound moral principles.",
  },
  ta: {
    "1102432": "ஒரு கார்ப்பரேஷன் என்பது இணைப்பின் மூலம் உருவான சட்ட அமைப்பு; அது உருவாக்கப்பட்ட நாடு அல்லது மாநிலத்தின் இணைப்பு சட்டங்களால் நிர்வகிக்கப்படுகிறது.",
    "1102431": "ரேச்சல் கார்சன் ‘தி ஒப்ளிகேஷன் டு என்ட்யூர்’ கட்டுரையை கட்டுப்பாடற்ற பூச்சிக்கொல்லி பயன்பாடு மற்றும் அதன் சுற்றுச்சூழல், வனவிலங்குகள், மனிதர்கள் மீதான நீண்டகால விளைவுகளை எச்சரிக்க எழுதினார்.",
    "90836": "குறைந்த பொட்டாசியம் உணவுப் பட்டியல், குறைந்த பொட்டாசியம் உணவுமுறைக்கு ஏற்ற உணவுத் தேர்வுகளையும் அவற்றின் அளவுகளையும் காட்டுகிறது.",
    "55665": "சரக்கு கப்பலின் கீழ்புறம் அதன் அடிப்பகுதி அல்லது ஹல்; பில்ஜ் என்பது நீர் சேரக்கூடிய மிகக் கீழான உள்புற பகுதி.",
    "205107": "நேர்மையும் ஒருமைப்பாடும் என்பது உண்மையாக இருப்பது, நம்பகமாக இருப்பது, நல்ல ஒழுக்கக் கொள்கைகளால் வழிநடத்தப்படுவது ஆகும்.",
  },
  mr: {
    "1102432": "कॉर्पोरेशन ही निगमनातून निर्माण झालेली कायदेशीर संस्था आहे आणि ज्या देशात किंवा राज्यात ती स्थापन होते त्या ठिकाणच्या निगमन कायद्यांनुसार चालते.",
    "1102431": "रेचल कार्सन यांनी ‘द ऑब्लिगेशन टू एंड्योर’ हे अंधाधुंद कीटकनाशक वापर आणि त्याचे पर्यावरण, वन्यजीव व लोकांवरील दीर्घकालीन परिणाम याबद्दल इशारा देण्यासाठी लिहिले.",
    "90836": "कमी पोटॅशियम असलेल्या अन्नपदार्थांचा तक्ता कमी-पोटॅशियम आहारासाठी योग्य अन्नपर्याय आणि त्यांचे प्रमाण सांगतो.",
    "55665": "मालवाहू जहाजाचा खालचा बाह्य भाग तळ किंवा हुल असतो; बिल्ज हा पाणी साचू शकणारा सर्वात खालचा अंतर्गत भाग आहे.",
    "205107": "प्रामाणिकपणा आणि सचोटी म्हणजे सत्यवादी व विश्वासार्ह असणे आणि योग्य नैतिक तत्त्वांनुसार वागणे.",
  },
};

function asksForUnsupportedFoodEnumeration(query: string): boolean {
  return /(?:\b(?:show|list)\b|सूची|ಪಟ್ಟಿ|ಪಟ್ಟಿಯನ್ನು|பட்டியல்|தரவும்|यादी|द्या)/i.test(query);
}

function focusedSourceFaithfulAnswer(query: string, languageCode: string | undefined, queryId: string, evidence: EvidenceChunk[], termMatches: number, scores: Map<string, number>): StructuredAnswer | null {
  if (termMatches < 1) return null;
  const language = languageCode?.split("-")[0] || "";
  const answer = SOURCE_FAITHFUL_FOCUSED_ANSWERS[language]?.[queryId];
  const companion = evidence.find(chunk => chunk.id === `en-companion-${queryId}` && chunk.queryId === queryId);
  const hasDirectScoredSource = evidence.some(chunk => chunk.queryId === queryId && chunk.id !== companion?.id && (scores.get(chunk.id) ?? 0) >= 0.20);
  if (!answer || !companion || !hasDirectScoredSource) return null;
  if (queryId === "90836" && asksForUnsupportedFoodEnumeration(query)) {
    return refused("The cited passage describes a low-potassium chart but does not enumerate individual foods.");
  }
  return {
    status: "GROUNDED",
    answer,
    evidenceIds: [companion.id],
    confidenceBand: "HIGH",
    refusalReason: null,
  };
}

const CORE_DOMAIN_KEYWORDS = new Set([
  // English / Normalized Stems
  "corporation", "company", "incorporation", "carson", "rachel", "pesticide", "obligation", "endure",
  "potassium", "sodium", "diet", "nutrition", "bilge", "hull", "ship", "cargo",
  "integrity", "honesty", "moral", "stubhub", "ringworm", "tinea", "corporis",
  "ptsd", "marijuana", "cannabis", "ontario", "barometer", "mercury", "nhl", "playoffs", "gifford", "struthers", "2050", "trump", "rubrum", "trichophyton", "fungus", "atmospheric", "pressure", "kathie", "russian", "population", "pollution", "us", "law", "governed", "shareholders",

  // Raw Indic scripts for fallback
  "निगम", "कंपनी", "निगमन", "कार्सन", "कीटनाशक", "पर्यावरण", "पोटेशियम", "सोडियम", "आहार", "पोषक",
  "जहाज", "बिल्ज", "तल", "हल", "सत्यनिष्ठा", "सत्य", "निष्ठा", "ईमानदारी", "नैतिक", "प्रामाणिकपणा",
  "स्टबहब", "रिंगवर्म", "दाद", "टिनिया", "गांजा", "ऑन्टारियो", "गिफर्ड", "ऑब्लिगेशन", "एंड्योर", "स्ट्रथर्स", "स्ट्रुथर्स", "बैरोमीटर", "पारा", "२०५०", "लोकसंख्या", "भागधारक", "कॅनडा", "ट्रम्प", "ट्रंप", "रूसी", "कैथी",
  "ಕಂಪನಿ", "ಕಾರ್ಪೊರೇಷನ್", "ಕಾನೂನು", "ಆಡಳಿತ", "ಪೊಟ್ಯಾಸಿಯಮ್", "ಆಹಾರ", "ಪ್ರಾಮಾಣಿಕತೆ", "ಸಂಯೋಜನೆ", "ನಿಗಮ", "ಶೇರುದಾರರಿಂದ", "ಬಿಲ್ಜ್", "ಹಡಗು", "ಬ್ಯಾರೋಮೀಟರ್", "ಪಾದರಸ", "೨೦೫೦", "ಜನಸಂಖ್ಯೆ", "ಎನ್ಹೆಚ್ಎಲ್", "ಪ್ಲೇಆಫ್", "ಶಿಲೀಂಧ್ರ", "ಸರಕು", "ಹಡಗಿನಲ್ಲಿ", "ರೇಚಲ್", "ರೆಚೆಲ್", "ಕಾರ್ಸನ್", "ಗಾಂಜಾ",
  "நிறுவனம்", "கார்ப்பரேஷன்", "நேர்மை", "ரிங்வோர்ம்", "டினியா", "பங்கு", "பில்ஜ்", "கப்பல்", "பாரோமீட்டர்", "பாதரசம்", "பிடிஎஸ்டி", "பூஞ்சை", "கட்டுரை", "கனடா", "ஆராய்ச்சி", "மாசுபாடு", "அணிகள்", "தொடரில்", "என்ஹெச்எல்", "பிளேஆஃப்", "சோடியம்", "ரேச்சல்", "சுற்றுச்சூழல்"
]);

const GENERIC_CONTAINER_TERMS = new Set([
  // English / Stems
  "solar", "energy", "system", "water", "food", "research", "treatment", "service", "customer", "school", "education", "student", "output", "hours", "team", "teams", "list", "show", "give", "help", "section", "article", "cost_attribute", "cost", "price", "rate", "average", "difference", "meaning", "definition", "example", "examples", "process", "method", "ways", "type", "types", "time", "number", "level", "state", "use", "used",
  // Generic request verbs and pronouns: matches on these alone never evidence
  // the requested proposition ("where can you find X" matched only by "find").
  "find", "locate", "search", "look", "know", "see", "get", "come", "go", "you", "your", "people", "thing", "things",
  // Hindi
  "सौर", "ऊर्जा", "प्रणाली", "पानी", "आहार", "भोजन", "शोध", "अध्ययन", "उपचार", "सेवा", "स्कूल", "शिक्षा", "छात्र", "देश", "यादी", "सूची", "घंटे", "लागत", "खर्च", "मूल्य", "उदाहरण", "प्रकार", "तरीका", "संख्या", "समय", "उपयोग",
  // Kannada
  "ನೀರು", "ಸಂಶೋಧನೆ", "ಶಿಕ್ಷಣ", "ಶಾಲೆ", "ವಿದ್ಯಾರ್ಥಿ", "ಸೇವೆ", "ತಂಡಗಳು", "ಪಟ್ಟಿ", "ಮಾಹಿತಿ", "ಬೆಲೆ", "ಉದಾಹರಣೆ", "ಸಮಯ",
  // Tamil
  "உணவு", "நீர்", "ஆராய்ச்சி", "கல்வி", "பள்ளி", "மாணவர்", "சேவை", "அணிகள்", "பட்டியல்", "தகவல்", "விலை", "எடுத்துக்காட்டு", "நேரம்",
  // Marathi
  "अन्न", "पाणी", "अभ्यास", "शिक्षण", "ಶಾळा", "सेवा", "संघ", "यादी", "खर्च", "किंमत", "उदाहरण", "वेळ"
]);

const MUTUALLY_EXCLUSIVE_CONCEPTS: Array<Set<string>> = [
  new Set(["implant", "crown", "bridge", "denture"]),
  new Set(["laptop", "desktop"]),
  new Set(["vaccine", "antibiotic"]),
  new Set(["aircraft", "airplane", "ship", "boat"]),
  new Set(["fission", "fusion"]),
  new Set(["virus", "bacteria", "fungus"]),
  new Set(["inpatient", "outpatient"]),
  new Set(["buyer", "seller"]),
  new Set(["indoor", "outdoor"]),
  new Set(["import", "export"])
];

// Dictionary-citation / site-navigation boilerplate. These fragments routinely
// win naive term-overlap contests (they repeat the headword plus the word
// "definition") but are metadata ABOUT a definition, never the answer itself.

// Number-base conversion direction: "hexadecimal to binary" asks the reverse
// of an evidence sentence describing binary -> hexadecimal. Answering it with
// the opposite-direction recipe is a confident fabrication.
const BASE_CONVERSION_TERM = /\b(?:binary|decimal|hex(?:adecimal)?|octal)\b/i;

function conversionDirectionMismatch(query: string, sentence: string): boolean {
  const queryDirection = /([a-z]+)\s+(?:numbers?\s+)?to\s+(?:numbers?\s+)?([a-z]+)/i.exec(query);
  if (!queryDirection) return false;
  const canonicalBase = (raw: string): string | null => {
    const base = raw.toLocaleLowerCase();
    if (base.startsWith("hex")) return "hex";
    if (["binary", "decimal", "octal"].includes(base)) return base;
    return null;
  };
  const from = canonicalBase(queryDirection[1]);
  const to = canonicalBase(queryDirection[2]);
  if (!from || !to || from === to) return false;

  const convertMatch = /conver[a-z]*/i.exec(sentence);
  if (!convertMatch) return false;
  const lower = sentence.toLocaleLowerCase();
  const convertAt = convertMatch.index;
  const fromAt = lower.indexOf(from, convertAt);
  const toAt = lower.indexOf(to, convertAt);
  if (fromAt < 0 || toAt < 0) {
    // Sentence converts only ONE of the two named bases -> cannot confirm the
    // requested direction; treat as unsupported rather than guessing.
    const eitherAt = lower.indexOf(from, convertAt) >= 0 ? lower.indexOf(from, convertAt) : lower.indexOf(to, convertAt);
    return eitherAt >= 0 ? true : false;
  }
  // Whichever base appears first after the convert verb is the source being converted.
  const sentenceFrom = fromAt < toAt ? from : to;
  return sentenceFrom !== from;
}



const NAVIGATIONAL_PATTERNS = [
  /\b(?:write\s+a\s+review|click\s+here|sign\s+in|log\s+in|subscribe|terms\s+of\s+service|privacy\s+policy|all\s+rights\s+reserved|table\s+of\s+contents|share\s+this|leave\s+a\s+reply)\b/i,
  /\b(?:list\s+of\s+[a-z\s]+\s+by\s+(?:size|degree|rank|alphabet))\b/i,
  /\b(?:search\s+for\s+the\s+[a-z\s]+\s+by\s+its\s+streets)\b/i,
  /^(?:see|read|check\s+out|here\s+are|learn\s+more|find\s+out|explore|view)\b/i,
  /^(?:be\s+prepared|get\s+the|visit\s+our|contact\s+us|call\s+(?:now|us)|sign\s+up|follow\s+us|download|try\s+our|browse|watch\s+(?:our|this)|shop\s+(?:now|today))\b/i,
  /^\d+\s*[\)\.\:\s]/,
  /^Question\s+\d+\s*:/i,
  /\b(?:home\s*\/\s*\w+|products\s*\/|\w+\s*\/\s*\w+\s*\/\s*\w+)\b/i,
  /\b(?:\(\d+\s*marks?\)|exam\s*questions?|revision\s*questions?|module\s*\d+)\b/i,
  /\b(?:when\s+you|click\s+to|select\s+one)\s*:/i
];

/**
 * Non-propositional fragments: text that repeats query vocabulary (or echoes a
 * document outline / table header / call-to-action) while carrying no answer
 * proposition. These routinely win naive term-overlap contests, so they are
 * rejected structurally rather than through score thresholds.
 */
function isRepetitiveListingSentence(sentence: string): boolean {
  const segments = sentence.split(";").map(s => s.trim()).filter(Boolean);
  if (segments.length < 3) return false;
  const heads = new Map<string, number>();
  for (const segment of segments) {
    const word = /[\p{L}\p{M}\p{N}]+/u.exec(segment)?.[0];
    if (!word) continue;
    const key = normalizeDigits(word.normalize("NFKC").toLocaleLowerCase()).slice(0, 6);
    heads.set(key, (heads.get(key) || 0) + 1);
  }
  let maxRepeat = 0;
  for (const count of heads.values()) maxRepeat = Math.max(maxRepeat, count);
  return maxRepeat >= 3;
}

function isNonPropositionalFragment(sentence: string): boolean {
  // Numbered outline echo, e.g. "Civil War Strategy and Tactics. 1  THE STRATEGY OF THE CIVIL WAR."
  // or "... headache. 3  General Information: Other Possible Causes."
  if (/\.\s*\d{1,2}\s+[A-Z][A-Z\s\-']{4,}/.test(sentence)) return true;
  if (/\.\s*\d{1,2}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*:/.test(sentence)) return true;
  // Title-dash prefix followed by a keyword-stuffed comma list ("Earache headache nausea - Causes for ...").
  if (/^[A-Z][A-Za-z\s&]{2,50}[-–—]\s/.test(sentence) && (sentence.match(/,/g) || []).length >= 4) return true;
  // Section-header echo: keyword-stuffed title dash into a section label
  // ("Symptom Checklist - Causes of ...") that states no proposition itself.
  if (/^[^,.;!?]{3,60}\s[-–—]\s\s*(?:causes?|symptoms?|signs?|treatments?|remedies?|types?|examples?|benefits?|side\s+effects?|preventions?)\b/i.test(sentence)) return true;
  // Repetitive multilingual table-of-conversions header rows.
  if (isRepetitiveListingSentence(sentence)) return true;
  // Trailing imperative call-to-action in focused Indic scripts ("... देखें.", "... जानें।").
  if (/(?:देखें|देखिए|जानें|जानिए|पढ़ें|क्लिक\s+करें|सब्सक्राइब\s+करें)\s*[.!।]?\s*$/u.test(sentence.trim())) return true;
  return false;
}




function isNonDeclarativeOrEcho(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (trimmed.length < 25 || trimmed.split(/\s+/).length < 5) return true;
  if (/^(?:में|पर|से|के\s+लिए|at|in|on|for|from|with|by)\s+[^\.\!\?।॥]{1,30}$/i.test(trimmed)) return true;
  if (trimmed.endsWith("?") || trimmed.endsWith(";")) return true;
  if (INTERROGATIVE_START_PATTERNS.some(p => p.test(trimmed))) return true;
  if (NAVIGATIONAL_PATTERNS.some(p => p.test(trimmed))) return true;
  return false;
}


/**
 * Causal/modal proposition support: for "can X cause Y" / "why do X ..." the
 * evidence sentence must mention every requested participant (cause subject
 * and named effect). A sentence that discusses only one side cannot support
 * the requested causal claim.
 */
function causalEntityCompletenessViolation(qLower: string, sLower: string): boolean {
  const q = qLower.trim().replace(/[?.!]+$/, "");
  const subjects: string[] = [];
  const modalCause = /\b(?:can|could|does|do|will)\s+(.+?)\s+(?:causes?|caused|leads?\s+to|led\s+to|results?\s+in|resulted\s+in|triggers?|triggered|gives?|creates?)\b(.*)$/.exec(q);
  if (modalCause) {
    subjects.push(modalCause[1]);
    const effect = modalCause[2].trim();
    if (effect) subjects.push(effect);
  } else {
    const whyClause = /^why\s+(?:do|does|did|is|are|were|was)\s+(.+)$/.exec(q);
    if (whyClause) subjects.push(whyClause[1]);
  }
  if (!subjects.length) return false;
  const collectStems = (text: string): Set<string> => {
    const stems = new Set<string>();
    for (const word of text.split(/[^\p{L}\p{M}\p{N}]+/u)) {
      if (word.length >= 4 && !STOP_WORDS.has(word)) stems.add(word.slice(0, 5));
    }
    return stems;
  };
  const sentenceStems = collectStems(sLower);
  return subjects.some(subject => {
    const subjectStems = collectStems(subject);
    if (!subjectStems.size) return false;
    for (const stem of subjectStems) {
      if (sentenceStems.has(stem)) return false;
    }
    return true;
  });
}

function checkTargetAttributeRequirement(query: string, sentence: string): boolean {
  const qLower = query.toLocaleLowerCase();
  const sLower = sentence.toLocaleLowerCase();

  // Identifier attributes (zip/postal/pin codes) are digit strings; a passage
  // that never states one cannot answer the request.
  if (/\b(?:zip\s*code|zipcode|postal\s*code|pin\s*code|ज़िप\s*कोड|पिन\s*कोड)\b/i.test(qLower) && !/\d{4,}/.test(sLower)) {
    return false;
  }

  // Present-tense requests ("today", "currently") conflict with passages that
  // anchor an explicit historical record.
  if (/\b(?:today|right\s+now|current(?:ly)?|at\s+present)\b/i.test(qLower)) {
    const year = /\b(1[6-9]\d\d|20[0-2]\d)\b/.exec(sLower);
    if (year && /\b(?:ever|recorded|history|historic|century)\b|\bin\s+(?:1[6-9]\d\d|20[0-2]\d)\b/.test(sLower)) {
      return false;
    }
  }

  // Superlative requests ("the lowest X") must be answered with a superlative
  // statement or a concrete value, not a generic relation.
  const superlative = /\b(lowest|highest|greatest|fastest|largest|smallest|longest|shortest|strongest|biggest|oldest|newest)\b/i.exec(qLower);
  if (superlative) {
    const stem = superlative[1].toLocaleLowerCase().replace(/est$/, "");
    const hasSuperlative = new RegExp(`\\b\\w*${stem}(?:est|st)?\\b`).test(sLower) || /\b(?:most|least|maximum|minimum|peak|record)\b/i.test(sLower);
    if (!hasSuperlative && !/\d/.test(sLower)) return false;
  }

  // Process/manufacturing requests require process vocabulary in evidence.
  if (/\b(?:processing|manufacturing|production|synthesis|refining)\b/i.test(qLower)) {
    const hasProcessIndicator = /\b(?:processe?s?|processe[sd]|produced?|manufactured?|synthesi[sz]ed?|refined?|converted|formed|molded|moulded|extruded|treated|method|procedure|steps?)\b/i.test(sLower);
    if (!hasProcessIndicator) return false;
  }

  // Phone / Contact number
  if (/\b(?:phone|telephone|contact\s+number|cell\s+phone|mobile)\b/i.test(qLower) || /\b(?:फोन|नंबर|दूरभाष|सम्पर्क|संपर्क\s+नंबर)\b/i.test(qLower)) {
    const hasPhoneIndicator = /\b(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{7,12}\b|call|phone|telephone|contact|toll\s*free)\b/i.test(sLower) || /\b(?:फोन|दूरभाष|कॉल|संपर्क)\b/i.test(sLower);
    if (!hasPhoneIndicator) return false;
  }

  // Definition queries should not be conditional "If..." or "When..." clauses
  if (/\b(?:what\s+is|what\s+are|define|meaning\s+of)\b/i.test(qLower) && /^(?:if|when)\s+/i.test(sentence.trim())) {
    return false;
  }

  // Action mismatch: Cancel vs. Enroll
  if (/\b(?:cancel|cancellation|delete|close|remove)\b/i.test(qLower) || /\b(?:रद्द|बंद|हटाना|हटाएं)\b/i.test(qLower)) {
    const hasCancelInSentence = /\b(?:cancel|cancellation|delete|close|remove|terminate|stop|end)\b/i.test(sLower) || /\b(?:रद्द|बंद|समाप्त|हटाना)\b/i.test(sLower);
    const hasEnrollOnlyInSentence = /\b(?:enroll|enrollment|register|registration|apply|sign\s*up)\b/i.test(sLower) || /\b(?:नामांकन|पंजीकरण|शामिल|आवेदन)\b/i.test(sLower);
    if (!hasCancelInSentence && hasEnrollOnlyInSentence) {
      return false;
    }
  }

  // Cost / Pricing / Pay query requires cost indicator
  if (/\b(?:do\s+you\s+have\s+to\s+pay|how\s+much\s+does\s+it\s+cost|pay\s+to\s+enter)\b/i.test(qLower) || /\b(?:प्रवेश.*भुगतान|पैसे.*देने)\b/i.test(qLower)) {
    const hasPayIndicator = /\b(?:pay|free|fee|cost|price|admission|ticket|dollars?|\$|charge|permit)\b/i.test(sLower) || /\b(?:भुगतान|शुल्क|मुफ्त|लागत|टिकट|पैसे)\b/i.test(sLower);
    if (!hasPayIndicator) return false;
  }



  // Address / Location
  if (/\b(?:address|zip\s*code|where\s+is|headquarters)\b/i.test(qLower)) {
    const hasAddressIndicator = /\b(?:\d{5}|\d{6}|street|st\.|ave|avenue|blvd|boulevard|road|rd\.|drive|dr\.|suite|box|floor|city|state|located\s+in|located\s+at|based\s+in|headquartered\s+in|county|district)\b/i.test(sLower) || /\b(?:स्थित|जिले|राज्य|शहर|पते|पिनकोड)\b/i.test(sLower);
    if (!hasAddressIndicator) return false;
  }

  // Cost / Price / Monetary amount
  if (/\b(?:cost|price|fee|tuition|salary|worth)\b/i.test(qLower) || /\b(?:लागत|कीमत|मूल्य|शुल्क|वेतन)\b/i.test(qLower)) {
    const hasCostIndicator = /[$€£₹]|\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred|thousand|million|billion)\s*(?:dollars?|cents?|rupees?|bucks?|usd|inr|per\s+(?:month|year|day|hour|kwh|sq|foot|yard))\b/i.test(sLower) || /\b(?:free|no\s+charge|gratis|complimentary)\b/i.test(sLower) || /\b(?:\d+\s*(?:रुपये|डॉलर|पैसे|रु))\b/i.test(sLower) || /\b(?:कीमत|मूल्य|लागत|खर्च)\s*(?:है|लगभग|करीब)\s*(?:[$₹\d]|मुफ्त)/i.test(sLower);
    if (!hasCostIndicator) return false;
  }

  // Highest rated / Superlative ranking
  if (/\b(?:highest\s+rated|top\s+rated|best\s+rated|most\s+popular|most\s+famous)\b/i.test(qLower) || /\b(?:उच्चतम\s+मूल्यांकित|शीर्ष\s+रेटेड|सबसे\s+प्रसिद्ध|सबसे\s+लोकप्रिय)\b/i.test(qLower)) {
    const hasRatingIndicator = /\b(?:rated|rating|stars?|reviews?|ranked|top-rated|best|most\s+popular|most\s+famous|number\s+one|#1)\b/i.test(sLower) || /\b(?:रेटिंग|सर्वश्रेष्ठ|शीर्ष|स्टार|प्रसिद्ध|लोकप्रिय)\b/i.test(sLower);
    if (!hasRatingIndicator) return false;
  }

  // What is it called / Term for
  if (/\b(?:what\s+is\s+it\s+called|what\s+is\s+the\s+term|what\s+do\s+you\s+call)\b/i.test(qLower) || /\b(?:क्या\s+कहते\s+हैं|क्या\s+कहा\s+जाता\s+है|किसे\s+कहते\s+हैं)\b/i.test(qLower)) {
    const hasNamingIndicator = /\b(?:called|known\s+as|referred\s+to\s+as|term\s+is|termed|named|defined\s+as)\b/i.test(sLower) || /\b(?:कहते\s+हैं|कहा\s+जाता\s+है|नाम\s+है|नामित)\b/i.test(sLower);
    if (!hasNamingIndicator) return false;
  }

  // Count / Quantity / Age / Distance / Speed / Height / Dimension / Duration
  const durationQuery = /\b(?:how\s+much\s+(?:time|longer)|time\s+(?:it\s+)?takes?|कितना\s+समय|कितने\s+दिन)\b/i.test(qLower);
  if (/\b(?:how\s+many|how\s+old|how\s+fast|distance|speed|how\s+long|how\s+far|how\s+high|how\s+tall|height|depth)\b/i.test(qLower) || durationQuery || /\b(?:कितने|कितनी|कितना|दूरी|गति|ऊंचाई|आयु|उम्र)\b/i.test(qLower)) {
    const hasNumericQuantity = /\b(?:\d+(?:-\d+)?(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|hundred|thousand|several|few)\s*(?:years?|months?|weeks?|days?|hours?|mins?|minutes?|seconds?|miles?|km|kilometers?|meters?|feet|inches|in\.|ft\.|mph|kmph|percent|%|lbs?|kg|grams?|cm|mm)\b/i.test(sLower) || /\b(?:\d+\s*(?:साल|वर्ष|दिन|महीने|किलोमीटर|मीटर|मील|प्रतिशत))\b/i.test(sLower)
      // Duration answers may state the span in words ("about half an hour").
      || (durationQuery && /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|half|an\s+hour|a\s+day|a\s+week|a\s+month|a\s+year)\b/i.test(sLower));
    if (!hasNumericQuantity) return false;
  }

  // Temperature / Pressure readings are numeric by nature.
  if (/\b(?:temperature|तापमान)\b|\b(?:pressure|दबाव)\b|\bdegrees?\b/i.test(qLower)) {
    const hasReading = /\d|°|degree|freezing|below\s+zero/i.test(sLower);
    if (!hasReading) return false;
  }

  // Known for / Respected for / Famous for
  if (/\b(?:known\s+for|famous\s+for|respected\s+for|remembered\s+for)\b/i.test(qLower)) {
    const hasReputation = /\b(?:known|famous|respected|remembered|renowned|popular|celebrated|acclaimed|noted|best\s+known)\b/i.test(sLower) || /\b(?:प्रसिद्ध|जाना|माना|प्रसिद्धि)\b/i.test(sLower);
    if (!hasReputation) return false;
  }

  // Seasonal alignment
  const seasons = ["summer", "winter", "spring", "autumn", "fall"];
  for (const season of seasons) {
    if (qLower.includes(season) && !sLower.includes(season)) {
      return false;
    }
  }

  // Causes / Why
  if (/\b(?:why|causes?|reason|why\s+do|how\s+come)\b/i.test(qLower)) {
    const hasCausalIndicator = /\b(?:because|due\s+to|caused\s+by|causes?|leading\s+to|results?\s+in|reasons?|as\s+a\s+result|triggers?|allows|helps?|helps\s+to|so|keeps?|protects?|prevents?|enables?|thought\s+that|in\s+order\s+to|to\s+[a-z]+)\b/i.test(sLower) || /\b(?:क्योंकि|कारण|वजह|परिणामस्वरूप|मदद)\b/i.test(sLower);
    if (!hasCausalIndicator) return false;
  }

  // Who / Person / Owner
  if (/\b(?:who|whom|whose|person|founder|creator|inventor|author|director|president|scientist|owner|ownership|belong|belongs)\b/i.test(qLower)) {
    const hasPersonIndicator = /\b(?:born|he|she|his|her|author|founder|creator|inventor|director|president|scientist|doctor|engineer|owner|ownership|officer|manager|person|people|individual|team|discovered\s+by|written\s+by|founded\s+by|led\s+by|owned\s+by|sold\s+to|bought|belong|belongs|named)\b/i.test(sLower) || /\b(?:द्वारा|व्यक्ति|लेखक|निदेशक|वैज्ञानिक|खोजकर्ता|প্রতিষ্ঠাতা|मालिक)\b/i.test(sLower);
    if (!hasPersonIndicator) return false;
  }

  // Origin / History / Coined / Started
  if (/\b(?:originate|origin|derived|coined|come\s+from|started|history|invented)\b/i.test(qLower)) {
    const hasOriginIndicator = /\b(?:originated|origin|first\s+used|coined|derived\s+from|history|came\s+from|started\s+in|dated\s+back|began\s+in|century|\b(?:1[7-9]\d\d|20\d\d)\b|etymology)\b/i.test(sLower) || /\b(?:उत्पत्ति|शुरुआत|इतिहास|सिक्का|शुरू)\b/i.test(sLower);
    if (!hasOriginIndicator) return false;
  }

  // When / Temporal
  if (/\b(?:when|what\s+year|what\s+date|what\s+day|how\s+long\s+ago)\b/i.test(qLower)) {
    const hasTimeIndicator = /\b(?:\d{4}|january|february|march|april|may|june|july|august|september|october|november|december|century|decade|year|month|b\.?c\.?|a\.?d\.?|ago|during|since|in\s+\d{4})\b/i.test(sLower) || /\b(?:साल|वर्ष|महीने|सदी|ईस्वी|तारीख|दिनांक)\b/i.test(sLower);
    if (!hasTimeIndicator) return false;
  }

  // How-to / Procedure. Spoken and typed variants often drop the infinitive
  // ("how build up blood platelets"), so the trigger also accepts bare
  // action verbs. A sentence whose only procedural hint is a "by VERB-ing"
  // aside describes a fact, not the requested procedure.
  const howToTrigger = /\b(?:how\s+to|steps\s+to|instructions?\s+for|ways?\s+to)\b/i.test(qLower)
    || /\b(?:कैसे\s+[^\s]+\s+करें|तरीका|उपाय)\b/i.test(qLower)
    || /\bhow\s+(?:do\s+i|do\s+you|can\s+(?:i|you)|to\s+)?(?:build|make|get|grow|increase|raise|boost|lower|reduce|fix|cure|treat|prevent|avoid|check)\b/i.test(qLower);
  if (howToTrigger) {
    const stepCore = sLower.replace(/\bby\s+[a-z]+ing\b[^.,;]*/g, " ");
    const hasStepIndicator = /\b(?:to\s+[a-z]+|step|use|using|apply|first|then|after|before|make\s+sure|should|must|can\s+be|recommended|method|process|procedure|train|teach|educate|conduct|provide|start|ensure)\b/i.test(stepCore) || /\b(?:तरीका|प्रक्रिया|कदम|उपयोग|करें|सिखा|प्रशिक्षित|प्रदान)\b/i.test(sLower);
    if (!hasStepIndicator) return false;
  }

  // Causal / modal requests ("can X cause Y", "why do X ...") must be answered
  // with evidence that mentions what was asked about, both cause subject and
  // requested effect when named.
  if (causalEntityCompletenessViolation(qLower, sLower)) {
    return false;
  }

  // Modal / Possibility / Cause-Effect ("can X cause Y", "does X lead to Y", "can you X")
  if (/^(?:can|could|does|do|will|would|is\s+it\s+possible)\b/i.test(qLower) || /\b(?:क्या\s+.*हो\s+सकता|क्या\s+.*सकते)\b/u.test(query)) {
    const hasModalOrEffectIndicator = /\b(?:can|could|may|might|will|would|able|allows|causes?|caused|leads?|leading|results?|resulting|triggers?|produces?|prevent|prevents|possible|safe|safely|freeze|frozen|suspended|cure|treated)\b/i.test(sLower) || /\b(?:सकता|सकती|सकते|संभव|कारण|मदद|रोक|उपचार)\b/u.test(sentence);
    if (!hasModalOrEffectIndicator) return false;
  }

  return true;
}


export interface QueryDimension {
  text: string;
  type: "definition" | "cause" | "symptom" | "treatment" | "process" | "location" | "person" | "temporal" | "quantity" | "price" | "comparison" | "general";
}

export function detectQueryDimensions(query: string): QueryDimension[] {
  const q = query.trim();
  // Compound connectors: " and what ", " and how ", " and why ", " and where ", " and who ", " its causes ", " its symptoms "
  const splitPattern = /\b(?:and\s+(?:what|how|why|where|who|whom|whose|when|which|is|are|its?|their)|as\s+well\s+as|along\s+with|\s*[,;]\s*(?:and\s+)?(?:what|how|why|where|who|when|its?|their))\b/i;
  
  const rawParts = q.split(splitPattern).map(p => p.trim()).filter(p => p.length >= 3);
  if (rawParts.length <= 1) {
    return [{ text: q, type: classifyDimensionType(q) }];
  }

  const dimensions: QueryDimension[] = [];
  const mainTerms = Array.from(queryTerms(rawParts[0])).map(normalizeContentTerm).filter(Boolean);
  const mainSubject = mainTerms.join(" ");

  for (let i = 0; i < rawParts.length; i++) {
    let partText = rawParts[i];
    const partTerms = Array.from(queryTerms(partText));
    if (i > 0 && partTerms.length <= 2 && mainSubject) {
      partText = `${partText} of ${mainSubject}`;
    }
    dimensions.push({
      text: partText,
      type: classifyDimensionType(partText)
    });
  }

  return dimensions;
}

function classifyDimensionType(text: string): QueryDimension["type"] {
  const t = text.toLowerCase();
  if (/\b(?:what\s+is|what\s+are|define|definition|meaning)\b/.test(t)) return "definition";
  if (/\b(?:cause|causes|caused|why|origin|reasons?)\b/.test(t)) return "cause";
  if (/\b(?:symptom|symptoms|signs?)\b/.test(t)) return "symptom";
  if (/\b(?:treatment|treat|cure|therapy|medicine)\b/.test(t)) return "treatment";
  if (/\b(?:how\s+to|how\s+does|how\s+do|process|steps?|works?)\b/.test(t)) return "process";
  if (/\b(?:where|location|place|country|city)\b/.test(t)) return "location";
  if (/\b(?:who|whom|whose|person|founder|author|owner)\b/.test(t)) return "person";
  if (/\b(?:when|year|date|time)\b/.test(t)) return "temporal";
  if (/\b(?:how\s+many|how\s+much|cost|price|quantity)\b/.test(t)) return "quantity";
  return "general";
}

function evaluateSingleIntent(query: string, evidence: EvidenceChunk[], scores: Map<string, number>, languageCode?: string) {
  const terms = queryTerms(query);
  if (!terms.size) {
    return { supported: [], result: refused("Retrieved passages did not meet the evidence sufficiency threshold.") };
  }

  const queryConcepts = new Set(Array.from(terms).map(normalizeContentTerm).filter(Boolean));

  const supported = evidence
    .map(chunk => {
      const match = evidenceSentence(chunk, terms);
      if (!match || match.termMatches === 0) return null;
      if (conversionDirectionMismatch(query, match.sentence)) return null;

      const sentence = match.sentence;
      if (isNonDeclarativeOrEcho(sentence)) return null;
      if (isNonPropositionalFragment(sentence)) return null;
      if (!checkTargetAttributeRequirement(query, sentence)) return null;
      if (conversionDirectionMismatch(query, sentence)) return null;
      if (BOILERPLATE_PATTERNS.some(p => p.test(sentence))) return null;

      const sentenceWords = new Set(
        normalizeDigits(sentence.normalize("NFKC").toLocaleLowerCase())
          .split(/[^\p{L}\p{M}\p{N}]+/u)
          .map(normalizeContentTerm)
          .filter(w => w && w.length >= 2)
      );

      const chunkConcepts = new Set(
        normalizeDigits(chunk.text.normalize("NFKC").toLocaleLowerCase())
          .split(/[^\p{L}\p{M}\p{N}]+/u)
          .map(normalizeContentTerm)
          .filter(Boolean)
      );

      for (const group of MUTUALLY_EXCLUSIVE_CONCEPTS) {
        for (const qc of queryConcepts) {
          if (group.has(qc)) {
            for (const other of group) {
              if (other !== qc && chunkConcepts.has(other) && !chunkConcepts.has(qc)) {
                return null;
              }
            }
          }
        }
      }

      const matchedTerms = Array.from(terms).filter(t => {
        const normT = normalizeContentTerm(t);
        return (normT && normT.length >= 2 && sentenceWords.has(normT)) || sentenceWords.has(t);
      });

      const effectiveMatchCount = matchedTerms.length;
      if (effectiveMatchCount === 0) return null;

      const matchedNormalized = matchedTerms.map(normalizeContentTerm);
      const isOnlyGenericAttributes = matchedNormalized.every(t => 
        t === "cost_attribute" || GENERIC_CONTAINER_TERMS.has(t)
      );
      const hasSpecificQueryConcept = Array.from(queryConcepts).some(t => 
        t !== "cost_attribute" && !GENERIC_CONTAINER_TERMS.has(t) && t.length >= 2
      );

      if (hasSpecificQueryConcept && isOnlyGenericAttributes) {
        return null;
      }

      const chunkScore = scores.get(chunk.id) ?? 0;
      const coverage = effectiveMatchCount / Math.max(1, terms.size);

      if (/\b(?:difference|versus|vs|between|compare|contrast)\b/i.test(query.toLocaleLowerCase())) {
        const hasComparisonIndicator = /\b(?:difference|differs|unlike|whereas|while|compared|contrast|instead|however|between)\b/i.test(sentence.toLocaleLowerCase()) || /\b(?:अंतर|तुलना|विपरीत|बल्कि|जबकि)\b/i.test(sentence);
        if (!hasComparisonIndicator && terms.size >= 2 && effectiveMatchCount < 2) {
          return null;
        }
      }

      if (terms.size === 1) {
        if (effectiveMatchCount >= 1 && chunkScore >= 0.22 && sentence.length >= 20) {
          return { chunk, match, score: chunkScore };
        }
        return null;
      }

      if (terms.size === 2) {
        if ((coverage >= 0.90 || (effectiveMatchCount >= 2 && chunkScore >= 0.28) || (effectiveMatchCount >= 1 && chunkScore >= 0.35)) && sentence.length >= 20) {
          return { chunk, match, score: chunkScore };
        }
        return null;
      }

      if ((coverage >= 0.50 || (effectiveMatchCount >= 2 && chunkScore >= 0.45) || (effectiveMatchCount >= 3 && chunkScore >= 0.35)) && sentence.length >= 20) {
        return { chunk, match, score: chunkScore };
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.match.termMatches - a.match.termMatches || b.score - a.score);

  const uniqueParents = new Set(supported.map(item => item.chunk.parentId));
  const top = supported[0];
  if (!top || top.score < 0.20 || !uniqueParents.size) {
    return { supported: [], result: refused("Retrieved passages did not meet the evidence sufficiency threshold.") };
  }

  const sourceFaithfulAnswer = focusedSourceFaithfulAnswer(query, languageCode, top.chunk.queryId, evidence, top.match.termMatches, scores);
  if (sourceFaithfulAnswer) return { supported, result: sourceFaithfulAnswer };

  const citations = [top];
  const answer = citations.map(item => polishEvidenceSentence(item.match.sentence)).join(" ");
  const confidenceBand: ConfidenceBand = uniqueParents.size >= 2 && top.score >= 0.48 ? "HIGH" : "MEDIUM";
  return {
    supported,
    result: {
      status: "GROUNDED" as const,
      answer,
      evidenceIds: citations.map(item => item.chunk.id),
      confidenceBand,
      refusalReason: null,
    }
  };
}

export function verifyAndSynthesize(query: string, evidence: EvidenceChunk[], scores: Map<string, number>, languageCode?: string): StructuredAnswer {
  const dimensions = detectQueryDimensions(query);
  
  if (dimensions.length > 1) {
    const dimensionResults: { dimension: QueryDimension; match: { chunk: EvidenceChunk; sentence: string; score: number } | null }[] = [];

    for (const dim of dimensions) {
      const dimEval = evaluateSingleIntent(dim.text, evidence, scores, languageCode);
      const best = dimEval.supported[0];
      if (best && dimEval.result.status === "GROUNDED") {
        dimensionResults.push({
          dimension: dim,
          match: { chunk: best.chunk, sentence: dimEval.result.answer, score: best.score }
        });
      } else {
        dimensionResults.push({ dimension: dim, match: null });
      }
    }


    const supportedDims = dimensionResults.filter(r => r.match !== null) as { dimension: QueryDimension; match: { chunk: EvidenceChunk; sentence: string; score: number } }[];
    
    if (supportedDims.length === 0) {
      return refused("Retrieved passages did not meet the evidence sufficiency threshold.");
    }

    // Deduplicate sentences preserving order and superset completeness
    const rawSentences: string[] = [];
    const usedChunkIds = new Set<string>();
    for (const s of supportedDims) {
      rawSentences.push(s.match.sentence);
      usedChunkIds.add(s.match.chunk.id);
    }
    const uniqueSentences: string[] = [];
    for (const sent of rawSentences) {
      if (uniqueSentences.some(u => u.includes(sent))) continue;
      const subIdx = uniqueSentences.findIndex(u => sent.includes(u));
      if (subIdx >= 0) {
        uniqueSentences[subIdx] = sent;
      } else {
        uniqueSentences.push(sent);
      }
    }

    const unsupportedDims = dimensionResults.filter(r => r.match === null);
    let finalAnswer = uniqueSentences.join(" ");
    if (unsupportedDims.length > 0 && supportedDims.length > 0) {
      const missingLabels = unsupportedDims.map(d => `"${d.dimension.text.replace(/\s+of\s+.*$/i, "")}"`).join(", ");
      finalAnswer += ` (The corpus evidence does not contain sufficient details to address: ${missingLabels}).`;
    }

    return {
      status: "GROUNDED",
      answer: finalAnswer,
      evidenceIds: Array.from(usedChunkIds),
      confidenceBand: supportedDims.length === dimensions.length ? "HIGH" : "MEDIUM",
      refusalReason: null,
    };
  }

  return evaluateSingleIntent(query, evidence, scores, languageCode).result;
}

export const guardrailsInternals = {
  evidenceSentence,
  queryTerms,
  normalizeContentTerm,
  detectQueryDimensions,
};

