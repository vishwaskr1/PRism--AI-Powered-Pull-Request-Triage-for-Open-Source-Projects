from typing import List, Optional

from pydantic import BaseModel, Field


class SuggestedFinding(BaseModel):
    title: str
    explanation: str
    source: str
    excerpt: Optional[str] = None
    confidence: float = Field(ge=0, le=1)


class AIResponse(BaseModel):
    findings: List[SuggestedFinding] = []
