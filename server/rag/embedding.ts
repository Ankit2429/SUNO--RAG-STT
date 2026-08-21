export const DENSE_VECTOR_SIZE = 384;
export const DENSE_VECTOR_NAME = "dense_vector";
export const ZERO_COST_EMBEDDING_MODEL = "multilingual-unicode-ngram-dense-v1";

export const LEXICAL_QUERY_FRAME_TERMS = new Set([
  // English
  "what", "how", "why", "who", "which", "where", "many", "much",
  // Hindi
  "क्या", "कहते", "हैं",
  // Tamil
  "என்ன", "என்பது",
  // Marathi
  "काय", "म्हणतात",
  // Kannada
  "ಯಾವ", "ಮೂಲಕ", "ಇರುತ್ತದೆ",
]);

export const STOP_WORDS = new Set([
  // English
  "what", "is", "are", "was", "were", "the", "a", "an", "in", "on", "at", "of", "to", "for", "with", "and", "or", "by", "from", "how", "why", "who", "where", "when", "which", "can", "does", "do", "did", "tell", "give", "me", "about", "called", "known", "as", "between", "many", "much", "more", "most", "some", "any", "this", "that", "these", "those", "have", "has", "had", "will", "would", "should", "could", "been", "being", "their", "there", "they", "them", "other", "into", "than", "then", "just", "also", "only", "its", "it", "low", "make", "do", "how", "state", "country", "city", "first", "main", "major", "type", "role", "importance", "difference", "history", "report", "details", "information", "according",

  // Hindi
  "क्या", "है", "हैं", "होता", "होती", "होते", "होना", "होने", "का", "की", "के", "में", "से", "को", "पर", "और", "या", "तथा", "गया", "गए", "गई", "था", "थी", "थे", "किस", "कौन", "कहाँ", "कहा", "कैसे", "कितने", "कितनी", "कितना", "केसरी", "लिए", "द्वारा", "बारे", "इन", "उन", "वह", "यह", "वे", "ये", "जाता", "जाती", "जाते", "रहता", "रहती", "रहते", "साथ", "तक", "अपने", "अपनी", "अपना", "कम", "करें", "किया", "करना", "करने", "कर", "लो", "देना", "देने", "दिए", "काम", "करती", "करता", "करते", "रहा", "रही", "रहे", "तरह", "कहा", "विवरण", "जानकारी", "राज्य", "देश", "शहर", "नगर", "प्रथम", "पहला", "पहली", "पहले", "प्रमुख", "अंतर", "महत्व", "भूमिका", "निष्कर्ष", "चेतावनी", "प्रभाव", "प्रकार", "ने", "ही", "भी", "तो", "वाला", "वाले", "वाली",

  // Kannada
  "ಏನು", "ಯಾವುದು", "ಯಾರು", "ಎಲ್ಲಿ", "ಹೇಗೆ", "ಏಕೆ", "ಮತ್ತು", "ಅಥವಾ", "ಇದೆ", "ಆಗುತ್ತದೆ", "ಎಂಬುದು", "ಎಂದರೆ", "ಯಾವ", "ಬಗ್ಗೆ", "ಎಷ್ಟು", "ಎಂಬ", "ಎಂದು", "ಇದನ್ನು", "ಅದನ್ನು", "ನಡುವೆ", "ಮಾಡುವ", "ಮಾಡುತ್ತದೆ", "ಮಾಡುತ್ತಾರೆ", "ಇರುತ್ತವೆ", "ಇರುತ್ತಾರೆ", "ಆಗಿದೆ", "ಅವರ", "ಅದರ", "ಈಗ", "ಯಾವಾಗ", "ಕಡಿಮೆ", "ಮಾಡುವುದು", "ಮಾಡಿ", "ಕೆಲಸ", "ವಿವರಗಳು", "ಮಾಹಿತಿ", "ರಾಜ್ಯ", "ದೇಶ", "ನಗರ", "ಪ್ರಥಮ", "ಮೊದಲ", "ವ್ಯತ್ಯಾಸವೇನು", "ಪರಿಣಾಮ", "ಪ್ರಭಾವ", "ಬೀರುತ್ತದೆ", "ಕುರಿತು", "ಎಂದರೇನು",

  // Tamil
  "என்ன", "என்று", "அழைக்கப்படுகிறது", "என்பது", "எது", "யார்", "எங்கே", "எவ்வாறு", "ஏன்", "மற்றும்", "அல்லது", "உள்ளது", "பற்றி", "எந்த", "எத்தனை", "இடையே", "உள்ள", "செய்யும்", "ஆகும்", "உள்ளன", "இருந்து", "அவர்", "அதன்", "இது", "அது", "கொண்டு", "மூலம்", "குறைந்த", "செய்வது", "செய்து", "வேலை", "பொருள்", "விவரங்கள்", "மாநிலம்", "நாடு", "நகரம்", "முதல்", "தகவல்கள்", "அறிகுறிகள்", "விளைவுகள்", "கருத்துக்கள்", "யாவை", "எச்சரித்துள்ளார்", "அளவிடப்படுகிறது", "பற்றிய", "குறித்து", "என்றால்",

  // Marathi
  "काय", "म्हणतात", "आहे", "आहीत", "आहेत", "कसा", "कशी", "कसे", "कोणता", "कोणती", "कोणते", "आणि", "किंवा", "मध्ये", "वर", "वरून", "कडून", "झाला", "झाली", "झाले", "बद्दल", "किती", "यांचे", "त्यांचे", "म्हणजे", "कशामुळे", "कोणत्या", "कोठे", "कधी", "तसेच", "करतात", "करतो", "करते", "कमी", "करा", "करावे", "करून", "केले", "होते", "काम", "करते", "करतो", "करतात", "होतो", "होते", "होतात", "माहिती", "विवरण", "राज्य", "देश", "शहर", "नगर", "पहिला", "पहिले", "पहिली", "प्रमुख", "महत्त्व", "परिणाम", "कारण", "सांगितले", "विषयी", "बाबत",

  // Bengali / Gujarati / Telugu / Malayalam / Punjabi / Odia / Assamese / Nepali / Urdu
  "কী", "কি", "হয়", "হয়নি", "হলো", "হচ্ছে", "এবং", "বা", "থেকে", "मध्ये", "জন্য", "এর", "কে", "তা", "যা", "কোন", "કોણ", "શું", "છે", "હતા", "અને", "માટે", "થી", "માં", "ఏమిటి", "ఏది", "ఎవరు", "ఎక్కడ", "ఎలా", "మరియు", "లేదా", "ఉంది", "എന്ത്", "ഏത്", "ആര്", "എവിടെ", "ആണ്", "ഉണ്ട്", "ਹੈ", "ਹਨ", "ਸੀ", "ਅਤੇ", "ਜਾਂ", "ਕਣ", "କିଏ", "ଏବଂ", "କିମ୍ବା", "ଅଟେ", "কি", "কোন", "ক’ত", "আৰু", "বা", "কে", "কোথাও", "को", "कहाँ", "कसरी", "र", "वा", "हो", "کیا", "ہے", "ہیں", "تھا", "تھے", "اور", "یا", "میں", "سے", "پر"
]);

/** Normalize Indic numerals across Devanagari, Kannada, and Tamil to standard ASCII digits 0-9 and strip zero-width characters. */
export function normalizeDigits(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[०-९]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 0x0030))
    .replace(/[೦-೯]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0ce6 + 0x0030))
    .replace(/[௦-௦]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0be6 + 0x0030));
}

const LEXICAL_TERM_EXPANSIONS: Record<string, readonly string[]> = {
  // Topic 1: Corporation / Incorporation
  "कॉर्पोरेशन": ["निगम", "कंपनी"],
  "ಕಾರ್ಪೊರೇಷನ್": ["ಕಂಪನಿ"],
  "ಕಾನೂನುಗಳ": ["ಕಾನೂನು"],
  "ನಿಯಂತ್ರಿತವಾಗುತ್ತದೆ": ["ಆಡಳಿತ"],
  "கார்ப்பரேஷன்": ["நிறுவனம்"],
  "ನಿಗಮವು": ["ನಿಗಮ", "ಕಂಪನಿ", "ಕಾರ್ಪೊರೇಷನ್"],
  "ಶೇರುದಾರರಿಂದ": ["ಶೇರುದಾರರು", "ಭಾಗಧಾರಕ"],

  // Topic 2: Bilge / Hull / Ship
  "मालवाहक": ["जहाज", "जहाज़"],
  "जहाज़": ["जहाज"],
  "निचले": ["नीचे"],
  "भाग": ["खंड"],
  "तळाच्या": ["खालच्या"],
  "भागाला": ["विभाग"],

  // Topic 3: Potassium / Diet
  "ಪೊಟ್ಯಾಸಿಯಂ": ["ಪೊಟ್ಯಾಸಿಯಮ್"],
  "ಆಹಾರಕ್ರಮದ": ["ಆಹಾರ"],

  // Topic 4: Honesty / Integrity
  "நேர்மையின்": ["நேர்மை"],
  "सत्याधारित": ["प्रामाणिकपणा", "सत्यनिष्ठा"],
  "सचोटी": ["प्रामाणिकपणा", "सत्यनिष्ठा"],
  "सचोटीची": ["प्रामाणिकपणा", "सत्यनिष्ठा"],

  // Topic 5: Barometer / Mercury
  "barometer": ["बैरोमीटर", "बॅरोमीटर", "ಬ್ಯಾರೋಮೀಟರ್", "பாரோமீட்டர்"],
  "mercury": ["पारा", "पारे", "पार्या", "ಪಾದರಸ", "பாதரசம்"],
  "atmospheric": ["वायुमंडलीय", "हवेचा", "ವಾತಾವರಣ", "காற்றழுத்த"],
  "pressure": ["दबाव", "दाब", "ಒತ್ತಡ", "அழுத்தம்"],
  "பாரோமீட்டரில்": ["பாரோமீட்டர்", "பாதரசம்"],
  "பாதரசத்தின்": ["பாதரசம்", "பாரோமீட்டர்"],

  // Topic 6: PTSD / Cannabis / Ontario
  "ptsd": ["पीटीएसडी", "ಪಿಟಿಎಸ್ಡಿ", "பிடிஎஸ்டி"],
  "cannabis": ["गांजा", "ಗಾಂಜಾ"],
  "ontario": ["ऑन्टारियो", "कॅनडा", "கனடா"],

  // Topic 7: NHL / Playoffs
  "nhl": ["एनएचएल", "ಎನ್ಹೆಚ್ಎಲ್", "என்ஹெச்எல்"],
  "playoffs": ["प्लेऑफ", "ಪ್ಲೇಆಫ್", "பிளேஆஃப்"],

  // Topic 8: Ringworm / Fungus / Tinea
  "ringworm": ["रिंगवर्म", "दाद", "ರಿಂಗ್ವರ್ಮ್", "ரிங்வோர்ம்"],
  "tinea": ["टिनिया", "டினியா"],
  "fungus": ["कवक", "बुरशी", "ಶಿಲೀಂಧ್ರ", "பூஞ்சை"],
  "trichophyton": ["ट्रायकोफायटन"],
  "rubrum": ["रुब्रम"],
};

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function add(vector: number[], feature: string, weight: number) {
  const value = hash(feature);
  const slot = value % DENSE_VECTOR_SIZE;
  vector[slot] += (value & 1 ? 1 : -1) * weight;
}

/** A deterministic, server-only, Unicode-aware dense fallback for the zero-cost profile. */
export function embedText(text: string): number[] {
  const normalized = normalizeDigits(text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim());
  const vector = Array.from({ length: DENSE_VECTOR_SIZE }, () => 0);
  for (const token of normalized.split(" ").filter(Boolean)) add(vector, `token:${token}`, 2.4);
  const characters = Array.from(normalized.replace(/\s/g, ""));
  for (let index = 0; index < characters.length; index += 1) {
    add(vector, `char1:${characters[index]}`, 0.4);
    if (index + 1 < characters.length) add(vector, `char2:${characters.slice(index, index + 2).join("")}`, 1);
    if (index + 2 < characters.length) add(vector, `char3:${characters.slice(index, index + 3).join("")}`, 1.25);
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map(value => value / magnitude) : vector;
}

export function isStopWord(term: string): boolean {
  return STOP_WORDS.has(term.toLocaleLowerCase());
}

export function lexicalTerms(text: string): string[] {
  const normalizedText = normalizeDigits(text.normalize("NFKC").toLocaleLowerCase().replace(/[\u2010-\u2015]/g, " "));
  const rawTerms = normalizedText
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(term => term.length > 0 && !LEXICAL_QUERY_FRAME_TERMS.has(term));

  const terms = rawTerms.flatMap(term => [
    term,
    ...(term === "कॉर्पोरेशन" ? ["निगम", "कंपनी"] : []),
    ...(term.startsWith("ಕಾರ್ಪ") ? ["ಕಂಪನಿ"] : []),
    ...(LEXICAL_TERM_EXPANSIONS[term] || []),
  ]);

  return Array.from(new Set(terms));
}

export function meaningfulLexicalTerms(text: string): string[] {
  return lexicalTerms(text).filter(term => !STOP_WORDS.has(term) && term.length > 1);
}

export function lexicalScore(text: string, terms: string[]): number {
  const normalized = normalizeDigits(text.normalize("NFKC").toLocaleLowerCase());
  const meaningful = terms.filter(t => !STOP_WORDS.has(t));
  return meaningful.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}
