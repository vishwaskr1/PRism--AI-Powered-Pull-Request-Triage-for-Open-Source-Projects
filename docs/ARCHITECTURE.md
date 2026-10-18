# Architecture

PRism has a React/Vite client and a FastAPI service. The landing page links to the lazily loaded `/dashboard` route. The Vite development server proxies `/api` requests to FastAPI.

```text
Dashboard → FastAPI routes → repository/analysis services → GitHub REST API
                                      ├── deterministic checks
                                      └── optional local Ollama
                                              ↓
                                 evidence validation → dashboard
```

Repository input is normalized to an owner and repository name by the GitHub client. Requests are made only to the fixed `api.github.com` host, with bounded timeouts, retries, pagination, and response sizes. The repository service fetches metadata, a bounded set of open pull requests, and known contribution-guide files.

The analysis service retrieves pull-request details and changed-file patches, runs guideline, relevance, and overlap checks, and validates each finding before returning it. Optional Ollama findings go through the same evidence validator as rule findings. Missing evidence is reported as uncertainty instead of being presented as a completed claim.

The dashboard fetches a bounded open-PR list and analyzes one selected row at a time. It automatically analyzes only when the repository has exactly one open PR. Results are transient and are not saved. There are no accounts or database. Sample mode uses bundled fixtures and is labelled as sample content.

Overlap detection ignores configurable generic paths (`PRISM_OVERLAP_IGNORED_PATHS`). It promotes two or more shared meaningful files, or one shared meaningful file plus a similar title. A lone shared file is a minor observation excluded from category and finding totals. Grouped results display at most five related PR rows while preserving the complete count.

## Runtime boundaries

- GitHub access is read-only and limited to public repositories.
- Repository files, descriptions, PR text, patches, and model output are untrusted data.
- No repository code is cloned or executed.
- Ollama connections are restricted to localhost; AI is optional.
- `/api/health` returns only `{"status":"ok"}`; `/api/status` reports sanitized local AI availability.

## Production deployment

The multi-stage Docker image builds the Vite client and runs one FastAPI service that serves API routes and the static single-page app. Unmatched non-API GET paths return the built `index.html` for client-side routing; unknown API paths remain JSON 404s. Production docs and reload are off unless `PRISM_DEV=1`. The process applies security headers, request-size limits, in-memory per-IP rate limits, and a bounded process-local GitHub response cache. These in-memory controls are not shared across replicas.
