"""Pure HTTP bridge to the REAL SUNO implementation -- the official
evaluator's embedder/generator interface, translated 1:1 into HTTP calls.

This module deliberately contains ZERO machine-learning code: no
sentence-transformers, no CrossEncoder, no FAISS, no local retrieval, no
re-implementation of any SUNO algorithm. Every embed/generate call is a
network request to the evaluation-only endpoints served by the actual
SUNO server (server/rag/evalBridge.ts), which run SUNO's own real
embedding and evidence/verification code:

    POST /api/eval/embed       {"texts": [...]}        -> {"vectors": [...]}
    POST /api/eval/embed-one   {"text": "..."}         -> {"vector": [...]}
    POST /api/eval/generate    {"query", "contexts"}   -> {"answer", "grounded", ...}

The evaluator keeps ownership of candidate chunking + its temporary FAISS
candidate index; only embedding vectors and generation decisions cross
the wire. Base URL: EVAL_SUNO_BASE_URL env var, default http://127.0.0.1:3000.
"""
import os
import time
from dataclasses import dataclass

import httpx
import numpy as np

_BASE_URL = os.environ.get("EVAL_SUNO_BASE_URL", "http://127.0.0.1:3000")
_MODEL_LABEL = "suno-http-bridge-v1"
_FALLBACK_DIM = 384

_client: httpx.Client | None = None


def _get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(base_url=_BASE_URL, timeout=30.0)
    return _client


@dataclass
class Answer:
    text: str
    grounded: bool
    generation_ms: float
    model: str


def get_model() -> None:
    """No local model exists to load -- prove the bridge is reachable once,
    before the evaluator starts timing anything."""
    response = _get_client().post("/api/eval/embed-one", json={"text": "connection probe"})
    response.raise_for_status()


def embed_one(text: str) -> np.ndarray:
    response = _get_client().post("/api/eval/embed-one", json={"text": text})
    response.raise_for_status()
    return np.asarray(response.json()["vector"], dtype=np.float32)


def embed(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, _FALLBACK_DIM), dtype=np.float32)
    response = _get_client().post("/api/eval/embed", json={"texts": list(texts)})
    response.raise_for_status()
    return np.asarray(response.json()["vectors"], dtype=np.float32)


def generate_answer(query: str, results: list) -> Answer:
    contexts = [
        {
            "text": getattr(r, "text", ""),
            "score": float(getattr(r, "score", 0.0) or 0.0),
            "id": getattr(r, "id", "") or f"cand-{i}",
            "source": getattr(r, "source", "") or getattr(r, "lang", "en"),
        }
        for i, r in enumerate(results)
    ]
    started = time.perf_counter()
    response = _get_client().post("/api/eval/generate", json={"query": query, "contexts": contexts})
    round_trip_ms = (time.perf_counter() - started) * 1000.0
    response.raise_for_status()
    data = response.json()
    # Server-side compute time is what SUNO actually spent in its own
    # evidence gate + deterministic generation code; the difference to
    # round_trip_ms is HTTP/serialization overhead.
    generation_ms = float(data.get("generation_ms") or round_trip_ms)
    return Answer(
        text=str(data.get("answer", "")),
        grounded=bool(data.get("grounded", False)),
        generation_ms=generation_ms,
        model=_MODEL_LABEL,
    )
