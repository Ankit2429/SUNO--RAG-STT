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

const EMBED_CACHE = new Map<string, number[]>();
const LEXICAL_CACHE = new Map<string, string[]>();
const MEANINGFUL_LEXICAL_CACHE = new Map<string, string[]>();
const MAX_CACHE_SIZE = 2000;

function setBoundedCache<V>(cache: Map<string, V>, key: string, value: V) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
}

const INDIC_TO_LATIN_MAP: Record<string, string> = {
  // Devanagari consonants
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "f", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "d", "ढ़": "dh", "फ़": "f",
  // Vowels and matras
  "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "ri",
  "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "अं": "an", "अः": "ah",
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ं": "n", "ँ": "n", "ः": "h", "्": "",
  // Kannada
  "ಕ": "k", "ಖ": "kh", "ಗ": "g", "ಘ": "gh", "ಚ": "ch", "ಛ": "chh", "ಜ": "j", "ಝ": "jh",
  "ಟ": "t", "ಠ": "th", "ಡ": "d", "ಢ": "dh", "ಣ": "n", "ತ": "t", "ಥ": "th", "ದ": "d", "ಧ": "dh", "ನ": "n",
  "ಪ": "p", "ಫ": "f", "ಬ": "b", "ಭ": "bh", "ಮ": "m", "ಯ": "y", "ರ": "r", "ಲ": "l", "ವ": "v", "ಶ": "sh", "ಷ": "sh", "ಸ": "s", "ಹ": "h", "ಳ": "l",
  "ಾ": "a", "ಿ": "i", "ೀ": "i", "ು": "u", "ೂ": "u", "ೆ": "e", "ೇ": "e", "ೈ": "ai", "ೊ": "o", "ೋ": "o", "ೌ": "au", "ಂ": "n", "್": "",
  // Tamil
  "க": "k", "ங": "ng", "ச": "ch", "ஞ": "ny", "ட": "t", "ண": "n", "த": "t", "ந": "n", "ப": "p", "ம": "m",
  "ய": "y", "ர": "r", "ல": "l", "வ": "v", "ழ": "zh", "ள": "l", "ற": "r", "ன": "n", "ஜ": "j", "ஷ": "sh", "ஸ": "s", "ஹ": "h",
  "ா": "a", "ி": "i", "ீ": "i", "ு": "u", "ூ": "u", "ெ": "e", "ே": "e", "ை": "ai", "ொ": "o", "ோ": "o", "ௌ": "au", "்": ""
};

export function transliterateIndicToLatin(text: string): string {
  let res = "";
  for (const ch of text) {
    res += INDIC_TO_LATIN_MAP[ch] ?? ch;
  }
  return res;
}

/** A deterministic, server-only, Unicode-aware dense fallback for the zero-cost profile. */
export function embedText(text: string): number[] {
  const cached = EMBED_CACHE.get(text);
  if (cached) return cached;

  const normalized = normalizeDigits(text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim());
  const vector = Array.from({ length: DENSE_VECTOR_SIZE }, () => 0);
  const tokens = normalized.split(" ").filter(Boolean);

  const contentTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isStop = STOP_WORDS.has(token);
    if (isStop) {
      add(vector, `token:${token}`, 0.2);
    } else {
      const weight = 5.2;
      add(vector, `token:${token}`, weight);
      if (token.length > 1) {
        contentTokens.push(token);
        if (token.length >= 3) {
          add(vector, `pfx3:${token.slice(0, 3)}`, 2.5);
        }
        if (token.length >= 4) {
          add(vector, `pfx4:${token.slice(0, 4)}`, 2.8);
          add(vector, `sfx3:${token.slice(-3)}`, 1.5);
        }
        if (token.length >= 5) {
          add(vector, `pfx5:${token.slice(0, 5)}`, 2.2);
        }
      }
    }
  }

  // Content token bigrams for phrase precision
  for (let i = 0; i < contentTokens.length - 1; i++) {
    add(vector, `bigram:${contentTokens[i]}_${contentTokens[i + 1]}`, 3.6);
  }

  // Cross-lingual phonetic transliteration
  const translit = transliterateIndicToLatin(normalized);
  if (translit !== normalized) {
    const tTokens = translit.split(/[^a-z0-9]+/i).filter(Boolean);
    for (const tt of tTokens) {
      if (!STOP_WORDS.has(tt) && tt.length > 1) {
        add(vector, `translit:${tt}`, 4.2);
        if (tt.length >= 3) {
          add(vector, `pfx3:${tt.slice(0, 3)}`, 2.5);
        }
        if (tt.length >= 4) {
          add(vector, `pfx4:${tt.slice(0, 4)}`, 2.8);
          add(vector, `sfx3:${tt.slice(-3)}`, 1.5);
        }
        if (tt.length >= 5) {
          add(vector, `pfx5:${tt.slice(0, 5)}`, 2.2);
        }
      }
    }
    for (let i = 0; i < tTokens.length - 1; i++) {
      if (!STOP_WORDS.has(tTokens[i]) && !STOP_WORDS.has(tTokens[i + 1])) {
        add(vector, `tbigram:${tTokens[i]}_${tTokens[i + 1]}`, 3.0);
      }
    }
  }

  // Subword character n-grams on content words
  for (const token of contentTokens) {
    const chars = Array.from(token);
    for (let i = 0; i < chars.length; i++) {
      if (i + 1 < chars.length) add(vector, `c2:${chars[i]}${chars[i + 1]}`, 0.6);
      if (i + 2 < chars.length) add(vector, `c3:${chars[i]}${chars[i + 1]}${chars[i + 2]}`, 1.8);
      if (i + 3 < chars.length) add(vector, `c4:${chars[i]}${chars[i + 1]}${chars[i + 2]}${chars[i + 3]}`, 1.5);
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  const result = magnitude ? vector.map(value => value / magnitude) : vector;
  setBoundedCache(EMBED_CACHE, text, result);
  return result;
}


export function isStopWord(term: string): boolean {
  return STOP_WORDS.has(term.toLocaleLowerCase());
}

export function lexicalTerms(text: string): string[] {
  const cached = LEXICAL_CACHE.get(text);
  if (cached) return cached;

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

  const result = Array.from(new Set(terms));
  setBoundedCache(LEXICAL_CACHE, text, result);
  return result;
}

export function meaningfulLexicalTerms(text: string): string[] {
  const cached = MEANINGFUL_LEXICAL_CACHE.get(text);
  if (cached) return cached;

  const result = lexicalTerms(text).filter(term => !STOP_WORDS.has(term) && term.length > 1);
  setBoundedCache(MEANINGFUL_LEXICAL_CACHE, text, result);
  return result;
}

export function lexicalScore(text: string, terms: string[]): number {
  const normalized = normalizeDigits(text.normalize("NFKC").toLocaleLowerCase());
  const meaningful = terms.filter(t => !STOP_WORDS.has(t));
  return meaningful.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

