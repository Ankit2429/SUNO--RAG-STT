import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
if os.environ.get("OPENAI_API_KEY", "").startswith("sk-or-"):
    os.environ["OPENAI_BASE_URL"] = "https://openrouter.ai/api/v1"
    os.environ["EVAL_JUDGE_MODEL_OPENAI"] = "openai/gpt-4o-mini"

from eval.judge import _call_openai


# Test the judge call
sys_prompt = "You are a factual evaluator. Return JSON with 'verdict' (bool) and 'reason' (str)."
user_content = "Context: Corporations are legal entities.\nGenerated: Corporations are created by law.\nIs this faithful?"

try:
    res = _call_openai(sys_prompt, user_content)
    print("Judge Success!")
    print("Verdict:", res.verdict)
    print("Reason:", res.reason)
    print("Latency ms:", res.judge_ms)
except Exception as e:
    print("Judge Error:", e)
