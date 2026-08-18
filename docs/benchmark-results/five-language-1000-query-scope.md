# Five-Language 1,000-Query Benchmark Scope

This benchmark measures **post-transcription SvaraProof RAG latency** rather than microphone capture, Sarvam speech-to-text, browser upload, or public-network transfer. It will execute **200 harness requests per focused language**—Hindi (`hi-IN`), Kannada (`kn-IN`), English (`en-IN`), Tamil (`ta-IN`), and Marathi (`mr-IN`)—for **1,000 measured requests** in total.

The benchmark fixtures are sourced from the project’s bounded AI4Bharat/MSMARCO-XI evaluation corpus. The official dataset card describes MSMARCO-XI as translated MS MARCO examples that retain original and translated queries, answers, and passages, and lists Hindi, Kannada, Tamil, and Marathi among its supported languages.[1]

The report will preserve raw per-query records and aggregate **P50, P70, P100, failures, and GROUNDED/REFUSED/ERROR status counts** by language and across all languages. It will evaluate the documented **200 ms internal RAG target** only; it will not represent the separately variable Sarvam STT time as part of that internal target.

## Reference

[1]: https://huggingface.co/datasets/ai4bharat/MSMARCO-XI
