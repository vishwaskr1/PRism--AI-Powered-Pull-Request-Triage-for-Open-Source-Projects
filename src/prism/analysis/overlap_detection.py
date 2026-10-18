"""Conservative overlap leads based on meaningful changed paths."""

import fnmatch
import re

from prism.config import get_settings
from prism.models import EvidenceReference, Finding


def _tokens(text):
    return {x for x in re.findall(r"[a-z0-9]{3,}", (text or "").lower())}


def _similar_title(left, right):
    left_tokens, right_tokens = _tokens(left), _tokens(right)
    union = left_tokens | right_tokens
    return bool(union) and len(left_tokens & right_tokens) / len(union) >= 0.35


def _meaningful_paths(pull_request, ignored_patterns):
    paths = set()
    for changed_file in pull_request.changed_files:
        path = changed_file.filename.replace("\\", "/")
        while path.startswith("./"):
            path = path[2:]
        if not any(
            fnmatch.fnmatchcase(path.lower(), pattern.lower()) for pattern in ignored_patterns
        ):
            paths.add(path)
    return paths


def detect_overlaps(target, pull_requests, ignored_paths=None):
    """Only promote at least two meaningful shared paths, or one plus a similar title."""
    patterns = ignored_paths if ignored_paths is not None else get_settings().overlap_ignored_paths
    target_paths = _meaningful_paths(target, patterns)
    findings = []
    for other in pull_requests:
        if other.number == target.number:
            continue
        paths = target_paths & _meaningful_paths(other, patterns)
        title_similarity = _similar_title(target.title, other.title)
        if not paths:
            continue

        promoted = len(paths) >= 2 or (len(paths) == 1 and title_similarity)
        severity = "info" if promoted else "minor"
        category = "overlap" if promoted else "overlap_minor"
        evidence = [
            EvidenceReference(
                source_type="pull_request", source=str(target.number), excerpt=target.title
            ),
            EvidenceReference(
                source_type="pull_request", source=str(other.number), excerpt=other.title
            ),
        ]
        evidence.extend(
            EvidenceReference(source_type="changed_file", source=path) for path in sorted(paths)
        )
        if promoted:
            title = "Possible overlap with PR #%s" % other.number
            explanation = (
                "Retrieved open pull requests share %s meaningful changed path(s). "
                "This is a review lead, not evidence of duplicate work."
            ) % len(paths)
            status = "POSSIBLE_OVERLAP"
            confidence = 0.55
        else:
            title = "One meaningful changed file is shared with PR #%s" % other.number
            explanation = (
                "A single shared path is a minor review observation and does not establish overlap."
            )
            status = "NEEDS_REVIEW"
            confidence = 0.2
        findings.append(
            Finding(
                category=category,
                severity=severity,
                title=title,
                explanation=explanation,
                status=status,
                confidence=confidence,
                overlap_similarity=(
                    len(_tokens(target.title) & _tokens(other.title))
                    / len(_tokens(target.title) | _tokens(other.title))
                    if _tokens(target.title) | _tokens(other.title)
                    else 0
                ),
                evidence=evidence,
                limitations=[
                    "Shared paths are review leads; they do not establish duplicate work."
                ],
                recommended_action="Compare the diffs and discussion before deciding whether the work overlaps.",
            )
        )
    return findings
