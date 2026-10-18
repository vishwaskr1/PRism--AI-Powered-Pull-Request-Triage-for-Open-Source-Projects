from typing import Optional

from pydantic import BaseModel, HttpUrl


class Repository(BaseModel):
    full_name: str
    html_url: HttpUrl
    default_branch: str
    description: Optional[str] = None
    private: bool = False


class ContributionGuidelines(BaseModel):
    path: str
    content: str
    url: HttpUrl
    truncated: bool = False
