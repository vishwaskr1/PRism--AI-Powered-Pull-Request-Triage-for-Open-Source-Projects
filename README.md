<p align="center">
  <img src="docs/assets/banner.svg" alt="PRism — See every contribution clearly." width="100%" />
</p>

<h1 align="center">PRism</h1>
<p align="center"><strong>AI-Powered Pull Request Triage for Open-Source Projects</strong></p>
<p align="center"><em>“Evidence for review. Decisions stay with maintainers.”</em></p>

<p align="center">
  <a href="https://github.com/vishwaskr1/PRism--AI-Powered-Pull-Request-Triage-for-Open-Source-Projects/actions/workflows/ci.yml"><img src="https://github.com/vishwaskr1/PRism--AI-Powered-Pull-Request-Triage-for-Open-Source-Projects/actions/workflows/ci.yml/badge.svg?branch=feat/full-project" alt="CI status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-6f63d9.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB.svg" alt="Python 3.9 or newer" />
  <img src="https://img.shields.io/badge/Node.js-20.19%2B%20%7C%2022.12%2B-339933.svg" alt="Node.js 20.19 or 22.12 and newer" />
  <img src="https://img.shields.io/badge/React-19-61DAFB.svg" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg" alt="FastAPI 0.110 or newer" />
  <img src="https://img.shields.io/badge/TypeScript-5.7%2B-3178C6.svg" alt="TypeScript 5.7 or newer" />
</p>

> [!WARNING]
> **PRism is advisory only. Labels are recommendations, not verified judgments about contributor intent or code safety. Maintainers make every decision.**

<p align="center">
  PRism brings public pull requests, repository guidance, deterministic checks, and evidence-linked review signals into one read-only workspace.
</p>

Accounts, database persistence, private-repository access, GitHub write actions, and code execution are outside the current MVP scope. Hosted AI is optional and explicitly disabled unless an operator configures it.

## 📑 Table of Contents

- [Why PRism?](#why-prism)
- [Key Features](#key-features)
  - [Triage Dashboard](#triage-dashboard)
  - [Evidence and Uncertainty](#evidence-and-uncertainty)
  - [Deterministic Checks](#deterministic-checks)
  - [Optional Hosted AI](#optional-hosted-ai)
  - [Sample Mode](#sample-mode)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Evidence and Triage](#evidence-and-triage)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Testing and Quality](#testing-and-quality)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Evaluation Status](#evaluation-status)
- [Contributing](#contributing)
- [Project Documents](#project-documents)
- [License](#license)

<a id="why-prism"></a>
## 🧭 Why PRism?

| Review challenge | PRism's current approach |
| --- | --- |
| Open pull requests can pile up without repository context. | Fetches a bounded list of public open PRs and lets a maintainer analyze one PR at a time. |
| Contribution guidance can be hard to find during review. | Retrieves supported contribution-guide files and links guideline findings to their source. |
| Automated claims are difficult to verify. | Findings are validated against retrieved metadata, guideline text, or changed-file data before they are returned. |
| Review tools can overstate what they know. | PRism is read-only, shows uncertainty, and leaves decisions to maintainers. |

<a id="key-features"></a>
## ✨ Key Features

<a id="triage-dashboard"></a>
### 🗂️ Triage Dashboard

- Fetch public repository metadata, contribution guidance, and a configurable list of open pull requests.
- Analyze the selected PR; if exactly one open PR is fetched, PRism selects it automatically. Analyses are queued one at a time.
- Show one of three advisory categories: **Likely legitimate**, **Needs review**, or **Potentially suspicious**.
- The category filter applies after a row has an analysis result.

<a id="evidence-and-uncertainty"></a>
### 🔎 Evidence and Uncertainty

- Expand a finding to inspect its evidence source, location, and any returned excerpt.
- Open the analyzed pull request's files on GitHub.
- Show unavailable context, capped comparisons, missing patches, and other limitations as uncertainty.
- Findings without evidence that validates against retrieved context are discarded.

<a id="deterministic-checks"></a>
### 📏 Deterministic Checks

Current rule checks include:

- A contribution-guide check that can flag test-related guidance when changed paths do not look like test files. This is a review prompt, not proof that a test is required.
- A title/description-to-path lexical heuristic. It is shown as a minor observation and does not affect the category or primary finding count.
- Possible overlap based on meaningful shared changed paths and a similar-title heuristic. Generic paths such as documentation, lockfiles, generated files, and vendor paths are ignored by default.
- A missing or short description signal. It is low severity, worded as a possible concern, and **cannot make a PR Potentially suspicious by itself**.

| Rule findings | AI findings |
| --- | --- |
| Produced by deterministic checks over retrieved repository, pull-request, guideline, and changed-file data. | Optional PR-quality review from Groq, with a Gemini Gemma fallback when configured. |
| Do not require an AI service. Evidence is checked against the retrieved source. | Must return schema-valid JSON. Treat the model result as advisory and verify it against the PR yourself. |
| Continue to work when AI is off or unavailable. | May fail, be unavailable, or have its unsupported output discarded. |

<a id="optional-hosted-ai"></a>
### 🧠 Optional Hosted AI

PR quality review uses Groq `openai/gpt-oss-20b` as its primary provider. If Groq fails, PRism tries Gemma 4 `gemma-4-26b-a4b-it` through Gemini only when `GEMINI_API_KEY` is configured. Provider calls are server-side, sequential, limited to 30 seconds, and receive bounded PR metadata and source-first diff text (up to 12,000 characters). Model output must match a strict JSON schema. If no key is configured or both providers fail, PRism returns a heuristic-only result.

Provider usage may incur charges and quotas vary by account. Check the provider consoles before adding credentials. An absent key means no call to that provider; `/api/status` checks configuration only and does not test connectivity or quota.

<a id="sample-mode"></a>
### 🧪 Sample Mode

Use bundled example content to explore the interface without fetching a live repository. Sample results are marked **SAMPLE DATA, not a live analysis**. They do not represent live repository data or measured product performance.

<a id="architecture"></a>
## 🏗️ Architecture

~~~mermaid
flowchart LR
    UI["React + Vite UI"] -->|same-origin API requests| API["FastAPI"]
    API --> REPO["Repository service"]
    REPO -->|read-only REST| GH["GitHub REST API"]
    REPO --> GUIDE["Supported guideline retrieval"]
    API --> ANALYSIS["Analysis service"]
    GUIDE --> RULES["Deterministic checks"]
    ANALYSIS --> RULES
    ANALYSIS -. primary .-> GROQ["Groq: gpt-oss-20b"]
    GROQ -. on failure, if configured .-> GEMINI["Gemini API: Gemma 4"]
    GROQ -. unavailable .-> HEURISTIC["Heuristic fallback"]
    GEMINI -. unavailable .-> HEURISTIC
    RULES --> VALIDATE["Evidence validation"]
    GROQ -. schema-validated response .-> VALIDATE
    GEMINI -. schema-validated response .-> VALIDATE
    VALIDATE --> TRIAGE["Category and uncertainty"]
    TRIAGE --> UI
~~~

The GitHub client constructs requests against the fixed <code>api.github.com</code> host, follows no redirects, bounds timeouts, pagination, and response sizes, and keeps a bounded process-local response cache. The backend does not clone repositories, execute repository code, or write to GitHub. The dashboard uses bundled sample data for sample mode; live repository data is fetched only when requested.

<a id="tech-stack"></a>
## 🧰 Tech Stack

| Layer | Technologies in the project manifests |
| --- | --- |
| Frontend | React 19, React DOM 19, TypeScript 5.7+, Vite 8, GSAP, Three.js |
| Backend | Python 3.9+, FastAPI, Uvicorn, HTTPX, Pydantic, python-dotenv |
| Quality and delivery | pytest, Ruff, Vitest, Testing Library, TypeScript |
| Optional AI | OpenAI SDK for Groq and Google Gen AI SDK for Gemini fallback |

<a id="getting-started"></a>
## 🚀 Getting Started

### Prerequisites

| Requirement | Version | Check |
| --- | --- | --- |
| Python | 3.9 or newer | <code>python3 --version</code> |
| Node.js | 20.19+ or 22.12+ | <code>node --version</code> |
| Git | Installed | <code>git --version</code> |
| Docker (optional) | Docker Engine | <code>docker --version</code> |
| Groq API key (optional hosted AI) | Server-side Groq API key | Configure only when enabling hosted review |
| Gemini API key (optional fallback) | Server-side Google Gemini API key | Optional; called only if Groq fails |

### Fast Setup with Docker

From the project root:

~~~sh
docker build -t prism .
docker run --rm --name prism -p 8000:8000 prism
~~~

Open <code>http://localhost:8000/</code> or <code>http://localhost:8000/dashboard</code>. Stop the container with Ctrl+C. Docker builds the Vite frontend and packages it with FastAPI as one web service.

### Manual Installation

1. Clone the repository and enter its directory:

~~~sh
git clone https://github.com/vishwaskr1/PRism--AI-Powered-Pull-Request-Triage-for-Open-Source-Projects.git
cd PRism--AI-Powered-Pull-Request-Triage-for-Open-Source-Projects
~~~

2. Create and activate a virtual environment, then install the backend:

<details>
<summary>macOS and Linux</summary>

~~~sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
~~~

</details>

<details>
<summary>Windows PowerShell</summary>

~~~powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
~~~

</details>

3. Install frontend dependencies and create the local environment file:

~~~sh
npm ci
cp .env.example .env
~~~

On Windows PowerShell, use <code>Copy-Item .env.example .env</code> instead of <code>cp</code>. Keep <code>.env</code> private; never commit it. Edit it in place if it already exists. <code>PRISM_DEV=1</code> enables local API documentation and reload; its default is off.

4. Start the API in one terminal:

~~~sh
.venv/bin/python -m prism.server
~~~

On Windows PowerShell, run <code>..venvScriptspython.exe -m prism.server</code> instead. The API listens on port 8000 by default.

5. Start the Vite development server in a second terminal:

~~~sh
npm run dev -- --host 127.0.0.1
~~~

Open the URL printed by Vite. The development server proxies <code>/api</code> calls to FastAPI. In the dashboard, enable **Sample mode** to explore bundled example data. For live repository fetches, use a public GitHub repository URL. To shut down, press Ctrl+C in both terminals.

<a id="project-structure"></a>
## 🗃️ Project Structure

~~~text
.
├── .dockerignore                     # Docker build exclusions
├── .env.example                      # Environment variable template
├── .github/workflows/ci.yml          # CI checks and secret scan
├── .gitignore                        # Local/generated-file exclusions
├── .python-version                  # Python toolchain version hint
├── CONTRIBUTING.md                   # Contributor guidance
├── Dockerfile                        # Single-service multi-stage build
├── LICENSE                           # MIT license
├── Makefile                          # Common local commands
├── PRism_PRD.md                      # Product requirements
├── README.md                         # Project guide
├── docs/
│   ├── AI_DESIGN.md                  # Hosted AI design and boundaries
│   ├── API_INTEGRATION.md            # GitHub API integration
│   ├── ARCHITECTURE.md               # System design
│   ├── EVALUATION.md                 # Evaluation protocol and status
│   ├── MVP_SCOPE.md                  # Current scope and limits
│   ├── SECURITY.md                   # Security notes
│   └── assets/
│       └── banner.svg                # README banner artwork
├── index.html                        # Vite HTML entry document
├── package.json                      # Frontend scripts and dependencies
├── package-lock.json                 # Locked npm dependency tree
├── pyproject.toml                    # Python package and tool configuration
├── public/
│   ├── favicon.svg                   # Browser icon
│   └── social-preview.png            # Social-sharing artwork, not a screenshot
├── render.yaml                       # Render single-service blueprint
├── tsconfig.json                     # TypeScript compiler settings
├── vite.config.ts                    # Vite development and build settings
├── src/
│   ├── LandingPage.tsx               # Landing-page composition
│   ├── index.css                     # Global styles
│   ├── landing.css                   # Landing-page styles
│   ├── router.tsx                    # Client-side routes
│   ├── main.tsx                      # React entry point
│   ├── vite-env.d.ts                 # Vite environment typing
│   ├── dashboard/
│   │   ├── DashboardPage.tsx         # Dashboard page and repository flow
│   │   ├── PRReviewPanel.tsx         # PR quality result and expandable flags
│   │   ├── ResultsPanel.tsx          # Evidence-backed result display
│   │   ├── api.ts                    # Dashboard API adapter and types
│   │   ├── dashboard.css             # Dashboard styles
│   │   └── results.ts                # Finding grouping and summaries
│   ├── landing/
│   │   ├── Brand.tsx                 # Shared brand mark
│   │   ├── DashboardLink.tsx         # Dashboard navigation
│   │   ├── PrismScene.tsx            # Lazy-loaded Three.js hero scene
│   │   ├── content.ts                # Landing-page copy and sample display data
│   │   ├── landing-motion.css        # Motion and reduced-motion styles
│   │   ├── motionConfig.ts           # Motion flags and settings
│   │   ├── useLandingMotion.ts       # GSAP animation hook
│   │   └── sections/
│   │       ├── FailureSection.tsx    # Failure and fallback explanation
│   │       ├── FaqSection.tsx        # Frequently asked questions
│   │       ├── LocalSection.tsx      # Local setup information
│   │       ├── SectionHeading.tsx    # Shared section heading
│   │       ├── TrialSection.tsx      # Sample analysis and repository input
│   │       ├── TrustSection.tsx      # Evidence and trust explanation
│   │       └── TriageSection.tsx     # Category information
│   └── prism/
│       ├── __init__.py               # Backend package
│       ├── config.py                 # Environment settings
│       ├── exceptions.py             # Safe domain errors
│       ├── logging_config.py         # Logging setup
│       ├── sample_data.py            # Bundled sample fixtures
│       ├── server.py                 # FastAPI routes and static SPA fallback
│       ├── ai/
│       │   ├── __init__.py           # AI provider package
│       │   ├── base.py               # Provider interface
│       │   ├── pr_review.py          # Heuristic and hosted PR quality review
│       │   ├── prompts.py            # Structured legacy analysis prompt
│       │   └── schemas.py            # Validated AI output schema
│       ├── analysis/
│       │   ├── __init__.py           # Analysis package
│       │   ├── change_relevance.py   # Description and path heuristics
│       │   ├── evidence_builder.py   # Source-reference validation
│       │   ├── guideline_checks.py   # Contribution-guide checks
│       │   ├── orchestrator.py       # Deterministic analysis orchestration
│       │   ├── overlap_detection.py  # Shared-path overlap checks
│       │   └── triage.py             # Category assignment
│       ├── github/
│       │   ├── __init__.py           # GitHub client exports
│       │   └── client.py             # Bounded GitHub REST client
│       ├── models/
│       │   ├── __init__.py           # Domain model exports
│       │   ├── analysis.py           # Analysis response models
│       │   ├── evidence.py           # Evidence reference model
│       │   ├── finding.py            # Finding model
│       │   ├── pull_request.py       # Pull request and changed-file models
│       │   └── repository.py         # Repository and guideline models
│       └── services/
│           ├── __init__.py           # Service package
│           ├── analysis_service.py   # Pull-request analysis service
│           └── repository_service.py # Repository retrieval service
└── tests/
    ├── dashboard_results.test.tsx   # Dashboard grouping and interaction tests
    ├── eval/
    │   ├── fixture.schema.json      # Evaluation fixture schema
    │   ├── labeling-guide.md        # Human-labeling instructions
    │   └── run_evaluation.py        # Evaluation runner
    ├── integration/
    │   └── test_analysis_pipeline.py # Pipeline integration tests
    ├── test_dashboard_triage.py      # Category and analysis tests
    ├── test_evaluation_scaffold.py   # Evaluation runner tests
    ├── test_foundation.py            # Core rule and model tests
    ├── test_github_client.py         # GitHub API client tests
    └── test_server.py                # API and deployment behavior tests
~~~

<a id="api-reference"></a>
## 🔌 API Reference

Production serves the frontend and API from the same FastAPI process. The API accepts these routes:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | <code>/api/health</code> | Minimal liveness response: <code>{"status":"ok"}</code> |
| GET | <code>/api/status</code> | Sanitized status; reports AI configuration without making an inference request |
| POST | <code>/api/repository</code> | Fetch public repository metadata, open PRs, and supported guides |
| POST | <code>/api/analyze</code> | Legacy evidence-based rule analysis for one open PR |
| POST | <code>/api/analyze-pr</code> | PR-quality review using heuristics and optional hosted model fallback |

<code>POST /api/repository</code> accepts <code>url</code> and optional <code>pr_limit</code> (1–30, default 10). <code>POST /api/analyze</code> accepts <code>url</code>, <code>pull_number</code>, optional <code>pr_limit</code>, and keeps the legacy evidence-based checks heuristic-only. <code>POST /api/analyze-pr</code> accepts <code>owner</code>, <code>repo</code>, and <code>number</code>. Repository URL <code>sample</code> selects bundled example data and does not call GitHub.

~~~sh
curl -sS http://localhost:8000/api/health
~~~

~~~sh
curl -sS -X POST http://localhost:8000/api/repository \
  -H 'Content-Type: application/json' \
  -d '{"url":"sample","pr_limit":10}'
~~~

~~~sh
curl -sS -X POST http://localhost:8000/api/analyze-pr \
  -H 'Content-Type: application/json' \
  -d '{"owner":"pallets","repo":"flask","number":1}'
~~~

The FastAPI interactive docs are available at <code>/api/docs</code> only when <code>PRISM_DEV=1</code>.

<a id="evidence-and-triage"></a>
## 🧾 Evidence and Triage

~~~mermaid
flowchart LR
    CLAIM["Rule or AI claim"] --> SOURCE["Compare with retrieved source"]
    SOURCE -->|valid reference and excerpt| SHOW["Return with evidence"]
    SOURCE -->|missing or unsupported evidence| DROP["Discard finding"]
    SHOW --> UNCERTAINTY["Keep missing context visible as uncertainty"]
~~~

Every returned rule or AI finding must retain a source reference validated against retrieved pull-request metadata, guideline text, or changed-file patch data. PRism does not treat missing evidence as proof.

The API returns one user-facing category:

| Category | Assignment summary |
| --- | --- |
| **Likely legitimate** | No primary findings and no material limitations. This is not an approval or safety judgment. |
| **Needs review** | Other findings, insufficient evidence, unavailable diffs, or material limitations require human review. |
| **Potentially suspicious** | At least one high-severity finding with evidence, or two independent medium-severity evidence-backed findings, when context is sufficient. |

A missing or short description is low severity and cannot produce **Potentially suspicious** by itself. A shared path or similar title is only a review lead, not proof of duplicate intent or work.

<a id="environment-variables"></a>
## ⚙️ Environment Variables

Values below match <code>.env.example</code>. Empty optional values use application defaults where applicable. Set local values in <code>.env</code>; never commit this file.

| Variable | Purpose | Example/default |
| --- | --- | --- |
| <code>GITHUB_TOKEN</code> | Optional server-side token for higher GitHub API limits. | Unset |
| <code>GROQ_API_KEY</code> | Server-side key for primary Groq review provider. | Empty; heuristic-only results |
| <code>GEMINI_API_KEY</code> | Server-side key for Gemma 4 fallback, used only if Groq fails. | Empty; fallback disabled |
| Provider timeout | Hosted model call timeout, independent of GitHub timeout. | 30 seconds |
| <code>MIN_DESCRIPTION_CHARS</code> | Character threshold for the low-severity short-description signal. | <code>20</code> |
| <code>REQUEST_TIMEOUT_SECONDS</code> | GitHub request timeout. | <code>15</code> |
| <code>MAX_PULL_REQUESTS</code> | Maximum open PRs fetched by the backend. | <code>30</code> |
| <code>MAX_CHANGED_FILES</code> | Maximum changed files retrieved per PR. | <code>100</code> |
| <code>LOG_LEVEL</code> | Application log level. | <code>INFO</code> |
| <code>HOST</code> | FastAPI bind address. | <code>0.0.0.0</code> |
| <code>PORT</code> | FastAPI port; the Vite proxy expects the API on port 8000 by default. | <code>8000</code> |
| <code>PRISM_DEV</code> | Enables API docs and development reload. | <code>0</code> |
| <code>PRISM_DIST_DIR</code> | Built frontend directory served by FastAPI. | <code>dist</code> |
| <code>PRISM_ALLOWED_ORIGINS</code> | Allowed CORS origins; empty disables cross-origin access. | Local Vite origins on ports 5173, 5174, and 8443 |
| <code>PRISM_TRUST_PROXY</code> | Trust the first <code>X-Forwarded-For</code> address for per-IP limits. Enable only behind a trusted proxy. | <code>0</code> |
| <code>PRISM_RATE_LIMIT_REQUESTS</code> | Requests allowed per IP on repository and analysis endpoints. | <code>20</code> |
| <code>PRISM_RATE_LIMIT_WINDOW_SECONDS</code> | Rate-limit window in seconds. | <code>600</code> |
| <code>PRISM_MAX_REQUEST_BYTES</code> | Maximum accepted API request body size. | <code>1000000</code> |
| <code>PRISM_MAX_COMPARISON_PRS</code> | Other open PRs compared during overlap analysis. | <code>10</code> |
| <code>PRISM_OVERLAP_IGNORED_PATHS</code> | Optional comma-separated path patterns replacing built-in generic-path exclusions. | Empty; built-in patterns |
| <code>PRISM_GITHUB_CACHE_TTL_SECONDS</code> | Lifetime of process-local GitHub responses. | <code>300</code> |
| <code>PRISM_GITHUB_CACHE_MAX_ITEMS</code> | Maximum process-local cached response entries. | <code>256</code> |
| <code>VITE_DASHBOARD_URL</code> | Optional external dashboard URL embedded at frontend build time. | Empty; use <code>/dashboard</code> |

<code>.env</code> is git-ignored and must never be committed. <code>.env.example</code> contains placeholders only, not usable credentials.

### Configure hosted review locally or on Render

1. Create a Groq API key and add it to `GROQ_API_KEY` in your ignored local `.env` or as a host-managed secret.
2. Optionally configure `GEMINI_API_KEY` for the Gemma 4 fallback. It is called only after Groq fails; PRism does not call both providers concurrently.
3. Check current provider pricing, quota, and data-use policies before enabling either key. Never place keys in frontend variables, source files, logs, or chat.
4. Restart the local backend or redeploy after changing server environment values. With no keys, analysis remains heuristic-only. `/api/status` reports key presence but does not call a provider.

<a id="deployment"></a>
## ☁️ Deployment

<code>Dockerfile</code> builds the React/Vite app and serves the static bundle with FastAPI in one web service. <code>render.yaml</code> describes a Render Docker web service using the free plan, with <code>GITHUB_TOKEN</code> configured as a host-managed secret. No deployment URL is configured in this repository.

The service applies security headers, a 1 MB default request-body limit, and a default limit of 20 repository and analysis requests per IP per 10 minutes. GitHub responses are cached in a bounded, five-minute, process-local cache by default. Rate limits and cache entries are not shared across workers or replicas. <code>PRISM_TRUST_PROXY</code> defaults to off; trust forwarding headers only when a trusted proxy replaces incoming values.

The Render free plan can spin down an idle web service after 15 minutes without inbound traffic; waking a spun-down service may take about a minute. See [Render's free web-service limits](https://render.com/docs/free).

The Render blueprint declares `GITHUB_TOKEN`, `GROQ_API_KEY`, and `GEMINI_API_KEY` as host-managed secrets. Add provider keys only after reviewing current costs and quotas. Without them, the service reports heuristic-only review.

<a id="testing-and-quality"></a>
## 🧪 Testing and Quality

Run the backend checks from the repository root:

~~~sh
.venv/bin/pytest
.venv/bin/ruff check .
.venv/bin/ruff format --check .
~~~

Run the frontend checks:

~~~sh
npm ci
npm run typecheck
npm run test:ui
npm run build
~~~

Build the production container with:

~~~sh
docker build -t prism:check .
~~~

CI runs Ruff lint and format checks, pytest, TypeScript checking, UI tests, the Vite production build, Docker build, and a Gitleaks scan. Local results depend on which commands you run; the CI badge above reports the workflow status.

<a id="troubleshooting"></a>
## 🛠️ Troubleshooting

<details>
<summary>Port 8000 is already in use</summary>

Another process is using the default API port. Stop that process or choose another API port with <code>PORT</code>. If you change the API port while using Vite, also update the <code>/api</code> proxy target in <code>vite.config.ts</code>, which defaults to <code>http://127.0.0.1:8000</code>.

</details>

<details>
<summary>Hosted AI is unavailable</summary>

Check whether `GROQ_API_KEY` and optionally `GEMINI_API_KEY` are configured as backend secrets. `/api/status` reports presence only. Provider timeouts, outages, invalid output, and rate limits fall back to heuristic results. Check provider quotas and billing; never share keys in logs or screenshots.

</details>

<details>
<summary>GitHub reports a rate limit</summary>

Unauthenticated GitHub API requests have lower limits. Set a personal access token in the backend's <code>GITHUB_TOKEN</code> environment variable or <code>.env</code>, then restart the API. Keep the token private and read-only.

</details>

<details>
<summary>A direct /dashboard visit returns 404</summary>

The FastAPI static fallback serves <code>/dashboard</code> when a production frontend bundle exists. Run <code>npm run build</code> before starting FastAPI for a built deployment. During development, run the Vite server with FastAPI and use the Vite URL.

</details>

<details>
<summary>Node.js is too old for the frontend toolchain</summary>

Check <code>node --version</code>. Use Node.js 20.19 or newer in the 20.x line, or 22.12 or newer in the 22.x line. Then reinstall dependencies with <code>npm ci</code>.

</details>

<a id="roadmap"></a>
## 🗺️ Roadmap

- [x] Public repository retrieval and read-only GitHub access.
- [x] Deterministic checks, evidence validation, and advisory categories.
- [x] Dashboard with one-at-a-time analysis and visible uncertainty.
- [x] Bundled sample mode marked as sample data.
- [ ] Measured evaluation results on a reviewed labeled set.
- [ ] Pull request template support.
- [ ] Further category-filter improvements.
- [ ] Shared rate limiting for multi-worker or multi-replica deployment.
- [ ] Deployed public demo.

<a id="evaluation-status"></a>
## 📊 Evaluation Status

**Not yet run.** PRism has no measured accuracy, precision, recall, or other evaluation result. The repository includes an evaluation schema and runner, but no reviewed labeled dataset. See the [evaluation plan](docs/EVALUATION.md).

<a id="contributing"></a>
## 🤝 Contributing

1. Fork this repository.
2. Create a focused branch: <code>git switch -c feat/your-change</code>.
3. Make the change and add or update tests.
4. Run the relevant checks from [Testing and Quality](#testing-and-quality).
5. Commit and push your branch, then open a pull request against the repository's default branch.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting. Do not include <code>.env</code>, credentials, or repository-provided executable content.

<a id="project-documents"></a>
## 📚 Project Documents

- [Product requirements](PRism_PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security and privacy](docs/SECURITY.md)
- [GitHub API integration](docs/API_INTEGRATION.md)
- [Hosted AI design](docs/AI_DESIGN.md)
- [MVP scope](docs/MVP_SCOPE.md)
- [Evaluation plan](docs/EVALUATION.md)
- [README banner artwork](docs/assets/banner.svg)
- [Contribution guidance](CONTRIBUTING.md)

<a id="license"></a>
## 📄 License

PRism is released under the MIT License. See [LICENSE](LICENSE).

<p align="center"><strong>Built for maintainers.</strong></p>

<p align="center">A live URL, browser screenshot, and demo recording are pending. No author block is included.</p>
