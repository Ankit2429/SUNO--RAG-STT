# Terminal-Style Benchmark Reference Notes

The user-provided benchmark screenshot uses a concise dark-terminal readout. Its reusable presentation structure is: an initial one-line latency verdict, a command-and-warm-up line, a query count, a fixed-width stage table, and a closing budget/pass verdict.

| Reference element | SvaraProof adaptation |
|---|---|
| `Ran 50 queries` | Display actual completed sample count from the 115-case benchmark. |
| `stage / avg / p50 / p95 / p99 (ms)` | Display audited SvaraProof stages with actual P50, P70, and P100 values, matching the project rubric. |
| `Latency budget: 50.0ms` | Display the actual 200 ms post-transcription internal RAG budget. |
| `PASS: within budget` | Render only from live benchmark output: zero failures and P100 at or below 200 ms. |

The terminal display must distinguish the internal RAG budget from external Sarvam STT time, and must not hard-code sample measurements.
