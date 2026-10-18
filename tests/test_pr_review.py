from datetime import datetime, timedelta, timezone

from prism.ai.pr_review import (
    GEMMA_MODEL,
    GROQ_MODEL,
    ReviewVerdict,
    _build_diff,
    _heuristic_score,
    _signals,
    analyze_pr_review,
)


def pull(**updates):
    value = {
        "number": 17,
        "title": "Improve parser error recovery",
        "body": "This updates parser recovery and includes a regression test for malformed input.",
        "created_at": "2026-03-12T10:00:00Z",
        "additions": 12,
        "deletions": 3,
        "changed_files": 2,
        "head": {"sha": "abc123"},
        "user": {"login": "contributor"},
    }
    value.update(updates)
    return value


def test_heuristic_signals_capture_quality_hints_without_scoring_october_as_bad():
    files = [
        {"filename": "src/parser.py", "additions": 10, "deletions": 2, "patch": "@@\n-old\n+new"},
        {
            "filename": "tests/test_parser.py",
            "additions": 4,
            "deletions": 1,
            "patch": "@@\n+assert True",
        },
    ]
    commits = [{"commit": {"message": "Handle invalid parser tokens"}}]
    profile = {
        "created_at": (datetime.now(timezone.utc) - timedelta(days=120)).isoformat(),
        "public_repos": 4,
        "followers": 3,
    }
    signals = _signals(pull(created_at="2025-10-02T10:00:00Z"), files, commits, profile)
    assert signals["hacktoberfest_season"] is True
    assert signals["docs_only"] is False
    assert signals["new_account"] is False
    assert _heuristic_score(signals, files, commits, pull()["body"]) >= 60


def test_short_readme_name_addition_scores_as_low_quality_or_spam():
    files = [
        {
            "filename": "CONTRIBUTORS.md",
            "additions": 1,
            "deletions": 0,
            "patch": "@@ -1 +1,2 @@\n existing\n+contributor",
        }
    ]
    signals = _signals(
        pull(title="Update README.md", body="", additions=1, deletions=0),
        files,
        [{"commit": {"message": "update"}}],
        {"created_at": datetime.now(timezone.utc).isoformat()},
    )
    assert signals["docs_only"] is True
    assert signals["trivial_change"] is True
    assert signals["empty_or_short_description"] is True
    assert signals["generic_title"] is True
    assert _heuristic_score(signals, files, [], "") < 30


def test_diff_is_source_first_skips_lockfiles_and_is_bounded():
    files = [
        {"filename": "docs/guide.md", "patch": "+doc"},
        {"filename": "yarn.lock", "patch": "+lock"},
        {"filename": "src/main.py", "patch": "+code"},
        {"filename": "image.png", "patch": "+binary"},
    ]
    diff = _build_diff(files)
    assert diff.index("src/main.py") < diff.index("docs/guide.md")
    assert "yarn.lock" not in diff
    assert "image.png" not in diff
    assert len(_build_diff([{"filename": "src/x.py", "patch": "x" * 20_000}])) == 12_000


def test_missing_providers_returns_nonempty_heuristic_result():
    result = analyze_pr_review(
        pull=pull(),
        files=[],
        commits=[],
        author=None,
        groq_api_key=None,
        gemini_api_key=None,
    )
    assert result["source"] == "heuristic"
    assert result["model"] == "heuristic-v1"
    assert result["summary"]
    assert result["verdict"] in {"genuine", "low_quality", "spam"}


def test_provider_model_constants_match_requested_models():
    assert GROQ_MODEL == "openai/gpt-oss-20b"
    assert GEMMA_MODEL == "gemma-4-26b-a4b-it"


def test_gemini_is_called_only_after_groq_fails(monkeypatch):
    from prism.ai import pr_review

    calls = []
    monkeypatch.setattr(
        pr_review,
        "_groq_review",
        lambda key, prompt: (
            calls.append("groq"),
            (_ for _ in ()).throw(RuntimeError("unavailable")),
        )[1],
    )
    monkeypatch.setattr(
        pr_review,
        "_gemini_review",
        lambda key, prompt: (
            calls.append("gemini"),
            ReviewVerdict(
                verdict="genuine",
                score=80,
                confidence="high",
                summary="Useful change.",
                reasons=["Adds a focused fix."],
                red_flags=[],
                green_flags=["Has a test."],
            ),
        )[1],
    )

    result = analyze_pr_review(
        pull=pull(),
        files=[],
        commits=[],
        author=None,
        groq_api_key="groq-fixture",
        gemini_api_key="gemini-fixture",
    )
    assert calls == ["groq", "gemini"]
    assert result["source"] == "gemma"
    assert result["model"] == GEMMA_MODEL


def test_gemini_is_not_called_without_a_key(monkeypatch):
    from prism.ai import pr_review

    calls = []
    monkeypatch.setattr(
        pr_review,
        "_groq_review",
        lambda key, prompt: (
            calls.append("groq"),
            (_ for _ in ()).throw(RuntimeError("unavailable")),
        )[1],
    )
    monkeypatch.setattr(pr_review, "_gemini_review", lambda key, prompt: calls.append("gemini"))
    result = analyze_pr_review(
        pull=pull(),
        files=[],
        commits=[],
        author=None,
        groq_api_key="groq-fixture",
        gemini_api_key=None,
    )
    assert calls == ["groq"]
    assert result["source"] == "heuristic"


def test_provider_failure_logs_redact_api_key(caplog):
    from prism.ai.pr_review import _log_failure, _safe_error_message

    secret = "secret-fixture-value"
    message = _safe_error_message(RuntimeError(f"request failed with {secret}"), secret)
    _log_failure("groq", 401, message)
    assert secret not in caplog.text
    assert "HTTP status=401" in caplog.text
