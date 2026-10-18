"""Orchestration service for PRism repository and pull request triage."""

from typing import List

from prism.analysis.evidence_builder import validate_finding
from prism.analysis.orchestrator import analyze_pull_request
from prism.analysis.triage import triage_category
from prism.config import get_settings
from prism.exceptions import AIProviderUnavailable, GitHubAPIError
from prism.models import AnalysisResult, PullRequest


class AnalysisService:
    def __init__(self, github_client, ai_provider=None):
        self.github = github_client
        self.ai = ai_provider

    def analyze(
        self,
        owner: str,
        repo: str,
        pull: PullRequest,
        all_pulls: List[PullRequest],
        guidelines=(),
        ai_enabled: bool = False,
        guideline_status=None,
    ) -> AnalysisResult:
        detailed = self.github.pull_request(owner, repo, pull.number)
        detailed.changed_files, detailed.files_truncated = self.github.changed_files(
            owner, repo, pull.number
        )
        pull.changed_files = detailed.changed_files
        pull.files_truncated = detailed.files_truncated
        comparison_limit = get_settings().max_comparison_pull_requests
        all_others = [item for item in all_pulls if item.number != pull.number]
        others = all_others[:comparison_limit]
        limitations = []
        if len(all_others) > comparison_limit:
            limitations.append(
                "Comparison pull requests were capped at %s; overlap checks may be incomplete."
                % comparison_limit
            )
        for other in others:
            try:
                other.changed_files, other.files_truncated = self.github.changed_files(
                    owner, repo, other.number
                )
            except GitHubAPIError:
                other.changed_files = []
                limitations.append(
                    "Changed-file data for comparison PR #%s could not be retrieved." % other.number
                )

        result = analyze_pull_request(
            detailed, guidelines, others, ai_enabled=ai_enabled, extra_limitations=limitations
        )
        if any(file.patch_truncated for file in detailed.changed_files):
            result.summary.limitations.append(
                "One or more changed-file diffs were truncated at the retrieval safety limit."
            )

        if not ai_enabled:
            result.ai_status = "disabled"
        elif self.ai:
            result.ai_status = "failed"
            try:
                ai_response, ai_findings = self.ai.analyze_pr(detailed, guidelines)
                validated_ai_findings = []
                for finding in ai_findings:
                    validated = validate_finding(finding, detailed, guidelines, others)
                    if validated:
                        validated_ai_findings.append(validated)
                result.findings.extend(validated_ai_findings)
                result.summary.ai_summary = ai_response.summary[:500]
                result.summary.ai_limitations.extend(
                    text[:300] for text in ai_response.limitations[:5] if text.strip()
                )
                result.summary.total_findings = sum(
                    finding.category not in {"change_relevance", "overlap_minor"}
                    for finding in result.findings
                )
                result.summary.ai_enabled = True
                result.ai_status = "completed"
                result.ai_error = None
            except AIProviderUnavailable as exc:
                result.summary.ai_enabled = False
                result.ai_status = "failed"
                result.ai_error = exc.reason
                result.summary.limitations.append(_ai_limitation(exc.reason))
            except Exception:
                result.summary.ai_enabled = False
                result.ai_status = "failed"
                result.ai_error = "unreachable"
                result.summary.limitations.append(_ai_limitation("unreachable"))
        else:
            result.summary.ai_enabled = False
            result.ai_status = "failed"
            result.ai_error = "unreachable"
            result.summary.limitations.append(_ai_limitation("unreachable"))

        category, status, reason = triage_category(
            result.findings,
            result.summary.limitations,
            detailed.changed_files,
            guideline_status=guideline_status,
        )
        result.category = category
        result.status = status
        result.reason = reason

        return result


def _ai_limitation(reason):
    messages = {
        "timeout": "AI analysis timed out for this PR. Rule-based results only.",
        "invalid_output": "The AI returned a response PRism could not validate; it was discarded.",
        "unreachable": "AI analysis is temporarily unavailable from the hosted provider. Rule-based results only.",
        "rate_limited": "Hosted AI rate limit reached. Rule-based results only; please try again later.",
        "billing_required": "Hosted AI billing is not available for this account. Rule-based results only.",
        "auth_required": "The hosted AI API key is missing permission or is invalid. Rule-based results only.",
    }
    message = messages.get(reason, messages["unreachable"])
    return message
