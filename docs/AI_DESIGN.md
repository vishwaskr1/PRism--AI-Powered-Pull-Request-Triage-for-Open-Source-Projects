# PR quality review providers

The dashboard sends one pull request at a time to `POST /api/analyze-pr`. All GitHub retrieval and model calls happen in the FastAPI backend; the browser never receives provider credentials.

The backend computes conservative metadata and diff signals, then builds a bounded prompt. It prioritizes source patches, caps submitted diff text at 12,000 characters, and excludes lock/config-only and binary files. A model result must match a strict JSON schema. PR content is treated as untrusted input, and the model is asked to assess contribution quality rather than infer a contributor's intent.

When `GROQ_API_KEY` is configured, PRism calls Groq's `openai/gpt-oss-20b` model first using the OpenAI-compatible API and JSON response mode. If that call fails, PRism tries `gemma-4-26b-a4b-it` through Google's Gemini API only when `GEMINI_API_KEY` is configured. The calls are sequential, never concurrent. A provider timeout or invalid response falls back to a heuristic-only result. The default provider timeout is 30 seconds.

Set `GROQ_API_KEY` and optionally `GEMINI_API_KEY` only as backend secrets. Provider pricing, quotas, and availability vary by account and can change; review the provider console before enabling calls. With both keys empty, PRism does not contact an AI provider and reports `source: heuristic`.

`GET /api/status` reports whether keys are configured. It makes no inference request and cannot guarantee provider reachability or available quota. The local evaluation scaffold is deterministic and does not contact AI providers.
