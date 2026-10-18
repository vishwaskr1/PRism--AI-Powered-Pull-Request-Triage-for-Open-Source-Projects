"""Conservative, evidence-backed public category assignment."""

from prism.models import ReviewStatus


def triage_category(findings, limitations=(), changed_files=(), guideline_status=None):
    """Return the sole user-facing category, status, and any concise reason."""
    findings = [
        finding
        for finding in findings
        if finding.category not in {"change_relevance", "overlap_minor"}
    ]
    limitations = [str(item).lower() for item in limitations]
    diffs_unavailable = any(not file.patch_available for file in changed_files) or any(
        "did not include patch data" in item or "diff" in item and "unavailable" in item
        for item in limitations
    )
    verified = [finding for finding in findings if finding.evidence]
    independent_medium = {
        (finding.category, finding.title)
        for finding in verified
        if finding.severity.lower() == "medium"
    }
    insufficient_evidence = not changed_files or any(
        "analysis is insufficient" in item or "insufficient evidence" in item
        for item in limitations
    )

    has_overlap = any(item.category == "overlap" for item in findings)
    if diffs_unavailable or insufficient_evidence:
        category = "Needs review"
        status = (
            ReviewStatus.POSSIBLE_OVERLAP
            if has_overlap
            else ReviewStatus.INSUFFICIENT_EVIDENCE
            if insufficient_evidence
            else ReviewStatus.NEEDS_REVIEW
        )
    elif any(finding.severity.lower() == "high" for finding in verified):
        category = "Potentially suspicious"
        status = ReviewStatus.POTENTIALLY_SUSPICIOUS
    elif len(independent_medium) >= 2:
        category = "Potentially suspicious"
        status = ReviewStatus.POTENTIALLY_SUSPICIOUS
    elif (
        findings
        or limitations
        or not changed_files
        or guideline_status in {"not_found", "retrieval_failed"}
    ):
        category = "Needs review"
        status = ReviewStatus.POSSIBLE_OVERLAP if has_overlap else ReviewStatus.NEEDS_REVIEW
    else:
        category = "Likely legitimate"
        status = ReviewStatus.CONSISTENT_WITH_AVAILABLE_CHECKS
    reason = None
    if category == "Potentially suspicious":
        reason = (
            "verified high-severity evidence"
            if any(item.severity.lower() == "high" for item in verified)
            else "independent evidence-backed signals"
        )
    elif category == "Needs review":
        guidance_unavailable = guideline_status in {"not_found", "retrieval_failed"} or any(
            "contribution guidance" in item and ("no supported" in item or "not retrieved" in item)
            for item in limitations
        )
        if has_overlap:
            reason = "possible overlap"
        elif diffs_unavailable:
            reason = "diff unavailable"
        elif guidance_unavailable:
            reason = "guidelines unavailable"
        elif insufficient_evidence or any(not finding.evidence for finding in findings):
            reason = "insufficient evidence"
        elif findings:
            reason = "signals need review"
        else:
            reason = "analysis limited"
    return category, status, reason
