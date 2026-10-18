# Architecture

PRism has a React/Vite client and a FastAPI service. The landing page links to the lazily loaded `/dashboard` route. The Vite development server proxies `/api` requests to FastAPI.

```text
Dashboard → FastAPI routes → repository/analysis services → GitHub REST API
                                      ├── deterministic checks
                                      └── optional Groq → Gemini fallback
                                              ↓
                                 evidence validation → dashboard
```

Repository input is normalized to an owner and repository name by the GitHub client. Requests are made only to the fixed `api.github.com` host, with bounded timeouts, retries, pagination, and response sizes. The repository service fetches metadata, a bounded set of open pull requests, and known contribution-guide files.

The legacy advisory analysis service retrieves pull-request details and changed-file patches, runs guideline, relevance, and overlap checks, and validates findings before returning them. The dashboard's PR quality endpoint retrieves PR metadata, files, commits, and a public author profile, then uses bounded heuristic signals and optional Groq/Gemini model output. Missing or failed providers fall back to heuristic-only output.

The dashboard fetches a bounded open-PR list and analyzes one selected row at a time. It automatically analyzes only when the repository has exactly one open PR. Results are transient and are not saved. There are no accounts or database. Sample mode uses bundled fixtures and is labelled as sample content.

Overlap detection ignores configurable generic paths (`PRISM_OVERLAP_IGNORED_PATHS`). It promotes two or more shared meaningful files, or one shared meaningful file plus a similar title. A lone shared file is a minor observation excluded from category and finding totals. Grouped results display at most five related PR rows while preserving the complete count.

## Runtime boundaries

- GitHub access is read-only and limited to public repositories.
- Repository files, descriptions, PR text, patches, and model output are untrusted data.
- No repository code is cloned or executed.
- Hosted PR quality review is optional. `GROQ_API_KEY` and `GEMINI_API_KEY` remain server-side. `/api/status` reports key configuration without calling providers.
- `/api/health` returns only `{"status":"ok"}`; deterministic checks remain available when hosted AI is disabled or unavailable.

## Production deployment

The multi-stage Docker image builds the Vite client and runs one FastAPI service that serves API routes and the static single-page app. Unmatched non-API GET paths return the built `index.html` for client-side routing; unknown API paths remain JSON 404s. Production docs and reload are off unless `PRISM_DEV=1`. The process applies security headers, request-size limits, in-memory per-IP rate limits, and a bounded process-local GitHub response cache. These in-memory controls are not shared across replicas.
