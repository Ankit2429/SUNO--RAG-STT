export const DENSE_VECTOR_SIZE = 384;
export const DENSE_VECTOR_NAME = "dense_vector";
export const ZERO_COST_EMBEDDING_MODEL = "multilingual-unicode-ngram-dense-v1";

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
  const normalized = text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
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

export function lexicalTerms(text: string): string[] {
  return text.normalize("NFKC").toLocaleLowerCase().split(/\s+/).map(term => term.replace(/[.,!?;:()[\]{}"']/g, "")).filter(term => term.length > 1).slice(0, 12);
}

export function lexicalScore(text: string, terms: string[]): number {
  const normalized = text.normalize("NFKC").toLocaleLowerCase();
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}
