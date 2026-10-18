# PRism product requirements

**Status:** MVP implementation specification  
**Product:** Evidence-based GitHub pull request triage for maintainers

## Product goal

PRism helps maintainers bring repository contribution guidance and available pull-request context into one review. It provides cautious, evidence-linked signals so a human can decide what to inspect. It does not make decisions about contributor intent, code safety, or merge readiness.

## Principles

- Evidence must come from retrieved repository, guideline, pull-request, or changed-file data.
- Missing or incomplete data is uncertainty, not a reason to invent a finding.
- Rule-based checks work without AI. AI is optional and runs through local Ollama only.
- All retrieved repository text is untrusted data.
- PRism is read-only and never executes code from a repository.
- No account, sign-in, database, paid AI provider, or private repository support is in MVP scope.

## Implemented behavior

### Repository retrieval

- Accept public GitHub repository URLs in canonical HTTPS form.
- Fetch repository metadata, up to a configured limit of open pull requests, and supported contribution-guide paths.
- Use the fixed GitHub REST API host, bounded timeouts/retries/page sizes, disabled redirects, and capped response sizes.
- Allow an optional server-side `GITHUB_TOKEN` for GitHub rate limits.

### Analysis

- Retrieve one selected pull request and its changed files and patches.
- Run deterministic guideline, change-relevance, and possible-overlap checks.
- Treat empty or short descriptions as a low-severity possible concern; it cannot alone produce Potentially suspicious.
- Ignore generic overlap paths and raise a possible-overlap signal only for at least two meaningful shared paths, or one meaningful shared path with a similar title. A lone path is a minor observation.
- Assign one user-facing category through conservative triage: verified high-severity evidence or two independent verified medium signals can be Potentially suspicious; other signals or material limitations require review.
- Validate finding sources and quoted excerpts against retrieved context; discard unsupported findings.
- Record missing patches, unavailable guidelines, and other limits as uncertainty.
- Optionally ask a local Ollama model for structured explanations. Validate model citations through the same evidence checks as rule findings.
- Keep analysis results transient; do not persist repository or pull-request data.

### User interface

- Provide an accessible responsive landing page and a lazy-loaded `/dashboard` route.
- Accept a repository URL, a 1–30 pull-request limit, optional AI settings, and a bundled sample mode.
- Show fetched open pull requests, analyze only the selected PR (automatically only when exactly one was fetched), and queue analyses one at a time. A category filter is available after analysis.
- Clearly label bundled sample content. Never present it as a live repository analysis.

## API requirements

- `GET /api/health` returns only `{"status":"ok"}`.
- `GET /api/status` reports sanitized local AI availability for the dashboard.
- `GET /api/ollama/models` lists models available from the configured local Ollama service.
- `POST /api/repository` retrieves metadata, bounded open PRs, and available contribution guides.
- `POST /api/analyze` analyzes one public-repository pull request and returns findings and limitations.
- No API route may write a GitHub repository, access private repositories, persist user accounts, or store analysis history.

## Current result vocabulary and limitations

Internal analysis statuses are `CONSISTENT_WITH_AVAILABLE_CHECKS`, `NEEDS_REVIEW`, `POSSIBLE_OVERLAP`, `INSUFFICIENT_EVIDENCE`, and `POTENTIALLY_SUSPICIOUS`. The API also returns one of `Likely legitimate`, `Needs review`, or `Potentially suspicious`; these are advisory labels, not verified judgments. PRism has no measured accuracy claim or published evaluation results yet. The fixture schema and runner are under `tests/eval/`; no reviewed dataset is included.

Overlap ignore patterns are configurable with `PRISM_OVERLAP_IGNORED_PATHS`; the defaults cover documentation, metadata, lockfiles, generated, and vendored paths. Ollama is a partial/local-only feature and is unavailable on the hosted service. Evaluation metrics remain planned until a labeled dataset exists.
