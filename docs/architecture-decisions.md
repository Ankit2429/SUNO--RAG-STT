# Architecture Decisions

## Zero-cost runtime profile

The deployed submission uses Qdrant Cloud’s free tier as the vector database profile. The verified free plan is a single-node cluster with 0.5 vCPU, 1 GB RAM, and 4 GB disk, and Qdrant documents selected hosted inference models as free. This application therefore limits the default `evaluation` index to a language-balanced, reproducible subset and reserves the same schema for an `expanded` or `full` index built outside the request path.

Qdrant Cloud Inference is the preferred zero-cost embedding path because it accepts text as a document-model input while keeping embedding generation alongside the managed collection. The selected deployment profile must use a free hosted model, record its model ID and vector dimensionality in the ingestion manifest, and reject startup if the collection configuration does not match that manifest. Qdrant’s public documentation describes a free hosted model with 384 output dimensions and a 256-token context window; the implementation must obtain the active model configuration from the connected cluster rather than hard-code an unsupported assumption.

Sarvam is used only from server code through its short-audio `POST /speech-to-text` endpoint with the `api-subscription-key` header. The browser never receives this credential. A deliberately malformed, zero-length audio request is used for non-billable credential validation; a valid key returns a validation error rather than Sarvam’s documented invalid-key `403` response.

## Source data profile

AI4Bharat/MSMARCO-XI provides translated MS MARCO examples across fourteen Indic languages. Its validation parquet files are approximately 419–494 MB per language and the full dataset is roughly 55.6 GB, so the website cannot ethically claim request-time ingestion or a browser-bundled full corpus. The ingestion process must stream files, emit a manifest, and make the active data profile explicit in both UI and API responses.

Each example has translated query and answer text, source and target language metadata, a stable query ID, query type, and English/translated passage arrays with relevance flags. The application preserves these fields, derives five chunk families per parent record, and never indexes answer text as retrievable content for unrelated queries.

The Hugging Face dataset-service parquet endpoint confirms that the validation split is published as fourteen separate parquet artifacts, each approximately 419–494 MB. Its generated `default` configuration lists these files only by ordinal, so a rigorous full-corpus run must map ordinal to language from the source repository’s validation file listing and stream each artifact one at a time. The active `evaluation` profile purposefully limits the initial index and exposes this limit in the manifest; the source-reproducible ingestion tool accepts an explicit language list and can be rerun as an offline build for a wider profile.

Sources: `https://huggingface.co/datasets/ai4bharat/MSMARCO-XI`, `https://datasets-server.huggingface.co/parquet?dataset=ai4bharat%2FMSMARCO-XI`, `https://qdrant.tech/pricing/`, and `https://qdrant.tech/documentation/inference/cloud-inference/`.

The generated validation artifacts do support HTTP byte ranges, confirmed with a `206` response from `https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/refs%2Fconvert%2Fparquet/default/validation/0003.parquet`. However, this dataset’s very large parquet row groups make a lightweight row-service request unreliable: `https://datasets-server.huggingface.co/rows?dataset=ai4bharat%2FMSMARCO-XI&config=default&split=validation&offset=0&length=2` currently returns a documented service-side row-group conversion error. The index builder must therefore remain an offline, bounded process and must not pretend the full 55.6 GB source has been embedded from the deployed request path.

Sarvam’s documented synchronous transcription endpoint is `POST https://api.sarvam.ai/speech-to-text` with an `api-subscription-key` header and multipart fields `file`, `model=saaras:v3`, `mode=transcribe`, and `language_code=unknown`. The API accepts WebM and returns `transcript`, `language_code`, and a provider `request_id`; its synchronous route is for audio no longer than 30 seconds. The implementation therefore rejects oversized or long clips before any upstream call, sends an application idempotency key through its own request ledger, and retries only transport, `429`, and `503` failures with bounded exponential backoff. Source: `https://docs.sarvam.ai/api-reference/speech-to-text/transcribe`.

## Latency profile

Observed Qdrant Cloud round trips from the deployment region were approximately 1.6–2.2 seconds. Consequently, the runtime uses a transparent two-tier retrieval profile: a compact in-process L1 cache of 25 real paragraph-level passages from the reproducible Hindi, Tamil, Telugu, Bengali, and Marathi evaluation artifact, followed by Qdrant Cloud L2 fallback for cache misses. Both levels use the same server-only Unicode-aware dense representation and lexical scoring; Qdrant retains the full five-strategy chunk index. The index-status API and evaluator console identify this L1/L2 profile explicitly rather than presenting local cache timing as remote-vector performance.

The benchmark contains 115 post-transcription cases: 100 language-balanced cases from the genuine five-language evaluation query artifact and 15 adversarial cases. The benchmark reports first-pass (“cold”) and repeated (“warm”) process-local results separately; neither result claims control over provider-side caches.
