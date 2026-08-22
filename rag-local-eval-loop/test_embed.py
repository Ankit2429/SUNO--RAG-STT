from eval.http_target import embed_one
import numpy as np

v = embed_one("What is a corporation?")
print("Python vector shape:", v.shape)
print("First 5 floats:", v[:5].tolist())
print("Last 5 floats:", v[-5:].tolist())
