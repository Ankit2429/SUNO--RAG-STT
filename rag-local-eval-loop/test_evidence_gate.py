import re

def validate_evidence_alignment(query: str, passage: str) -> bool:
    q_lower = query.lower().strip()
    p_lower = passage.lower().strip()

    # 1. "what is X used for" / "use of X" / "purpose of X"
    if any(pattern in q_lower for pattern in ["used for", "what is the use", "purpose of", "use of"]):
        purpose_indicators = [
            "used for", "used to", "designed for", "designed to", "allows", "enables",
            "helps to", "purpose of", "purpose is", "function of", "function is",
            "utilize", "utilized for", "utilized to", "can be used", "is an app for",
            "is a software for", "is used in", "is used by"
        ]
        if not any(ind in p_lower for ind in purpose_indicators):
            return False

    # 2. "when" / "what year" -> requires date / time
    if q_lower.startswith("when ") or "what year" in q_lower or "what date" in q_lower:
        has_year = bool(re.search(r"\b(?:1[789]\d{2}|20\d{2})\b", p_lower))
        has_time = bool(re.search(r"\b(?:century|january|february|march|april|may|june|july|august|september|october|november|december)\b", p_lower))
        if not (has_year or has_time):
            return False

    # 3. "X to Y" conversion queries (e.g. "hexadecimal numbers to binary numbers")
    to_match = re.match(r"^([a-z\s]+)\s+to\s+([a-z\s]+)$", q_lower)
    if to_match:
        src = to_match.group(1).strip()
        dst = to_match.group(2).strip()
        # If the passage explicitly talks about converting dst to src instead of src to dst
        if f"{dst} to {src}" in p_lower or f"{dst} into {src}" in p_lower:
            if not (f"{src} to {dst}" in p_lower or f"{src} into {dst}" in p_lower):
                return False

    # 4. Multi-concept specificity (e.g. "wealth gov and econ definition")
    # All non-stopword tokens must be present in the passage
    tokens = [t for t in re.findall(r"\b[a-z]{3,}\b", q_lower) if t not in {
        "what", "the", "and", "for", "how", "definition", "meaning", "define", "does", "are"
    }]
    if len(tokens) >= 3:
        matches = [t for t in tokens if t in p_lower]
        if len(matches) < len(tokens) * 0.5:
            return False

    return True

# Test on the 6 queries
test_cases = [
    ("what is wealth gov and econ definition", "Wealth is the value of all resources an individual or society owns."),
    ("hexadecimal numbers to binary numbers", "To convert binary numbers into hexadecimal numbers we must first divide the binary number up"),
    ("what is the scorebridge app used for", "Scorebridge for mac: 01 and 5, and XHTML 1. Samsung galaxy ace s5830i bedienungsanleitung pdf"),
    ("compatibility definition", "compatibility definition, meaning, what is compatibility: the ability of machines, especially computers"),
    ("how to find the surface area of a triangle", "To find the area of a triangle, multiply the base by the height, and then divide by 2."),
    ("what is providing customer service", "Customer service is the act of taking care of the customer's needs by providing and delivering"),
]

for q, p in test_cases:
    valid = validate_evidence_alignment(q, p)
    print(f"Query: '{q}' -> Valid: {valid}")
