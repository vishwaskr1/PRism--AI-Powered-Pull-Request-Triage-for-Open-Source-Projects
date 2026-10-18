# Security and privacy

- Never commit, publish, or include `.env` in an archive. If a credential was shared outside your trusted environment, rotate it with its provider.
- The optional GitHub token is loaded from the backend environment. There is no API for reading or rewriting `.env`.
- Only canonical public `github.com` repository URLs are accepted. The backend constructs requests against the fixed GitHub API host and disables redirects.
- HTTP requests have finite timeouts and bounded retries, pagination, file counts, and response sizes.
- `/api/health` returns only `{"status":"ok"}`. `/api/status` reports whether Groq/Gemini keys are configured without making an inference request or returning service URLs, credentials, or raw exception messages.
- `GROQ_API_KEY` and optional `GEMINI_API_KEY` are server-side only. A configured key enables provider requests for PR reviews; review current pricing and quotas before adding keys.
- Repository descriptions, contribution guides, pull-request text, patches, and model output are untrusted. PRism does not clone repositories, execute code, install dependencies, or write to GitHub.
- Rule and AI findings pass evidence validation. Unsupported citations are dropped, and unavailable context is recorded as uncertainty.
- Analysis results are transient. There are no user accounts or database persistence.
- Production sends CSP, `nosniff`, no-referrer, frame-denial, and restrictive Permissions-Policy headers. CSP allows inline styles for GSAP transforms, while scripts and connections remain same-origin.
- Repository and analysis endpoints have configurable per-IP in-memory rate limits and a request-size limit. The GitHub response cache is bounded, process-local, and short-lived. These do not coordinate across replicas.
- Forwarded client IP headers are ignored unless `PRISM_TRUST_PROXY=1`. Enable that only behind an ingress that overwrites client-supplied forwarding headers.
- Comparison PR checks are capped by `PRISM_MAX_COMPARISON_PRS` (default 10); capped comparisons are shown as a result limitation.

Review hosting logs and configure alerting and appropriate resource limits before a public launch. For multi-replica hosting, move rate-limit state to a shared store or enforce limits at the trusted ingress.
