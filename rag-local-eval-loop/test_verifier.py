import os
import sys
import re
import numpy as np
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eval import dataset
from sentence_transformers import SentenceTransformer, CrossEncoder
import faiss

examples = dataset.load_examples(num_answerable=50, num_unanswerable=50, seed=42)
model = SentenceTransformer("intfloat/multilingual-e5-small")
ce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

from dataclasses import dataclass
@dataclass
class ChunkRecord:
    query_id: int
    lang: str
    is_selected: bool
    text: str

def _chunk_text(text: str, size=300, overlap=50) -> list[str]:
    text = text.strip()
    if len(text) <= size:
        return [text] if text else []
    chunks = []
    step = max(1, size - overlap)
    for start in range(0, len(text), step):
        chunk = text[start : start + size].strip()
        if chunk:
            chunks.append(chunk)
        if start + size >= len(text):
            break
    return chunks

texts = []
records = []
for ex in examples:
    selected_idx = ex.gt_passage_index
    for lang, candidates in (("en", ex.candidates_en), ("hi", ex.candidates_hi)):
        for i, passage in enumerate(candidates):
            if not passage:
                continue
            for chunk in _chunk_text(passage):
                texts.append(chunk)
                records.append(ChunkRecord(query_id=ex.query_id, lang=lang, is_selected=(i == selected_idx), text=chunk))

cand_texts = [f"passage: {t}" for t in texts]
doc_vecs = model.encode(cand_texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)

dim = doc_vecs.shape[1]
index = faiss.IndexHNSWFlat(dim, 16, faiss.METRIC_INNER_PRODUCT)
index.hnsw.efConstruction = 64
index.hnsw.efSearch = 64
index.add(np.array(doc_vecs, dtype=np.float32))

def verify_grounded_answer(query: str, passage: str, ce_score: float) -> bool:
    if ce_score < 4.0:
        return False
    
    q_low = query.lower().strip()
    p_low = passage.lower().strip()
    
    # 1. Zip code
    if "zip code" in q_low or "postal code" in q_low:
        if not re.search(r"\b\d{5}(?:-\d{4})?\b", p_low):
            return False

    # 2. Phone / contact
    if "phone number" in q_low or "contact number" in q_low:
        if not re.search(r"\b(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b", p_low):
            return False

    # 3. Address
    if "address" in q_low or "location of" in q_low:
        has_addr = bool(re.search(r"\b\d+\s+[a-z0-9\s]+(?:street|st|avenue|ave|road|rd|blvd|lane|drive|dr|way|court|ct|box)\b", p_low))
        has_city_st = bool(re.search(r"\b[a-z\s]+,\s*[a-z]{2}\b", p_low))
        if not (has_addr or has_city_st):
            return False

    # 4. "when" / "what year" / "what date"
    if q_low.startswith("when ") or "what year" in q_low or "what date" in q_low:
        has_year = bool(re.search(r"\b(?:1[6789]\d{2}|20\d{2})\b", p_low))
        has_month = bool(re.search(r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b", p_low))
        has_rel = bool(re.search(r"\b(?:age of|after|before|during|century|bc|ad|bce|ce)\b", p_low))
        if not (has_year or has_month or has_rel):
            return False

    # 5. "how old"
    if "how old" in q_low:
        if not re.search(r"\b(?:\d{1,3}\s*years?\s*old|age\s*(?:of\s*)?\d{1,3}|born\s*(?:in\s*)?\d{4}|died\s*(?:in\s*)?\d{4})\b", p_low):
            return False

    # 6. "how much" / "how many" / "cost of" / "price of"
    if any(k in q_low for k in ["how much", "how many", "what is the cost", "what is the price"]):
        if not re.search(r"(?:\$|£|€|₹|\b\d+(?:\.\d+)?\s*(?:dollars|cents|percent|%|hours|days|weeks|months|years|lbs|kg|grams|miles|feet|inches|gallons|liters|mg|cups|tbsp|tsp|ounces|tons|gb|mb|tb|million|billion|thousand)\b|\b\d+\b)", p_low):
            return False

    # 7. "how high" / "how tall" / "height of"
    if any(k in q_low for k in ["how high", "how tall", "what is the height"]):
        if not re.search(r"\b\d+(?:\.\d+)?\s*(?:inches|inch|in|feet|foot|ft|cm|meters|m|yards|yd)\b", p_low):
            return False

    # 8. "how long do" / "how long does" / "duration of"
    if "how long" in q_low:
        if not re.search(r"\b\d+(?:\.\d+)?\s*(?:seconds|minutes|mins|hours|hrs|days|weeks|months|years|decades|centuries)\b", p_low):
            return False

    # 9. "what is X used for" / "purpose of"
    if any(k in q_low for k in ["used for", "use of", "purpose of", "what is the use"]):
        purpose_indicators = [
            "used for", "used to", "designed for", "designed to", "allows", "enables",
            "helps to", "purpose of", "purpose is", "function of", "function is",
            "utilize", "utilized for", "utilized to", "can be used", "is an app for",
            "is a software for", "is used in", "is used by", "treatment for", "prescribed for"
        ]
        if not any(ind in p_low for ind in purpose_indicators):
            return False

    # 10. "why did" / "why is" / "why do"
    if q_low.startswith("why "):
        causal = ["because", "due to", "in order to", "as a result", "reason", "so that", "since", "caused by", "lead to", "leads to"]
        if not any(c in p_low for c in causal):
            return False

    # 11. "how to"
    if q_low.startswith("how to ") or "how do you " in q_low or "how can i " in q_low:
        instructions = ["step", "first", "then", "you should", "you can", "to do this", "by", "start by", "apply", "place", "use", "make sure", "ensure", "clean", "remove", "add", "mix", "pour", "cut", "press", "click", "open", "turn", "take"]
        if not any(inst in p_low for inst in instructions):
            return False

    return True

false_refusals = 0
false_confidences = 0

for ex in examples:
    q_en = f"query: {ex.query_en}"
    q_hi = f"query: {ex.query_hi}"
    
    v_en = model.encode(q_en, normalize_embeddings=True).reshape(1, -1)
    v_hi = model.encode(q_hi, normalize_embeddings=True).reshape(1, -1)
    
    _, idxs_en = index.search(np.array(v_en, dtype=np.float32), 5)
    _, idxs_hi = index.search(np.array(v_hi, dtype=np.float32), 5)
    
    top_chunks = [records[i].text for i in idxs_en[0]] + [records[i].text for i in idxs_hi[0]]
    top_chunks = list(dict.fromkeys(top_chunks))[:5]
    
    pairs = [[ex.query_en, c] for c in top_chunks]
    ce_scores = ce.predict(pairs)
    best_idx = int(np.argmax(ce_scores))
    best_score = float(ce_scores[best_idx])
    best_text = top_chunks[best_idx]
    
    is_grounded = verify_grounded_answer(ex.query_en, best_text, best_score)
    
    if ex.is_answerable and not is_grounded:
        false_refusals += 1
        print(f"FALSE REFUSAL: QID={ex.query_id} | Score={best_score:.2f} | Q={ex.query_en}")
    elif not ex.is_answerable and is_grounded:
        false_confidences += 1
        print(f"FALSE CONFIDENCE: QID={ex.query_id} | Score={best_score:.2f} | Q={ex.query_en} | Text={best_text[:80]}...")

print("\n" + "="*60)
print(f"False Refusal Rate:   {false_refusals}/50 = {false_refusals/50*100:.1f}%")
print(f"False Confidence Rate: {false_confidences}/50 = {false_confidences/50*100:.1f}%")
print("="*60)
