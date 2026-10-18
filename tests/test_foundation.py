from prism.analysis.evidence_builder import validate_finding
from prism.analysis.guideline_checks import check_guidelines
from prism.analysis.orchestrator import analyze_pull_request
from prism.config import Settings
from prism.exceptions import AIProviderUnavailable, InvalidRepositoryURL
from prism.github.client import parse_repository_url
from prism.models import (
    ChangedFile,
    ContributionGuidelines,
    EvidenceReference,
    Finding,
    PullRequest,
    ReviewStatus,
)
from prism.services.analysis_service import AnalysisService


def pull(number=1, files=None, title="Update parser"):
    return PullRequest(
        number=number,
        title=title,
        html_url="https://github.com/a/b/pull/%s" % number,
        changed_files=files or [],
    )


def test_defaults_work_without_optional_services():
    assert Settings().github_token is None
    assert Settings().groq_api_key is None
    assert Settings().gemini_api_key is None


def test_provider_keys_are_optional_and_invalid_limits_are_rejected():
    assert Settings(groq_api_key="groq_example").groq_api_key == "groq_example"
    for values in ({"request_timeout_seconds": 0}, {"max_pull_requests": 0}):
        try:
            Settings(**values)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid settings should fail validation")


def test_public_repository_url_validation():
    assert parse_repository_url("https://github.com/owner/project") == ("owner", "project")
    for url in (
        "http://github.com/a/b",
        "https://evil.test/a/b",
        "https://github.com/a/b/pull/1",
        "https://github.com@evil.test/a/b",
    ):
        try:
            parse_repository_url(url)
        except InvalidRepositoryURL:
            pass
        else:
            raise AssertionError("URL should have been rejected: " + url)


def test_missing_changed_files_is_insufficient():
    result = analyze_pull_request(pull())
    assert result.status == ReviewStatus.INSUFFICIENT_EVIDENCE


def test_change_check_evidence_is_real_retrieved_path():
    result = analyze_pull_request(
        pull(files=[ChangedFile(filename="src/auth.py", status="modified")])
    )
    finding = result.findings[0]
    assert finding.evidence[0].source == "title"
    assert any(ref.source == "src/auth.py" for ref in finding.evidence)


def test_overlap_has_explicit_pr_evidence():
    first = pull(
        files=[
            ChangedFile(filename="src/parser.py", status="modified"),
            ChangedFile(filename="src/lexer.py", status="modified"),
        ]
    )
    second = pull(
        2,
        [
            ChangedFile(filename="src/parser.py", status="modified"),
            ChangedFile(filename="src/lexer.py", status="modified"),
        ],
        "Improve parser",
    )
    result = analyze_pull_request(first, other_pull_requests=[second])
    assert result.status == ReviewStatus.POSSIBLE_OVERLAP
    overlap = next(f for f in result.findings if f.category == "overlap")
    assert {e.source for e in overlap.evidence} >= {"1", "2", "src/parser.py"}


def test_overlap_ignores_generic_paths_and_requires_two_files_or_similar_title():
    from prism.analysis.overlap_detection import detect_overlaps

    def changed(path):
        return ChangedFile(filename=path, status="modified", patch="@@ -1 +1 @@\n-a\n+b")

    target = pull(
        files=[
            changed("src/a.py"),
            changed("src/b.py"),
            changed("README.md"),
            changed(".github/workflows/ci.yml"),
        ],
        title="Add parser cache",
    )
    one_file = pull(2, [changed("src/a.py")], "Unrelated dashboard text")
    generic_only = pull(
        3, [changed("README.md"), changed(".github/workflows/ci.yml")], "Add parser cache"
    )
    two_files = pull(4, [changed("src/a.py"), changed("src/b.py")], "Unrelated work")

    findings = detect_overlaps(target, [one_file, generic_only, two_files])
    assert [finding.category for finding in findings] == ["overlap_minor", "overlap"]
    assert findings[0].severity == "minor"
    assert findings[1].title == "Possible overlap with PR #4"


def test_one_shared_file_with_similar_title_is_a_review_lead():
    from prism.analysis.overlap_detection import detect_overlaps

    target = pull(
        files=[ChangedFile(filename="src/parser.py", status="modified")], title="Add parser cache"
    )
    similar = pull(
        2, [ChangedFile(filename="src/parser.py", status="modified")], "Add parser cache support"
    )
    findings = detect_overlaps(target, [similar])
    assert len(findings) == 1
    assert findings[0].category == "overlap"


def test_minor_single_file_overlap_does_not_change_category_or_finding_total():
    from prism.analysis.overlap_detection import detect_overlaps

    target = pull(
        files=[ChangedFile(filename="src/parser.py", status="modified")], title="Add parser cache"
    )
    other = pull(
        2, [ChangedFile(filename="src/parser.py", status="modified")], "Unrelated dashboard work"
    )
    result = analyze_pull_request(target, other_pull_requests=[other])
    assert all(finding.category != "overlap" for finding in result.findings)
    assert any(finding.category == "overlap_minor" for finding in result.findings)
    # The conservative detector's minor metadata-only observation is not triaged as a signal.
    from prism.analysis.triage import triage_category

    minor = detect_overlaps(target, [other])[0]
    category, _, reason = triage_category([minor], [], target.changed_files)
    assert category == "Likely legitimate"
    assert reason is None


def test_guideline_check_quotes_real_instruction_without_asserting_violation():
    guidelines = [
        ContributionGuidelines(
            path="CONTRIBUTING.md",
            content="All changes must include tests.",
            url="https://github.com/a/b/blob/main/CONTRIBUTING.md",
        )
    ]
    findings = check_guidelines(
        guidelines, pull(files=[ChangedFile(filename="src/parser.py", status="modified")])
    )
    assert findings[0].status == "NEEDS_REVIEW"
    assert findings[0].evidence[0].excerpt == "All changes must include tests."


def test_evidence_validator_discards_unknown_sources():
    finding = Finding(
        category="test",
        title="Unsupported",
        explanation="Claim",
        status="NEEDS_REVIEW",
        confidence=0.2,
        evidence=[EvidenceReference(source_type="changed_file", source="invented.py")],
    )
    assert validate_finding(finding, pull()) is None


def test_evidence_validator_requires_cited_excerpt_to_exist_in_retrieved_source():
    guide = ContributionGuidelines(
        path="CONTRIBUTING.md",
        content="All changes should include tests.",
        url="https://github.com/a/b/blob/main/CONTRIBUTING.md",
    )
    supported = Finding(
        category="guideline",
        title="Supported",
        explanation="Claim",
        status="NEEDS_REVIEW",
        confidence=0.5,
        evidence=[
            EvidenceReference(
                source_type="guideline",
                source="CONTRIBUTING.md",
                excerpt="All changes should include tests.",
            )
        ],
    )
    fabricated = supported.model_copy(deep=True)
    fabricated.evidence[0].excerpt = "The project requires a security audit."

    assert validate_finding(supported, pull(), [guide]) is not None
    assert validate_finding(fabricated, pull(), [guide]) is None


def test_ai_failure_keeps_rule_analysis_and_adds_a_limitation():
    class FixtureGitHubClient:
        def pull_request(self, owner, repo, number):
            return pull(number, [ChangedFile(filename="src/parser.py", status="modified")])

        def changed_files(self, owner, repo, number):
            return [ChangedFile(filename="src/parser.py", status="modified")], False

    class UnavailableAI:
        def analyze_pr(self, pull_request, guidelines):
            raise AIProviderUnavailable("hosted fixture unavailable")

    result = AnalysisService(FixtureGitHubClient(), UnavailableAI()).analyze(
        "a", "b", pull(), [pull()], [], ai_enabled=True
    )
    assert result.summary.ai_enabled is False
    assert result.summary.limitations
    assert "hosted provider" in result.summary.limitations[-1]
