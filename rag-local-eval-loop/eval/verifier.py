"""Experimental LLM verifier for answerability detection.

This module is TEST-ONLY -- it is NOT part of the production RAG pipeline.
It is activated only when the VERIFIER_PROMPT environment variable is set
to 'A' or 'B', selecting between two prompt variants:

  A: Strict Proposition-Support Verifier
     Asks: "Does this context contain a DIRECT, SPECIFIC answer to
     this exact question?" Explicitly rejects topical overlap, wrong
     entities, wrong metrics, quiz text, and related-but-non-answering facts.

  B: Evidence-Entailment Verifier
     Asks: "Does this context ENTAIL an answer to this question?"
     Focuses on whether the specific proposition the query asks about
     is explicitly stated or directly inferable from the context.

Uses the same OpenAI/OpenRouter credentials as the eval judge (judge.py).
Does NOT use outside knowledge, does NOT generate the answer, and does NOT
see ground truth.
"""
import json
import os
import time
from dataclasses import dataclass

import openai

_verifier_client = None


@dataclass
class VerifierResult:
    supported: bool
    verdict: str
    evidence_ids: list
    reason: str
    verifier_ms: float
    prompt_variant: str
    raw: str


# ── Prompt A: Strict Proposition-Support ─────────────────────────────────

_PROMPT_A_SYSTEM = """\
You are a strict answerability judge for a retrieval-augmented generation system.

You will receive a QUERY and CONTEXT (retrieved passages). Your job is to determine \
whether the CONTEXT contains a DIRECT, SPECIFIC answer to the QUERY.

You must REJECT (supported=false) if:
- The context is merely topically related but does not answer the specific question asked
- The context discusses a different entity than what the query asks about \
  (e.g., query asks about dolphins but context discusses whales)
- The context contains a different metric, unit, or quantity than what is asked
- The context contains quiz questions, multiple-choice prompts, or distractor text \
  rather than assertive factual statements
- The context contains related facts but NOT the specific proposition the query requests \
  (e.g., query asks "who created X" but context only says "X is made by company Y" \
  without naming a person)
- The context discusses the right topic but answers a different question about it

You must ACCEPT (supported=true) ONLY if the context contains information that \
directly and specifically answers what the query is asking.

Do NOT use your own knowledge. Judge ONLY what is in the provided CONTEXT.

Respond with JSON: {"supported": true/false, "reason": "one sentence explanation"}\
"""

# ── Prompt B: Evidence-Entailment ────────────────────────────────────────

_PROMPT_B_SYSTEM = """\
You are an evidence-entailment judge for a retrieval-augmented generation system.

You will receive a QUERY and CONTEXT (retrieved passages). Determine whether the \
CONTEXT entails an answer to the QUERY.

"Entails an answer" means the specific proposition the query asks about is either:
1. Explicitly stated in the context, OR
2. Directly and necessarily inferable from statements in the context

The following do NOT count as entailment:
- Topical overlap without answering the specific question
- Mentioning the subject but providing information about a different aspect
- Containing entities or facts from the same domain but about different subjects
- Quiz questions, lists of choices, or hypothetical/conditional statements
- Partial matches where only some aspects of a multi-part question are addressed

Judge ONLY the provided CONTEXT. Do not use outside knowledge.

Respond with JSON: {"supported": true/false, "reason": "one sentence explanation"}\
"""

# ── Prompt C: 3-Way Calibrated Verifier ──────────────────────────────────

_PROMPT_CALIBRATED_SYSTEM = """\
You are a calibrated evidence verifier for a retrieval-augmented generation system.

You will receive a QUERY and candidate CONTEXT passages. Classify whether the CONTEXT \
contains sufficient information to answer the QUERY into exactly one of three verdicts:

1. "CONFIRMED_UNANSWERABLE":
   - The context is strictly irrelevant, contradicts, discusses an entirely different subject/entity, \
or is a pure distractor/quiz template that does not contain factual answer material.
   - Use this ONLY when you are certain the passage cannot answer what is asked.

2. "PLAUSIBLE_OR_PARTIAL":
   - The context is on-topic and contains plausible, partial, or closely related factual information \
from which an answer can reasonably be extracted or inferred.
   - If in doubt between unanswerable and answerable, choose "PLAUSIBLE_OR_PARTIAL".

3. "CONFIRMED_ANSWERABLE":
   - The context directly and unambiguously answers the specific question asked.

Respond ONLY with a JSON object in this exact schema:
{
  "verdict": "CONFIRMED_UNANSWERABLE" | "PLAUSIBLE_OR_PARTIAL" | "CONFIRMED_ANSWERABLE",
  "evidence_ids": [1],
  "reason": "one short sentence explanation"
}\
"""


def _get_client():
    global _verifier_client
    if _verifier_client is not None:
        return _verifier_client

    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL")

    if api_key and api_key.startswith("sk-or-"):
        if not base_url:
            base_url = "https://openrouter.ai/api/v1"

    if base_url or api_key:
        _verifier_client = openai.OpenAI(base_url=base_url, api_key=api_key)
    else:
        _verifier_client = openai.OpenAI()

    return _verifier_client


def _get_model() -> str:
    model = os.environ.get("EVAL_JUDGE_MODEL_OPENAI", "gpt-4o-mini")
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if api_key and api_key.startswith("sk-or-") and "/" not in model:
        model = f"openai/{model}"
    return model


def verify(query: str, context: str, prompt_variant: str = "calibrated") -> VerifierResult:
    """Call the LLM verifier to check if context supports answering the query.

    Args:
        query: The user's question
        context: The retrieved passage text (best candidate after CE ranking)
        prompt_variant: 'A', 'B', or 'calibrated' / 'C'

    Returns:
        VerifierResult with supported/verdict/reason/latency
    """
    variant_norm = prompt_variant.strip().upper()
    if variant_norm == "A":
        system_prompt = _PROMPT_A_SYSTEM
    elif variant_norm == "B":
        system_prompt = _PROMPT_B_SYSTEM
    else:
        system_prompt = _PROMPT_CALIBRATED_SYSTEM

    user_content = f"QUERY:\n{query}\n\nCONTEXT:\n{context[:2000]}"

    client = _get_client()
    model = _get_model()

    t0 = time.perf_counter()
    try:
        try:
            response = client.chat.completions.create(
                model=model,
                max_tokens=150,
                temperature=0.0,
                timeout=10.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
            )
        except Exception:
            response = client.chat.completions.create(
                model=model,
                max_completion_tokens=150,
                temperature=0.0,
                timeout=10.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
            )
    except Exception as e:

        verifier_ms = (time.perf_counter() - t0) * 1000
        return VerifierResult(
            supported=True,
            verdict="PLAUSIBLE_OR_PARTIAL",
            evidence_ids=[],
            reason=f"[verifier error: {e}]",
            verifier_ms=verifier_ms,
            prompt_variant=prompt_variant,
            raw=str(e),
        )

    verifier_ms = (time.perf_counter() - t0) * 1000
    raw = (response.choices[0].message.content or "").strip()

    try:
        parsed = json.loads(raw)
        verdict = str(parsed.get("verdict", "")).strip().upper()
        if not verdict:
            # Check legacy boolean supported field
            if "supported" in parsed:
                supported_bool = bool(parsed["supported"])
                verdict = "CONFIRMED_ANSWERABLE" if supported_bool else "CONFIRMED_UNANSWERABLE"
            else:
                verdict = "PLAUSIBLE_OR_PARTIAL"

        supported = (verdict != "CONFIRMED_UNANSWERABLE")
        evidence_ids = parsed.get("evidence_ids", [])
        reason = str(parsed.get("reason", ""))
    except (json.JSONDecodeError, KeyError, TypeError):
        supported = True
        verdict = "PLAUSIBLE_OR_PARTIAL"
        evidence_ids = []
        reason = f"[verifier output did not parse: {raw[:200]}]"

    return VerifierResult(
        supported=supported,
        verdict=verdict,
        evidence_ids=evidence_ids,
        reason=reason,
        verifier_ms=verifier_ms,
        prompt_variant=prompt_variant,
        raw=raw,
    )

