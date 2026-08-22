import time
from sentence_transformers import SentenceTransformer

t0 = time.perf_counter()
model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
print(f"Loading {model_name}...")
model = SentenceTransformer(model_name)
t1 = time.perf_counter()
print(f"Loaded in {(t1-t0):.2f}s")

# Test cross-lingual embedding
q_hi = "निगम क्या है?"
q_en = "What is a corporation?"
doc_en = "A corporation is an organization—usually a group of people or a company—authorized by the state to act as a single entity."

v_hi = model.encode(q_hi)
v_en = model.encode(q_en)
v_doc = model.encode(doc_en)

import numpy as np
def cosine(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

print("Cos(q_hi, doc_en):", cosine(v_hi, v_doc))
print("Cos(q_en, doc_en):", cosine(v_en, v_doc))
print("Cos(q_hi, q_en):", cosine(v_hi, q_en))
