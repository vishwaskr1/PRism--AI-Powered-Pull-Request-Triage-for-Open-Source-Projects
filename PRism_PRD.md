# PRism product requirements

**Status:** Hackathon MVP implementation specification
**Product:** Advisory GitHub pull request review for maintainers

## Product goal

PRism fetches public repository and pull request data, then presents heuristic and optional model-generated quality signals to help maintainers decide what to inspect. It does not verify contributor intent, code safety, or merge readiness.

## Principles

- Repository text and model output are untrusted input.
- Missing data is uncertainty, not evidence of bad intent.
- Provider calls happen only in the backend; keys never reach the browser.
- PRism is read-only, does not execute repository code, and keeps results transient.
- No accounts, private repositories, GitHub write actions, or database persistence.

## Repository retrieval

- Accept canonical public GitHub repository URLs.
- Fetch repository metadata, a bounded set of open PRs, contribution-guide files, PR files/patches, commit messages, and public author metadata.
- Use the fixed GitHub REST API host, optional server-side `GITHUB_TOKEN`, finite timeouts, bounded pagination and response sizes, and disabled redirects.
- Cache GitHub responses in a bounded process-local TTL cache.

## PR quality review

`POST /api/analyze-pr` accepts `{owner, repo, number}` and returns a schema-validated review with `verdict`, `score`, `confidence`, `summary`, `reasons`, `red_flags`, `green_flags`, `heuristic_score`, `signals`, `source`, and `model`.

The backend computes the `docs_only`, `trivial_change`, `whitespace_or_typo_only`, `lockfile_or_config_only`, `adds_name_to_contributors_list`, `empty_or_short_description`, `generic_title`, `new_account`, `no_linked_issue`, `low_quality_commit_messages`, and `hacktoberfest_season` signals. The score ranges from 0–100, where higher values represent a more useful-looking contribution. Calendar timing and account metadata are weak hints only; neither establishes intent.

Diff context prioritizes source-code files, excludes lockfiles and binaries, and is capped at 12,000 characters. Provider calls have a 30-second timeout. Groq `openai/gpt-oss-20b` is primary; if that call fails, Gemma 4 `gemma-4-26b-a4b-it` is tried only when `GEMINI_API_KEY` is configured. The providers are called sequentially. Invalid output is retried once, then PRism returns a nonempty heuristic-only result. Without provider keys, no model request is made.

Results are cached in memory by owner, repository, PR number, and head SHA. This is process-local and bounded; it is not shared across service replicas.

## User interface

- Provide an accessible responsive landing page and lazy-loaded `/dashboard` route.
- Fetch open PRs before review. Analyze a selected PR only; analyze-all runs sequentially with a 2.5-second delay and skips results already held by the page.
- Show loading, friendly per-row errors, verdict, score, summary, model source, and expandable reasons/flags.
- Clearly mark bundled examples as `SAMPLE DATA, not a live analysis`.

## API requirements

- `GET /api/health` returns only `{"status":"ok"}`.
- `GET /api/status` reports whether provider keys are configured; it does not test connectivity or consume tokens.
- `POST /api/repository` retrieves public repository metadata, bounded open PRs, and contribution-guide paths.
- `POST /api/analyze-pr` returns the PR quality review described above.
- `POST /api/analyze` retains the separate legacy evidence-based rule analysis route.
- No route writes to GitHub, accesses private repositories, creates accounts, or persists review history.

## Current limitations

PRism has no measured accuracy claim or published evaluation result. Provider availability, pricing, and quotas depend on the selected provider account. Labels and scores are advisory signals only, not judgments about contributor intent or code safety. The evaluation scaffold uses local fixtures and deterministic checks; it does not contact AI providers.
