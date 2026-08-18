# Physical-Microphone Validation — English Explicit-Language Override

**Validation date:** 2026-08-18  
**Evidence source:** User-observed live evaluator runs during final acceptance testing.

The user tested the source-backed English prompt through the real browser microphone. The first run used **Automatic Detection** and correctly failed closed because Sarvam reported only **43%** language-detection confidence—below SUNO’s 80% automatic-routing threshold. The user then selected **English** explicitly and repeated the same spoken prompt. That explicit-language route returned a cited, grounded answer.

| Run | Spoken prompt | Selected route | Detection outcome | Final status | Evidence cited | Internal RAG duration |
|---|---|---|---|---|---:|---:|
| Automatic detection | `What foods are low in potassium?` | Automatic Detection | English at 43% confidence; safely refused below the 80% threshold | `REFUSED` | 0 | Not applicable |
| Explicit override | `What foods are low in potassium?` | `en-IN / English` | Manual locale selection | `GROUNDED` | 1 | 0.19 ms |

> **Conclusion:** English evidence retrieval and grounded answering work through the real microphone when the user selects **English** explicitly. The automatic-detection refusal is intentional fail-closed behavior, not an evidence or answer-generation failure. The successful result used the source-backed English companion evidence that is also covered by the five-language regression and benchmark suite.

For repeatable English acceptance testing, choose **English** in the language selector before recording. The validated prompt appears in the five-language question bank.[^1]

[^1]: [`docs/verified-five-language-question-bank.md`](../verified-five-language-question-bank.md)
