"""Combines deterministic checks into a cautious triage result."""

from datetime import datetime, timezone

from prism.models import AnalysisResult, AnalysisSummary

from .change_relevance import check_change_relevance, check_description
from .evidence_builder import validate_finding
from .guideline_checks import check_guidelines
from .overlap_detection import detect_overlaps
from .triage import triage_category


def analyze_pull_request(
    pull_request, guidelines=(), other_pull_requests=(), ai_enabled=False, extra_limitations=()
):
    raw = (
        check_guidelines(guidelines, pull_request)
        + check_change_relevance(pull_request)
        + check_description(pull_request)
        + detect_overlaps(pull_request, other_pull_requests)
    )
    findings = [
        f
        for item in raw
        if (f := validate_finding(item, pull_request, guidelines, other_pull_requests)) is not None
    ]
    limitations = list(extra_limitations)
    if not pull_request.changed_files:
        limitations.append("Changed-file data was not retrieved; analysis is insufficient.")
    elif pull_request.files_truncated:
        limitations.append("Changed-file list was truncated at the configured safety limit.")
    if any(not f.patch_available for f in pull_request.changed_files):
        limitations.append(
            "One or more files did not include patch data in the GitHub API response."
        )
    if not guidelines:
        limitations.append("No supported contribution guidance file was retrieved.")
    category, status, reason = triage_category(findings, limitations, pull_request.changed_files)
    primary_findings = [
        finding
        for finding in findings
        if finding.category not in {"change_relevance", "overlap_minor"}
    ]
    return AnalysisResult(
        pull_request=pull_request.number,
        status=status,
        category=category,
        reason=reason,
        findings=findings,
        summary=AnalysisSummary(
            total_findings=len(primary_findings), limitations=limitations, ai_enabled=ai_enabled
        ),
        analyzed_at=datetime.now(timezone.utc).isoformat(),
    )
