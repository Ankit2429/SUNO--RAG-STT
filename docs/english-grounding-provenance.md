# English Grounding Provenance

AI4Bharat’s official **MSMARCO-XI** dataset card states that each translated Indic-language example includes the corresponding **original English content**. This makes the English source passage associated with each indexed query a valid companion evidence record for the same MSMARCO-XI evaluation slice.

For the English grounded-answer route, SvaraProof will retain the existing source query IDs and add only English passages traceable to those source records. The route remains evidence-gated: absence of retrieved English support results in a refusal rather than an invented answer.

## References

[1] [AI4Bharat/MSMARCO-XI dataset card](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)

[2] [Microsoft MS MARCO dataset](https://huggingface.co/datasets/microsoft/ms_marco)
