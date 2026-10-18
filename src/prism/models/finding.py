from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from .evidence import EvidenceReference


class Finding(BaseModel):
    source_type: Literal["rule", "ai"] = "rule"
    category: str
    severity: str = "info"
    title: str
    explanation: str
    status: str
    confidence: float = Field(ge=0, le=1)
    overlap_similarity: Optional[float] = Field(default=None, ge=0, le=1)
    evidence: List[EvidenceReference] = []
    limitations: List[str] = []
    recommended_action: Optional[str] = None
