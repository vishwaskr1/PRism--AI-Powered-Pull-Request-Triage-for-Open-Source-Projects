"""Transparent title/description to changed-path heuristic."""

import re

from prism.config import get_settings
from prism.models import EvidenceReference, Finding


def _terms(text):
    return {word for word in re.findall(r"[a-z0-9]{4,}", (text or "").lower())}


def check_change_relevance(pull_request):
    paths = [f.filename for f in pull_request.changed_files]
    text = _terms(pull_request.title + " " + (pull_request.body or ""))
    path_terms = _terms(" ".join(paths))
    if not paths or not text or text & path_terms:
        return []
    return [
        Finding(
            category="change_relevance",
            severity="info",
            title="Purpose and changed paths have little lexical overlap",
            explanation="The PR summary and changed file paths share no terms under a simple name-based heuristic. File names alone cannot establish whether the changes are relevant.",
            status="NEEDS_REVIEW",
            confidence=0.2,
            evidence=[
                EvidenceReference(
                    source_type="pull_request",
                    source="title",
                    excerpt=pull_request.title,
                    api_field="title",
                )
            ]
            + [
                EvidenceReference(source_type="changed_file", source=f.filename)
                for f in pull_request.changed_files[:10]
            ],
            limitations=["This lexical check does not understand code semantics or synonyms."],
            recommended_action="Review the diff and confirm the stated purpose matches the changes.",
        )
    ]


def check_description(pull_request, minimum_characters=None):
    """Flag only an unusually short description; this is never a suspicion claim."""
    minimum = (
        get_settings().min_description_chars if minimum_characters is None else minimum_characters
    )
    description = (pull_request.body or "").strip()
    if len(description) >= minimum:
        return []
    return [
        Finding(
            category="description",
            severity="low",
            title="Possible concern: PR description is missing or very short",
            explanation=(
                "The description has fewer than %s characters. A short description alone "
                "does not indicate intent or code safety."
            )
            % minimum,
            status="NEEDS_REVIEW",
            confidence=0.2,
            evidence=[
                EvidenceReference(
                    source_type="pull_request",
                    source="body",
                    excerpt=description or None,
                    api_field="body",
                )
            ],
            limitations=["Description length alone cannot establish code quality or intent."],
            recommended_action="Ask for context if the change is difficult to review.",
        )
    ]
