from prism.analysis.change_relevance import check_description
from prism.analysis.orchestrator import analyze_pull_request
from prism.analysis.triage import triage_category
from prism.config import Settings
from prism.exceptions import GitHubAPIError, GitHubNotFound
from prism.github.client import GitHubClient
from prism.models import ChangedFile, EvidenceReference, Finding, PullRequest


def make_pull(body=None, files=None):
    return PullRequest(
        number=1,
        title="Improve parser behavior",
        body=body,
        html_url="https://github.com/example/project/pull/1",
        changed_files=files
        or [ChangedFile(filename="src/parser.py", status="modified", patch="@@ -1 +1 @@\n-x\n+y")],
    )


def make_finding(category, severity, title=None, source="src/parser.py"):
    return Finding(
        category=category,
        severity=severity,
        title=title or category,
        explanation="Evidence-backed test finding.",
        status="NEEDS_REVIEW",
        confidence=0.7,
        evidence=[EvidenceReference(source_type="changed_file", source=source)],
    )


def test_missing_or_short_description_is_low_severity_possible_concern():
    assert check_description(make_pull(None), minimum_characters=20)[0].severity == "low"
    assert (
        check_description(make_pull("  short context  "), minimum_characters=20)[0].severity
        == "low"
    )
    assert (
        check_description(make_pull("A sufficiently detailed description."), minimum_characters=20)
        == []
    )

    result = analyze_pull_request(make_pull(None), guidelines=[])
    description = next(item for item in result.findings if item.category == "description")
    assert "possible concern" in description.title.lower()
    assert description.evidence[0].source_type == "pull_request"
    assert description.evidence[0].source == "body"
    assert description.severity == "low"
    assert result.category == "Needs review"
    assert result.category != "Potentially suspicious"


def test_ollama_timeout_is_configurable_and_separate_from_github_timeout():
    settings = Settings()
    assert settings.ollama_timeout_seconds == 60
    assert settings.request_timeout_seconds == 15
    assert (
        Settings(ollama_timeout_seconds=12, request_timeout_seconds=4).ollama_timeout_seconds == 12
    )


def test_guideline_retrieval_reports_explicit_state():
    client = object.__new__(GitHubClient)

    def use_response(path, params=None):
        if path.endswith("CONTRIBUTING.md"):
            return {
                "type": "file",
                "encoding": "base64",
                "content": "Q29udHJpYnV0aW5nIGd1aWRl",
                "html_url": "https://github.com/example/project/blob/main/CONTRIBUTING.md",
            }
        raise GitHubNotFound("missing")

    client._get = use_response
    guides, status = client.guidelines_with_status("example", "project", "main")
    assert status == "found"
    assert guides[0].path == "CONTRIBUTING.md"

    client._get = lambda path, params=None: (_ for _ in ()).throw(GitHubNotFound("missing"))
    assert client.guidelines_with_status("example", "project", "main")[1] == "not_found"

    client._get = lambda path, params=None: (_ for _ in ()).throw(GitHubAPIError("unavailable"))
    assert client.guidelines_with_status("example", "project", "main")[1] == "retrieval_failed"


def test_category_is_likely_legitimate_only_without_findings_or_limitations():
    files = make_pull().changed_files
    assert triage_category([], [], files)[0] == "Likely legitimate"
    assert (
        triage_category([], ["No contribution guidance was retrieved."], files)[0] == "Needs review"
    )


def test_high_severity_requires_verified_evidence_and_available_diffs():
    files = make_pull().changed_files
    high = make_finding("security", "high")
    assert triage_category([high], [], files)[0] == "Potentially suspicious"

    high_without_evidence = high.model_copy(update={"evidence": []})
    assert triage_category([high_without_evidence], [], files)[0] == "Needs review"
    assert (
        triage_category(
            [high], ["Changed-file data was not retrieved; analysis is insufficient."], []
        )[0]
        == "Needs review"
    )

    unavailable = [files[0].model_copy(update={"patch_available": False})]
    assert triage_category([high], [], unavailable)[0] == "Needs review"


def test_two_independent_medium_findings_are_required_for_suspicious_category():
    files = make_pull().changed_files
    first = make_finding("guideline", "medium", "Guideline check")
    second = make_finding("changed_paths", "medium", "Path check")
    assert triage_category([first], [], files)[0] == "Needs review"
    assert triage_category([first, second], [], files)[0] == "Potentially suspicious"
    assert triage_category([first, first.model_copy(deep=True)], [], files)[0] == "Needs review"


def test_overlap_reason_is_a_separate_category_field():
    overlap = make_finding("overlap", "low")
    category, _, reason = triage_category([overlap], [], make_pull().changed_files)
    assert category == "Needs review"
    assert reason == "possible overlap"


def test_needs_review_reasons_cover_unavailable_context():
    files = make_pull().changed_files
    assert triage_category([], ["analysis is insufficient"], files)[2] == "insufficient evidence"
    unavailable = [files[0].model_copy(update={"patch_available": False})]
    assert triage_category([], [], unavailable)[2] == "diff unavailable"
    assert (
        triage_category(
            [],
            ["No supported contribution guidance file was available."],
            files,
            guideline_status="not_found",
        )[2]
        == "guidelines unavailable"
    )
    assert (
        triage_category([], [], files, guideline_status="retrieval_failed")[2]
        == "guidelines unavailable"
    )


def test_suspicious_category_has_a_reason_and_legitimate_category_does_not():
    files = make_pull().changed_files
    high = make_finding("security", "high")
    assert triage_category([high], [], files)[2] == "verified high-severity evidence"
    assert triage_category([], [], files)[2] is None
