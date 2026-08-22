import re

STOP_WORDS = {
    "what", "is", "the", "a", "an", "how", "to", "in", "of", "for", "and", "or",
    "by", "on", "at", "with", "this", "that", "from", "into", "can", "be", "are",
    "was", "were", "do", "does", "did", "have", "has", "had", "which", "who", "whom",
    "where", "when", "why", "used", "definition", "meaning", "define"
}

def extract_core_keywords(query: str) -> list[str]:
    raw = re.findall(r"\b[a-zA-Z0-9\u0900-\u097F]{3,}\b", query.lower())
    return [w for w in raw if w not in STOP_WORDS]

# Test on the smoke test queries
queries = [
    "what is wealth gov and econ definition",
    "hexadecimal numbers to binary numbers",
    "what is the scorebridge app used for",
    "compatibility definition",
    "how to find the surface area of a triangle",
    "what is providing customer service",
]

for q in queries:
    print(f"Query: '{q}' -> Core keywords: {extract_core_keywords(q)}")
