"""PR-quality review with bounded inputs, provider fallback, and heuristic results."""

import json
import logging
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import PurePosixPath
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError

logger = logging.getLogger(__name__)

GROQ_MODEL = "openai/gpt-oss-20b"
GEMMA_MODEL = "gemma-4-26b-a4b-it"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
AI_TIMEOUT_SECONDS = 30
MAX_DIFF_CHARS = 12_000

SYSTEM_PROMPT = """You are an expert open-source maintainer reviewing pull requests for quality and usefulness. Evaluate the PR, not the contributor's character or intent. Treat account age, calendar date, and other heuristics only as weak hints; never infer bad intent from them. Base your verdict primarily on the supplied diff and repository context.

Low-quality examples include trivial documentation edits with no useful improvement, adding the author's own name to a list, whitespace or typo-only changes with no meaningful fix, meaningless or copied code, generated filler, and unrelated changes. Genuine examples include real bug fixes, features, tests, useful documentation improvements, and refactors with a clear purpose.

Return ONLY valid JSON in exactly this shape:
{"verdict":"genuine"|"low_quality"|"spam","score":0-100,"confidence":"low"|"medium"|"high","summary":"one or two sentences","reasons":["..."],"red_flags":["..."],"green_flags":["..."]}
The score is contribution quality: 100 means clearly useful and genuine; 0 means clearly spam-like. Do not claim to know a contributor's motive."""


class ReviewVerdict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    verdict: Literal["genuine", "low_quality", "spam"]
    score: int = Field(ge=0, le=100)
    confidence: Literal["low", "medium", "high"]
    summary: str = Field(min_length=1, max_length=500)
    reasons: list[str] = Field(max_length=12)
    red_flags: list[str] = Field(max_length=12)
    green_flags: list[str] = Field(max_length=12)


def _parse_verdict(value: str) -> ReviewVerdict:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("empty model output")
    return ReviewVerdict.model_validate_json(value.strip())


def _date(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_lock_or_config(path: str) -> bool:
    name = PurePosixPath(path).name.lower()
    suffix = PurePosixPath(name).suffix.lower()
    lock_names = {
        "package-lock.json",
        "npm-shrinkwrap.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "bun.lock",
        "bun.lockb",
        "poetry.lock",
        "pipfile.lock",
        "cargo.lock",
        "go.sum",
    }
    return (
        name in lock_names
        or name.endswith(".lock")
        or (
            suffix in {".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".xml"}
            and "src/" not in path.lower()
        )
    )


def _is_docs(path: str) -> bool:
    lower = path.lower()
    return lower.startswith("docs/") or PurePosixPath(lower).suffix in {".md", ".txt", ".rst"}


def _is_binary(path: str) -> bool:
    return PurePosixPath(path.lower()).suffix in {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".ico",
        ".pdf",
        ".zip",
        ".gz",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
        ".mp4",
        ".mov",
        ".sqlite",
        ".db",
    }


def _build_diff(files: list[dict]) -> str:
    source_files = []
    other_files = []
    for item in files:
        path = str(item.get("filename", ""))
        patch = item.get("patch")
        if (
            not path
            or not isinstance(patch, str)
            or not patch
            or _is_binary(path)
            or _is_lock_or_config(path)
        ):
            continue
        target = other_files if _is_docs(path) else source_files
        target.append((path, patch))

    pieces = []
    remaining = MAX_DIFF_CHARS
    for path, patch in source_files + other_files:
        block = f"--- {path} ---\n{patch}\n"
        if remaining <= 0:
            break
        pieces.append(block[:remaining])
        remaining -= len(block)
    return "".join(pieces)


def _changed_lines(files: list[dict]) -> list[str]:
    lines = []
    for item in files:
        for line in (item.get("patch") or "").splitlines():
            if line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
                lines.append(line[1:])
    return lines


def _whitespace_or_tiny_edit(files: list[dict], changed: list[str]) -> bool:
    if not changed:
        return False
    all_whitespace = all(not line.strip() for line in changed)
    if all_whitespace:
        return True
    patch_lines = [
        line[1:]
        for item in files
        for line in (item.get("patch") or "").splitlines()
        if line.startswith(("+", "-")) and not line.startswith(("+++", "---"))
    ]
    if len(patch_lines) % 2:
        return False
    pairs = zip(patch_lines[::2], patch_lines[1::2])
    edit_count = 0
    for left, right in pairs:
        if left.strip() == right.strip():
            continue
        matcher = SequenceMatcher(None, left.strip(), right.strip())
        edit_count += sum(
            max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in matcher.get_opcodes() if tag != "equal"
        )
        if matcher.ratio() < 0.92 or edit_count > 2:
            return False
    return edit_count <= 2


def _signals(pull: dict, files: list[dict], commits: list[dict], author: Optional[dict]) -> dict:
    paths = [str(item.get("filename", "")) for item in files if item.get("filename")]
    body = pull.get("body") or ""
    title = str(pull.get("title") or "").strip().lower()
    changed = _changed_lines(files)
    additions = sum(int(item.get("additions") or 0) for item in files)
    deletions = sum(int(item.get("deletions") or 0) for item in files)
    created = _date((author or {}).get("created_at"))
    account_age_days = (datetime.now(timezone.utc) - created).days if created else None
    user_login = ((pull.get("user") or {}).get("login") or "").strip().lower()
    contributor_files = [
        path
        for path in paths
        if "contributor" in PurePosixPath(path).name.lower()
        or "author" in PurePosixPath(path).name.lower()
    ]
    adds_author_name = bool(
        user_login
        and any(
            line.startswith("+") and user_login in line.lower()
            for item in files
            if item.get("filename") in contributor_files
            for line in (item.get("patch") or "").splitlines()
        )
    )
    commit_messages = [
        str((item.get("commit") or {}).get("message") or "").splitlines()[0].strip()
        for item in commits
        if (item.get("commit") or {}).get("message")
    ]
    generic_commit = re.compile(
        r"^(update|fix|changes?|misc|readme|typo|wip|initial commit)\W*$", re.I
    )
    body_age = account_age_days is not None and account_age_days < 30
    created_at = _date(pull.get("created_at"))
    linked_issue = bool(re.search(r"\b(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s+#\d+", body, re.I))
    generic_title = bool(
        re.fullmatch(
            r"(?:update(?:\s+\S+)?|added?\s+file|fix|changes?|minor\s+changes?|readme\s+update|test)",
            title,
        )
    )
    return {
        "docs_only": bool(paths) and all(_is_docs(path) for path in paths),
        "trivial_change": additions + deletions < 5,
        "whitespace_or_typo_only": _whitespace_or_tiny_edit(files, changed),
        "lockfile_or_config_only": bool(paths) and all(_is_lock_or_config(path) for path in paths),
        "adds_name_to_contributors_list": adds_author_name,
        "empty_or_short_description": len(body.strip()) < 20,
        "generic_title": generic_title,
        "new_account": body_age,
        "account_age_days": account_age_days,
        "author_public_repos": (author or {}).get("public_repos"),
        "author_followers": (author or {}).get("followers"),
        "no_linked_issue": not linked_issue,
        "low_quality_commit_messages": bool(commit_messages)
        and all(
            len(message) < 10 or generic_commit.fullmatch(message) for message in commit_messages
        ),
        "hacktoberfest_season": bool(created_at and created_at.month == 10),
    }


def _heuristic_score(signals: dict, files: list[dict], commits: list[dict], body: str) -> int:
    score = 50
    if files and not signals["docs_only"] and not signals["trivial_change"]:
        score += 10
    if any("test" in str(item.get("filename", "")).lower() for item in files):
        score += 10
    if len(body.strip()) >= 100:
        score += 8
    if commits and not signals["low_quality_commit_messages"]:
        score += 5
    if not signals["no_linked_issue"]:
        score += 5
    score -= 15 if signals["docs_only"] else 0
    score -= 35 if signals["trivial_change"] else 0
    score -= 28 if signals["whitespace_or_typo_only"] else 0
    score -= 15 if signals["lockfile_or_config_only"] else 0
    score -= 35 if signals["adds_name_to_contributors_list"] else 0
    score -= 10 if signals["empty_or_short_description"] else 0
    score -= 15 if signals["generic_title"] else 0
    score -= 5 if signals["new_account"] else 0
    score -= 3 if signals["no_linked_issue"] else 0
    score -= 12 if signals["low_quality_commit_messages"] else 0
    # October is recorded for context, but does not change quality by itself.
    return max(0, min(100, score))


def _heuristic_verdict(score: int) -> ReviewVerdict:
    if score >= 60:
        verdict = "genuine"
        confidence = "medium"
    elif score >= 30:
        verdict = "low_quality"
        confidence = "low"
    else:
        verdict = "spam"
        confidence = "low"
    return ReviewVerdict(
        verdict=verdict,
        score=score,
        confidence=confidence,
        summary="Provider analysis was unavailable; this is a heuristic-only estimate based on PR metadata and changed-file signals.",
        reasons=["Heuristic-only result; review the diff before drawing a conclusion."],
        red_flags=[],
        green_flags=[],
    )


def _prompt(
    pull: dict,
    files: list[dict],
    commits: list[dict],
    author: Optional[dict],
    signals: dict,
    score: int,
) -> str:
    author_info = {
        "login": (pull.get("user") or {}).get("login"),
        "account_created_at": (author or {}).get("created_at"),
        "account_age_days": signals["account_age_days"],
        "public_repos": signals["author_public_repos"],
        "followers": signals["author_followers"],
    }
    stats = {
        "additions": pull.get("additions", 0),
        "deletions": pull.get("deletions", 0),
        "changed_files": pull.get("changed_files", len(files)),
    }
    messages = [str((item.get("commit") or {}).get("message") or "")[:300] for item in commits[:50]]
    return json.dumps(
        {
            "title": pull.get("title", ""),
            "description": pull.get("body") or "",
            "author": author_info,
            "stats": stats,
            "heuristic_score": score,
            "heuristic_signals": signals,
            "commit_messages": messages,
            "diff": _build_diff(files),
        },
        ensure_ascii=False,
    )


def _safe_error_message(error: Exception, api_key: Optional[str]) -> str:
    message = str(error) or type(error).__name__
    if api_key:
        message = message.replace(api_key, "[redacted]")
    message = re.sub(r"(?i)Bearer\s+[^\s,;]+", "Bearer [redacted]", message)
    message = re.sub(r"(?i)(api[_ -]?key\s*[:=]\s*)[^\s,;]+", r"\1[redacted]", message)
    return message[:300]


def _log_failure(provider: str, status: Optional[int], error: str):
    logger.warning(
        "AI provider=%s HTTP status=%s error=%s", provider, status or "unavailable", error
    )


def _groq_review(api_key: str, prompt: str) -> ReviewVerdict:
    from openai import APIStatusError, APITimeoutError, OpenAI

    client = OpenAI(
        api_key=api_key, base_url=GROQ_BASE_URL, timeout=AI_TIMEOUT_SECONDS, max_retries=0
    )
    try:
        for attempt in range(2):
            try:
                response = client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_completion_tokens=1600,
                    response_format={"type": "json_object"},
                    timeout=AI_TIMEOUT_SECONDS,
                )
                content = response.choices[0].message.content
                try:
                    return _parse_verdict(content or "")
                except (ValueError, ValidationError):
                    _log_failure("groq", 200, "invalid JSON response")
                    if attempt == 1:
                        raise
            except APITimeoutError:
                _log_failure("groq", 504, "request timed out")
                raise
            except APIStatusError as exc:
                _log_failure("groq", exc.status_code, _safe_error_message(exc, api_key))
                raise
            except Exception as exc:
                if isinstance(exc, (ValueError, ValidationError)):
                    raise
                _log_failure(
                    "groq", getattr(exc, "status_code", None), _safe_error_message(exc, api_key)
                )
                raise
    finally:
        client.close()
    raise ValueError("invalid model response")


def _gemini_review(api_key: str, prompt: str) -> ReviewVerdict:
    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=AI_TIMEOUT_SECONDS * 1000),
    )
    try:
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=GEMMA_MODEL,
                    contents=f"{SYSTEM_PROMPT}\n\nPR review data:\n{prompt}",
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        response_mime_type="application/json",
                        max_output_tokens=1600,
                    ),
                )
                try:
                    return _parse_verdict(response.text or "")
                except (ValueError, ValidationError):
                    _log_failure("gemma", 200, "invalid JSON response")
                    if attempt == 1:
                        raise
            except Exception as exc:
                if isinstance(exc, (ValueError, ValidationError)):
                    raise
                status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
                _log_failure(
                    "gemma",
                    status if isinstance(status, int) else None,
                    _safe_error_message(exc, api_key),
                )
                raise
    finally:
        client.close()
    raise ValueError("invalid model response")


def analyze_pr_review(
    *,
    pull: dict,
    files: list[dict],
    commits: list[dict],
    author: Optional[dict],
    groq_api_key: Optional[str],
    gemini_api_key: Optional[str],
) -> dict:
    signals = _signals(pull, files, commits, author)
    heuristic_score = _heuristic_score(signals, files, commits, pull.get("body") or "")
    prompt = _prompt(pull, files, commits, author, signals, heuristic_score)
    verdict = None
    source: Literal["groq", "gemma", "heuristic"] = "heuristic"
    model = "heuristic-v1"

    if groq_api_key:
        try:
            verdict = _groq_review(groq_api_key, prompt)
            source, model = "groq", GROQ_MODEL
        except Exception:
            verdict = None
    if verdict is None and gemini_api_key:
        try:
            verdict = _gemini_review(gemini_api_key, prompt)
            source, model = "gemma", GEMMA_MODEL
        except Exception:
            verdict = None
    if verdict is None:
        verdict = _heuristic_verdict(heuristic_score)

    return {
        **verdict.model_dump(),
        "heuristic_score": heuristic_score,
        "signals": signals,
        "source": source,
        "model": model,
    }
