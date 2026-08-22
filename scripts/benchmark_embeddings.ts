import fs from "node:fs";
import { normalizeDigits, DENSE_VECTOR_SIZE, STOP_WORDS } from "../server/rag/embedding";
import { transliterateIndicToLatin } from "./test_improved_embedding";

const payload = JSON.parse(fs.readFileSync("./scratch/eval_payload.json", "utf-8"));
const passages: Array<{ query_id: number; lang: string; is_selected: boolean; text: string }> = payload.passages;
const queries_en: Array<{ query_id: number; text: string }> = payload.queries_en;
const queries_hi: Array<{ query_id: number; text: string }> = payload.queries_hi;

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

// Current baseline embedding
function baselineEmbed(text: string): number[] {
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

// Candidate improved embedding with root prefixes and stem hashing
function advancedEmbed(text: string): number[] {
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
    // Transliteration bigrams
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
  return magnitude ? vector.map(value => value / magnitude) : vector;
}



function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function evaluate(embedFn: (t: string) => number[], name: string) {
  console.log(`\nEvaluating: ${name}`);
  const passageVectors = passages.map(p => embedFn(p.text));

  let r1_en = 0, r3_en = 0, r5_en = 0, rr_en: number[] = [];
  let r1_hi = 0, r3_hi = 0, r5_hi = 0, rr_hi: number[] = [];
  let r1_cross = 0, r3_cross = 0, r5_cross = 0, rr_cross: number[] = [];

  for (let qi = 0; qi < queries_en.length; qi++) {
    const q_en = queries_en[qi];
    const q_hi = queries_hi[qi];
    const qid = q_en.query_id;

    const qvec_en = embedFn(q_en.text);
    const qvec_hi = embedFn(q_hi.text);

    // Score all passages for EN query
    const scores_en = passageVectors.map((pv, idx) => ({ idx, score: dotProduct(qvec_en, pv), is_selected: passages[idx].is_selected && passages[idx].query_id === qid }));
    scores_en.sort((a, b) => b.score - a.score);

    // Score all passages for HI query
    const scores_hi = passageVectors.map((pv, idx) => ({ idx, score: dotProduct(qvec_hi, pv), is_selected: passages[idx].is_selected && passages[idx].query_id === qid }));
    scores_hi.sort((a, b) => b.score - a.score);

    // EN metrics
    const hit_rank_en = scores_en.slice(0, 10).findIndex(s => s.is_selected);
    if (hit_rank_en !== -1) {
      const rank = hit_rank_en + 1;
      rr_en.push(1 / rank);
      if (rank <= 1) r1_en++;
      if (rank <= 3) r3_en++;
      if (rank <= 5) r5_en++;
    } else {
      rr_en.push(0);
    }

    // HI metrics
    const hit_rank_hi = scores_hi.slice(0, 10).findIndex(s => s.is_selected);
    if (hit_rank_hi !== -1) {
      const rank = hit_rank_hi + 1;
      rr_hi.push(1 / rank);
      if (rank <= 1) r1_hi++;
      if (rank <= 3) r3_hi++;
      if (rank <= 5) r5_hi++;
    } else {
      rr_hi.push(0);
    }

    // Cross-lingual (best rank of either EN or HI)
    const best_rank = Math.min(
      hit_rank_en !== -1 ? hit_rank_en + 1 : 999,
      hit_rank_hi !== -1 ? hit_rank_hi + 1 : 999
    );
    if (best_rank <= 10) {
      rr_cross.push(1 / best_rank);
      if (best_rank <= 1) r1_cross++;
      if (best_rank <= 3) r3_cross++;
      if (best_rank <= 5) r5_cross++;
    } else {
      rr_cross.push(0);
    }
  }

  const N = queries_en.length;
  console.log(`  English:       Recall@1=${(r1_en/N*100).toFixed(1)}% | Recall@3=${(r3_en/N*100).toFixed(1)}% | Recall@5=${(r5_en/N*100).toFixed(1)}% | MRR=${(rr_en.reduce((a,b)=>a+b,0)/N).toFixed(3)}`);
  console.log(`  Hindi:         Recall@1=${(r1_hi/N*100).toFixed(1)}% | Recall@3=${(r3_hi/N*100).toFixed(1)}% | Recall@5=${(r5_hi/N*100).toFixed(1)}% | MRR=${(rr_hi.reduce((a,b)=>a+b,0)/N).toFixed(3)}`);
  console.log(`  Cross-Lingual: Recall@1=${(r1_cross/N*100).toFixed(1)}% | Recall@3=${(r3_cross/N*100).toFixed(1)}% | Recall@5=${(r5_cross/N*100).toFixed(1)}% | MRR=${(rr_cross.reduce((a,b)=>a+b,0)/N).toFixed(3)}`);
}

evaluate(baselineEmbed, "Baseline Unicode N-Gram Dense Embed");
evaluate(advancedEmbed, "Advanced Weighted & Transliterated Dense Embed");
