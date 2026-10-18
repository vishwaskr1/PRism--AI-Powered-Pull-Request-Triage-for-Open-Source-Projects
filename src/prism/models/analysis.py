from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel

from .finding import Finding


class ReviewStatus(str, Enum):
    CONSISTENT_WITH_AVAILABLE_CHECKS = "CONSISTENT_WITH_AVAILABLE_CHECKS"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    POSSIBLE_OVERLAP = "POSSIBLE_OVERLAP"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    POTENTIALLY_SUSPICIOUS = "POTENTIALLY_SUSPICIOUS"


ReviewCategory = Literal["Likely legitimate", "Needs review", "Potentially suspicious"]
AIStatus = Literal["completed", "failed", "disabled"]
AIError = Literal["timeout", "invalid_output", "unreachable"]
GuidelineStatus = Literal["found", "not_found", "retrieval_failed"]


class AnalysisSummary(BaseModel):
    total_findings: int = 0
    limitations: List[str] = []
    ai_enabled: bool = False


class AnalysisResult(BaseModel):
    pull_request: int
    status: ReviewStatus
    category: ReviewCategory = "Needs review"
    reason: Optional[str] = None
    findings: List[Finding] = []
    summary: AnalysisSummary = AnalysisSummary()
    ai_status: AIStatus = "disabled"
    ai_error: Optional[AIError] = None
    guideline_status: GuidelineStatus = "retrieval_failed"
    guideline_path: Optional[str] = None
    analyzed_at: Optional[str] = None
