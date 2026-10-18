# PRism

PRism helps open-source maintainers review public GitHub pull requests with repository guidance, deterministic checks, changed-file context, and traceable evidence. Results are recommendations for human review, not judgments about contributor intent or code safety. PRism never changes a repository.

## Current scope

- React and Vite landing page plus a `/dashboard` route.
- FastAPI backend retrieves public repository metadata, open pull requests, and supported contribution guides.
- Deterministic checks can flag guideline mismatches, change relevance, and possible overlap.
- Overlap signals ignore configurable generic paths; one shared meaningful file is minor unless titles are similar. Two shared meaningful files are a review lead, not proof of duplicate work.
- Optional AI explanations use a local Ollama service. Rule-based checks work when AI is off or unavailable. AI defaults to off.
- Sample mode displays bundled example content with a persistent sample-data label.
- The dashboard lists the fetched open pull requests and analyzes only the selected PR (or automatically analyzes the only PR when exactly one is open).
- Analyses run one at a time; the optional category filter only includes rows with completed analysis.

No accounts, sign-in, database, paid AI service, private-repository access, code execution, or GitHub write operations are part of this MVP. Analysis accuracy has not yet been measured. Deployment comparison checks use at most 10 other open pull requests by default; a visible limitation is included if that cap is reached.

## Requirements

- Python 3.9 or newer
- Node.js 20.19+ or 22.12+
- Optional: a GitHub personal access token for higher API rate limits
- Optional: Ollama and a downloaded local model for AI explanations

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
npm install
cp .env.example .env
```

Keep `.env` private. If you already have one, edit it in place instead of replacing it. The backend reads the variables documented in `.env.example`. `PRISM_DEV=1` enables API docs and reload for local use; leave it off in production.

## Run locally

Start each process in a separate terminal:

```bash
# Terminal 1: API (set PRISM_DEV=1 in .env to enable reload and API docs)
.venv/bin/python -m prism.server

# Terminal 2: web app (Vite proxies /api to port 8000)
npm run dev -- --host 127.0.0.1
```

Open the Vite URL printed in the terminal. The API liveness endpoint is `http://127.0.0.1:8000/api/health`; sanitized dependency status is at `/api/status`.

For local AI, start Ollama and set `OLLAMA_MODEL` to a model installed on your machine. AI is optional and off by default.
`OLLAMA_TIMEOUT_SECONDS` controls inference time independently of GitHub's `REQUEST_TIMEOUT_SECONDS` (default 60 seconds). `MIN_DESCRIPTION_CHARS` sets the short-description signal threshold (default 20 characters).
`PRISM_OVERLAP_IGNORED_PATHS` can replace the default comma-separated file patterns excluded from overlap detection.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Minimal liveness response: `{"status":"ok"}` |
| `GET` | `/api/status` | Sanitized status and local AI availability for the dashboard |
| `GET` | `/api/ollama/models` | List local Ollama models |
| `POST` | `/api/repository` | Retrieve a public repository and a bounded list of open PRs |
| `POST` | `/api/analyze` | Analyze one open PR with deterministic checks and optional Ollama |

The browser validates the repository URL and the backend independently accepts only canonical `https://github.com/{owner}/{repo}` URLs. GitHub requests use a fixed API host, bounded timeouts and pagination, disabled redirects, and response-size limits.

## Deploy as one web service

The multi-stage Docker build compiles the Vite app and packages its `dist/` directory with FastAPI. FastAPI serves both the API and the React single-page app, including direct navigation and refreshes on `/dashboard`. `render.yaml` defines a single Render Docker web service; it does not start a separate frontend service. Configure `GITHUB_TOKEN` as a secret in the host dashboard, never in this repository.

For a local container smoke test:

```bash
docker build -t prism .
docker run --rm -p 8000:8000 prism
curl -i http://localhost:8000/
curl -i http://localhost:8000/dashboard
curl -i http://localhost:8000/api/health
```

The server applies CSP and browser security headers, a 1 MB default request limit, and an in-memory limit of 20 repository/analysis requests per IP per 10 minutes. These controls and the bounded GitHub response cache are per process; use a shared gateway/store for multiple workers or replicas. Proxy headers are ignored unless `PRISM_TRUST_PROXY=1`; enable that only behind a trusted proxy that overwrites incoming forwarding headers. For same-origin hosting, `PRISM_ALLOWED_ORIGINS` can be empty. Set it to explicit origins only when the browser app is hosted separately.

Render free instances may sleep when idle. Local Ollama is not included in the container; the dashboard detects that and leaves AI disabled with a rule-based-only notice. Configure an Ollama endpoint only when the deployment can reach a trusted local Ollama service.

## Development checks

```bash
.venv/bin/pytest
.venv/bin/ruff check .
.venv/bin/ruff format --check .
npm ci
npm run typecheck
npm run build
docker build -t prism:check .
```

## Project layout

```text
src/
├── LandingPage.tsx             # Landing page
├── dashboard/                  # Dashboard shell and API adapter
├── landing/                    # Shared content, effects, and landing sections
└── prism/
    ├── server.py               # FastAPI routes
    ├── sample_data.py          # Bundled sample fixtures
    ├── github/                  # Bounded GitHub REST client
    ├── analysis/                # Deterministic rules and evidence validation
    ├── ai/                      # Optional local Ollama integration
    └── services/                # Repository and analysis orchestration
```

## Safety and limitations

- PRism is advisory. Maintainers make all decisions.
- Repository content and model output are treated as untrusted input; repository code is never executed.
- Missing source context is represented as uncertainty. Findings without validated evidence are dropped.
- An optional `GITHUB_TOKEN` is read from the backend environment and is never changed through an API endpoint.
- Ollama is restricted to localhost. No PR content is sent to a paid or third-party model provider by this code.
- The default rate limit and cache are in-memory and per process; they do not coordinate across replicas.
- Comparison checks cover at most `PRISM_MAX_COMPARISON_PRS` other open pull requests (default 10); results state when that cap is reached.
- CSP allows inline styles because GSAP writes animation transforms at runtime; scripts remain same-origin only.

## Project documents

- [Product requirements document](PRism_PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [API integration](docs/API_INTEGRATION.md)
- [Local AI design](docs/AI_DESIGN.md)
- [MVP scope](docs/MVP_SCOPE.md)
- [Evaluation plan](docs/EVALUATION.md)

## Release assets

- Social preview: `public/social-preview.png`.
- A browser screenshot and recorded demo are pending; no browser automation runtime or labeled evaluation set is currently included. Do not present an illustrative image as a product screenshot.
- Evaluation status: **Not yet run**. See [evaluation instructions](docs/EVALUATION.md); no accuracy claim is published.

## License

MIT. See [LICENSE](LICENSE).
