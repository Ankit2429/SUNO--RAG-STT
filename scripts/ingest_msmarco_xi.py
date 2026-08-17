#!/usr/bin/env python3
"""Stream a reproducible MSMARCO-XI slice without loading the corpus into RAM.

The output is intentionally a local ingestion artifact. The deployed service reads
only the corresponding Qdrant collection, never the raw parquet files.
"""

import argparse
import hashlib
import json
import os
import unicodedata
from collections import Counter
from datetime import datetime, timezone

import fsspec
import pyarrow.parquet as pq

DATASET = "ai4bharat/MSMARCO-XI"
STEMS = {
    "as": "asm", "bn": "ben", "gu": "guj", "hi": "hin", "kn": "kan",
    "ml": "mal", "mr": "mar", "ne": "nep", "or": "ori", "pa": "pan",
    "sa": "san", "ta": "tam", "te": "tel", "ur": "urd",
}
VALIDATION_ORDINAL = {
    "as": 0, "bn": 1, "gu": 2, "hi": 3, "kn": 4, "ml": 5, "mr": 6,
    "ne": 7, "or": 8, "pa": 9, "sa": 10, "ta": 11, "te": 12, "ur": 13,
}
SENTENCE_ENDINGS = ".!?।॥؟"

def normalise(value):
    return " ".join(unicodedata.normalize("NFC", value or "").split())

def stable_id(*parts):
    return hashlib.sha256("\u241f".join(map(str, parts)).encode()).hexdigest()[:20]

def chunks_for_passage(language, row, passage, ordinal, selected):
    passage = normalise(passage)
    query_id = str(row.get("query_id", "unknown"))
    query_type = str(row.get("query_type", "unknown"))
    parent_id = stable_id(language, query_id, ordinal, passage)
    chunks = []

    def add(strategy, text, overlap, index):
        text = normalise(text)
        if len(text) < 40:
            return
        chunks.append({
            "id": stable_id(parent_id, strategy, index, text), "text": text,
            "language": language, "source": DATASET, "strategy": strategy,
            "parentId": parent_id, "queryId": query_id, "queryType": query_type,
            "ordinal": ordinal, "selected": bool(selected), "overlap": overlap,
        })

    sentences, current = [], []
    for word in passage.split():
        current.append(word)
        if word[-1:] in SENTENCE_ENDINGS:
            sentences.append(" ".join(current)); current = []
    if current: sentences.append(" ".join(current))
    for start in range(0, max(0, len(sentences) - 1), 2):
        window = sentences[start:start + 3]
        if len(window) >= 2: add("semantic_sentence_window", " ".join(window), 1, start)

    for index, paragraph in enumerate(passage.split("\n\n")):
        add("paragraph_section", paragraph, 0, index)

    answer_terms = set(normalise(row.get("Answer", "")).casefold().split())
    words = passage.split()
    pivot = next((i for i, word in enumerate(words) if word.casefold() in answer_terms and len(word) > 3), None)
    if pivot is not None: add("answer_centered_window", " ".join(words[max(0, pivot-38):pivot+38]), 0, pivot)

    for start in range(0, len(words), 72):
        fixed = words[start:start + 90]
        if len(fixed) >= 24: add("fixed_window_fallback", " ".join(fixed), 18, start)

    add("query_linked_evaluation", f"Question type: {query_type}. Supporting passage: {passage}", 0, 0)
    return chunks

def read_examples(language, split, revision, rows_per_language):
    stem = STEMS[language]
    suffix = "val" if split == "validation" else "train"
    url = f"https://huggingface.co/datasets/{DATASET}/resolve/{revision}/{split}/{stem}{suffix}.parquet?download=true"
    fs = fsspec.filesystem("http")
    with fs.open(url, "rb", block_size=256 * 1024, cache_type="readahead") as handle:
        parquet = pq.ParquetFile(handle)
        result = []
        for batch in parquet.iter_batches(batch_size=min(rows_per_language, 64)):
            result.extend(batch.to_pylist())
            if len(result) >= rows_per_language: break
        return result[:rows_per_language], parquet.metadata.num_rows

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--languages", default="hi,ta,te,bn,mr")
    parser.add_argument("--split", default="validation", choices=["validation", "train"])
    parser.add_argument("--rows-per-language", type=int, default=20)
    parser.add_argument("--revision", default="main")
    parser.add_argument("--index-version", default="msmarco-xi-evaluation-v1")
    parser.add_argument("--output-dir", default=os.path.expanduser("~/msmarco-xi-ingestion"))
    args = parser.parse_args()
    languages = [language.strip() for language in args.languages.split(",") if language.strip() in STEMS]
    os.makedirs(args.output_dir, exist_ok=True)
    output_path = os.path.join(args.output_dir, "chunks.jsonl")
    query_path = os.path.join(args.output_dir, "benchmark-queries.jsonl")
    row_counts, counter, dedupe = {}, Counter(), set()

    with open(output_path, "w", encoding="utf-8") as out, open(query_path, "w", encoding="utf-8") as queries_out:
        for language in languages:
            examples, total_rows = read_examples(language, args.split, args.revision, args.rows_per_language)
            row_counts[language] = total_rows
            for row in examples:
                passages = row.get("passages") or {}
                translated = passages.get("Translated_passages") or []
                selected_flags = passages.get("is_selected") or []
                selected_parent_ids = []
                for ordinal, passage in enumerate(translated):
                    text = normalise(passage)
                    key = stable_id(language, text)
                    if not text or key in dedupe: continue
                    dedupe.add(key)
                    selected = selected_flags[ordinal] if ordinal < len(selected_flags) else False
                    created = chunks_for_passage(language, row, text, ordinal, selected)
                    if selected and created:
                        selected_parent_ids.append(created[0]["parentId"])
                    for chunk in created:
                        counter[chunk["strategy"]] += 1
                        out.write(json.dumps(chunk, ensure_ascii=False) + "\n")
                query = normalise(row.get("query", ""))
                if query:
                    queries_out.write(json.dumps({
                        "id": stable_id(language, row.get("query_id", "unknown"), query),
                        "query": query,
                        "language": language,
                        "queryType": str(row.get("query_type", "unknown")),
                        "expectedParentIds": selected_parent_ids,
                        "source": DATASET,
                    }, ensure_ascii=False) + "\n")

    manifest = {
        "datasetRevision": args.revision,
        "rowCounts": row_counts,
        "languages": languages,
        "indexVersion": args.index_version,
        "buildTimestamp": datetime.now(timezone.utc).isoformat(),
        "profile": "evaluation",
        "embeddingModel": "cluster-configured-free-cloud-inference-model",
        "embeddingDimensions": 384,
        "chunkCounts": dict(counter),
        "chunkFile": output_path,
        "benchmarkQueryFile": query_path,
        "sourceSplit": args.split,
    }
    with open(os.path.join(args.output_dir, "ingestion-manifest.json"), "w", encoding="utf-8") as out:
        json.dump(manifest, out, ensure_ascii=False, indent=2)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
