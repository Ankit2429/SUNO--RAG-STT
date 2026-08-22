import { normalizeDigits, DENSE_VECTOR_SIZE, STOP_WORDS } from "../server/rag/embedding";


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

export function improvedEmbedText(text: string): number[] {
  const normalized = normalizeDigits(text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim());
  const vector = Array.from({ length: DENSE_VECTOR_SIZE }, () => 0);
  const tokens = normalized.split(" ").filter(Boolean);

  const contentTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isStop = STOP_WORDS.has(token);
    const weight = isStop ? 0.3 : 4.0;
    add(vector, `token:${token}`, weight);
    if (!isStop && token.length > 1) {
      contentTokens.push(token);
    }
  }

  // Content token bigrams for phrase precision
  for (let i = 0; i < contentTokens.length - 1; i++) {
    add(vector, `bigram:${contentTokens[i]}_${contentTokens[i + 1]}`, 3.0);
  }

  // Transliteration for cross-lingual script matching
  const translit = transliterateIndicToLatin(normalized);
  if (translit !== normalized) {
    const tTokens = translit.split(/[^a-z0-9]+/i).filter(Boolean);
    for (const tt of tTokens) {
      if (tt.length > 2) {
        add(vector, `translit:${tt}`, 3.5);
      }
    }
  }

  // Character n-grams on content words
  for (const token of contentTokens) {
    const chars = Array.from(token);
    for (let i = 0; i < chars.length; i++) {
      if (i + 1 < chars.length) add(vector, `c2:${chars[i]}${chars[i + 1]}`, 1.0);
      if (i + 2 < chars.length) add(vector, `c3:${chars[i]}${chars[i + 1]}${chars[i + 2]}`, 1.8);
      if (i + 3 < chars.length) add(vector, `c4:${chars[i]}${chars[i + 1]}${chars[i + 2]}${chars[i + 3]}`, 1.4);
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map(value => value / magnitude) : vector;
}

console.log("Improved embed module ready.");
