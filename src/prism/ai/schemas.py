from typing import List, Literal

from pydantic import BaseModel, Field


class SuggestedFinding(BaseModel):
    title: str
    explanation: str
    source: str
    excerpt: str
    severity: Literal["informational", "low", "medium", "high"]
    recommendation: str
    confidence: float = Field(ge=0, le=1)


class AIResponse(BaseModel):
    summary: str = Field(max_length=500)
    findings: List[SuggestedFinding] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
