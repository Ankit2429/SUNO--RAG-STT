# SUNO

> **Speak a question. Receive a cited answer—or a safe refusal.**

SUNO is a **voice-enabled, multilingual Retrieval-Augmented Generation (RAG) evaluator** built for HH Goa Task 112. It connects real browser microphone input to server-side speech transcription, engineered retrieval over **AI4Bharat/MSMARCO-XI**, deterministic evidence-grounded answer assembly, and a fail-closed safety harness.[1]

The project is designed to demonstrate the full voice-to-answer path while being explicit about its evaluation contract: **SUNO never invents an answer when indexed evidence is insufficient.**

## Evaluation Snapshot

| Requirement | SUNO implementation |
|---|---|
| Real voice input | Browser `MediaRecorder` captures Opus/WebM audio and sends it to the protected server route. |
| Speech-to-text | Server-side **Sarvam Saaras v3** transcription with retries, MIME normalization, language hints, and automatic-detection recovery. |
| Dataset | AI4Bharat/MSMARCO-XI evidence corpus, with 12,650 Qdrant points and a 14-language ingestion manifest.[1] |
| Focused evaluator languages | Hindi, Kannada, English, Tamil, and Marathi. |
| Engineered chunking | Five chunk families: semantic sentence windows, paragraph/section chunks, answer-centered windows, fixed-window fallback, and query-linked evaluation records. |
| Retrieval | L1 in-process multilingual evidence cache plus bounded L2 Qdrant Cloud dense/lexical retrieval and reciprocal-rank fusion. |
| Answering | Deterministic single-sentence extractive assembly from cited evidence; no default LLM answer generation. |
| Guardrails | Structured safety, prompt-injection, language-confidence, evidence-sufficiency, and grounding-verification gates. |
| Latest five-language benchmark | 1,000 requests, 0 harness errors, internal RAG P50/P70/P90/P95/P100 of **0.20 / 0.24 / 0.36 / 0.41 / 3.00 ms**.[2] |

> **Latency scope:** The under-200 ms claim applies to the **post-transcription internal RAG path**: transcript normalization, retrieval, fusion, grounding verification, deterministic answer assembly, and harness handling. It does not include microphone capture, browser upload, Sarvam STT, or network transfer, which are measured separately.[2]

## Architecture

```text
Browser microphone
  └─ MediaRecorder (Opus/WebM)
       └─ Sarvam Saaras v3 transcription (server-side)
            └─ 14-stage fail-closed harness
                 ├─ language confidence and scope gate
                 ├─ safety and prompt-injection screening
                 ├─ L1 hot-corpus retrieval
                 ├─ bounded L2 Qdrant dense + lexical retrieval
                 ├─ reciprocal-rank fusion and reranking
                 ├─ evidence-sufficiency verification
                 └─ deterministic cited answer OR safe refusal
```

The voice harness keeps STT timing separate from RAG timing. For automatic language detection, SUNO requires at least **80% confidence** and a focused supported language before retrieval is allowed. If confidence is below the threshold, the evaluator directs the user to select the language explicitly and record again.[3]

## Retrieval and Grounding Design

SUNO does not rely on one fixed-size split. The corpus preparation and evaluation layer use complementary chunk families so that retrieval can preserve sentence context, section context, direct answer context, fixed-window fallback coverage, and query-linked auditability.

| Chunk family | Purpose |
|---|---|
| Semantic sentence window | Maintains compact local context around meaningful sentence boundaries. |
| Paragraph/section | Preserves broader passage-level meaning and metadata. |
| Answer-centered window | Keeps a likely answer sentence with its supporting neighborhood. |
| Fixed-window fallback | Provides robust coverage when semantic boundaries are weak. |
| Query-linked evaluation | Connects corpus evidence to repeatable benchmark fixtures. |

The retrieval layer first searches a fast local evidence cache. If the local route cannot support the query, SUNO uses a time-bounded Qdrant Cloud fallback. A slow or unavailable fallback is treated as a **safe refusal**, not as permission to make up an answer.[4]

## Guardrails and Refusal Policy

SUNO is intentionally fail-closed. It checks the transcript before retrieval and verifies the final answer against retrieved evidence before returning it.

| Condition | Behavior |
|---|---|
| Unsupported or off-corpus question | `REFUSED` with zero citations. |
| Unsafe or prompt-injection input | `REFUSED` before answer construction. |
| Automatic language detection below 80% | Stops before retrieval and requests an explicit language selection. |
| Retrieval has insufficient supporting evidence | `REFUSED`; no generated fallback answer is shown. |
| Evidence passes verification | Returns the strongest relevant cited sentence. |

This policy is deliberate: a refusal is a correct outcome when the dataset cannot support the question.[5]

## Local Setup

### Prerequisites

| Dependency | Recommended version or service |
|---|---|
| Node.js | 22 or later |
| Package manager | pnpm 10 |
| Speech provider | Sarvam API access for `SARVAM_API_KEY` |
| Vector database | Qdrant Cloud collection access for `QDRANT_URL` and `QDRANT_API_KEY` |
| Database/auth runtime | The included Manus full-stack runtime configuration, or equivalent environment values for the template services |

Clone the repository, install dependencies, then configure environment variables **outside version control**.

```bash
git clone https://github.com/Ankit2429/SUNO--RAG-STT.git
cd SUNO--RAG-STT
pnpm install
```

Create a local environment configuration using your own credentials. Never commit secrets, API keys, database URLs, or Qdrant credentials.

```bash
# Required for the voice-and-retrieval path
SARVAM_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...

# Required by the included full-stack runtime
DATABASE_URL=...
JWT_SECRET=...
VITE_APP_ID=...
OAUTH_SERVER_URL=...
```

Start the application with:

```bash
pnpm dev
```

For a production build:

```bash
pnpm check
pnpm test
pnpm build
pnpm start
```

## Using the Evaluator

Select the spoken language before recording whenever possible. This is especially recommended for English and Marathi because Automatic Detection can correctly transcribe speech while still falling below the confidence threshold required for safe routing.

1. Select **Hindi**, **Kannada**, **English**, **Tamil**, **Marathi**, or **Automatic Detection**.
2. Press and speak, then pause for 0.5 seconds for automatic submission—or use **STOP & SEND NOW**.
3. Review the transcript, routing result, answer status, citations, trace, and latency ledger.
4. Treat a `REFUSED` response as expected whenever source evidence is not sufficient.

The interface also provides a typed-transcript fallback for debugging and evaluator demonstrations. The primary workflow remains real microphone speech.

## Quality and Benchmark Commands

| Command | Purpose |
|---|---|
| `pnpm check` | TypeScript validation. |
| `pnpm test` | Full Vitest, server, utility, and DOM regression suite. |
| `pnpm build` | Production bundle build. |
| `pnpm benchmark:terminal` | 115-case cold/warm internal-RAG audit, including adversarial safety cases. |
| `pnpm benchmark:five-languages` | 1,000-request five-language post-transcription RAG benchmark. |

The five-language benchmark uses 200 requests per focused language, interleaving five source-backed MSMARCO-XI fixture themes per language. It reports per-language outcomes and P50/P70/P90/P95/P100 timings. The accompanying cold/warm audit executes 100 dataset queries and 15 adversarial safety cases in each state.[2]

## Repository Map

```text
client/src/pages/Home.tsx        Evaluator console, microphone workflow, output states
client/src/lib/                 Voice capture, timing, language, and recovery utilities
server/rag/harness.ts           14-stage voice and transcript orchestration
server/rag/sarvam.ts            Protected Sarvam STT adapter
server/rag/retrieval.ts         L1/L2 hybrid retrieval and bounded Qdrant fallback
server/rag/guardrails.ts        Safety, injection, grounding, and refusal policy
server/rag/benchmark.ts         Five-language and cold/warm benchmark runners
server/rag/hotCorpus.ts         In-process multilingual evidence cache
shared/evaluationManifest.ts    Dataset/index/chunk-family manifest
docs/                           Benchmark evidence, validation notes, and question bank
```

## Evidence and Validation Records

The repository keeps its evaluator artifacts in `docs/`. The most relevant starting points are the final hardening record, the five-language benchmark report, and the verified multilingual question bank.

| Record | Description |
|---|---|
| [`docs/final-evaluator-hardening.md`](./docs/final-evaluator-hardening.md) | Final UI, production, benchmark, and regression validation summary. |
| [`docs/benchmark-results/five-language-1000-query-report.md`](./docs/benchmark-results/five-language-1000-query-report.md) | Expanded percentile evidence and per-language benchmark results. |
| [`docs/verified-five-language-question-bank.md`](./docs/verified-five-language-question-bank.md) | Source-backed prompts for repeatable live testing. |
| [`docs/marathi-relevance-repair.md`](./docs/marathi-relevance-repair.md) | Marathi low-confidence and answer-relevance correction record. |

## Cost and Security Posture

SUNO uses a **no-cost evaluation profile** for retrieval: a local hash-based embedding approach, in-process cache, and Qdrant Cloud free-tier configuration. Provider or hosting account usage may still have limits or costs outside this repository’s control.

All provider credentials remain server-side. The browser never receives Sarvam or Qdrant secrets. This repository excludes local credentials and managed project configuration from the export.

## License

This project is released under the **MIT License**. See `package.json` for the declared license metadata.

## References

[1]: [AI4Bharat/MSMARCO-XI dataset](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)

[2]: [Five-language benchmark report](./docs/benchmark-results/five-language-1000-query-report.md)

[3]: [Voice harness implementation](./server/rag/harness.ts)

[4]: [Hybrid retrieval implementation](./server/rag/retrieval.ts)

[5]: [Grounding and guardrail implementation](./server/rag/guardrails.ts)
