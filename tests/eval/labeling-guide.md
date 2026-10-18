# Evaluation fixture and labeling guide

Place one JSON object per file in this directory, following `fixture.schema.json`. Save the reviewed title, description, changed-file names and available patch excerpts, contribution-guideline status/path/text, the GitHub PR URL, and evidence notes. Keep snapshots limited to content that may be redistributed; otherwise omit the patch and record the limitation.

Two reviewers should independently assign one label: Likely legitimate, Needs review, Potentially suspicious, or Insufficient information. Resolve disagreements before changing a label. A high-risk label needs cited, verifiable evidence; do not infer contributor intent. `human_label: null` means the case is not labeled and will not contribute to metrics.

Evaluation uses the checked-in PRism deterministic rules against these local snapshots, so it does not fetch GitHub data. Optional AI evaluation sends fixture PR content only to the configured localhost Ollama service. Never add credentials, private repository contents, or secrets to fixtures.
