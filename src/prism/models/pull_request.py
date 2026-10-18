from typing import List, Optional

from pydantic import BaseModel, HttpUrl


class ChangedFile(BaseModel):
    filename: str
    status: str
    additions: int = 0
    deletions: int = 0
    changes: int = 0
    patch: Optional[str] = None
    patch_available: bool = True
    patch_truncated: bool = False
    html_url: Optional[HttpUrl] = None


class PullRequest(BaseModel):
    number: int
    title: str
    body: Optional[str] = None
    state: str = "open"
    draft: bool = False
    html_url: HttpUrl
    user: Optional[str] = None
    head_ref: Optional[str] = None
    base_ref: Optional[str] = None
    changed_files: List[ChangedFile] = []
    files_truncated: bool = False
