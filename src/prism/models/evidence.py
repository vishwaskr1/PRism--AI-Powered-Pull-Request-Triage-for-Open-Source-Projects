from typing import Optional

from pydantic import BaseModel, Field


class EvidenceReference(BaseModel):
    source_type: str
    source: str
    excerpt: Optional[str] = None
    start_line: Optional[int] = Field(default=None, ge=1)
    end_line: Optional[int] = Field(default=None, ge=1)
    api_field: Optional[str] = None
