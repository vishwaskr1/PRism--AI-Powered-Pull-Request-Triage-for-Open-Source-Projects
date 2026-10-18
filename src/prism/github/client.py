"""Bounded GitHub REST client; accepts repository identifiers, never arbitrary URLs."""

import threading
import time
from collections import OrderedDict
from typing import Optional, Tuple

import httpx

from prism.config import Settings, get_settings
from prism.exceptions import (
    GitHubAPIError,
    GitHubAuthenticationError,
    GitHubNotFound,
    GitHubRateLimit,
    InvalidRepositoryURL,
)

API = "https://api.github.com"
_CACHE = OrderedDict()
_CACHE_LOCK = threading.Lock()


def clear_response_cache():
    """Clear the process-local GitHub response cache (also useful in tests)."""
    with _CACHE_LOCK:
        _CACHE.clear()


def parse_repository_url(value: str) -> Tuple[str, str]:
    """Return owner/name only for canonical public github.com repository URLs."""
    from urllib.parse import urlparse

    parsed = urlparse(value.strip())
    parts = [p for p in parsed.path.strip("/").split("/") if p]
    if (
        parsed.scheme != "https"
        or parsed.hostname != "github.com"
        or parsed.port
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or len(parts) != 2
    ):
        raise InvalidRepositoryURL(
            "Enter a public repository URL like https://github.com/owner/repo"
        )
    owner, repo = parts
    import re

    if (
        not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?", owner)
        or not re.fullmatch(r"[A-Za-z0-9_.-]+", repo)
        or repo in {".", ".."}
        or repo.endswith(".git")
    ):
        raise InvalidRepositoryURL("Enter a canonical GitHub repository URL without .git")
    return owner, repo


class GitHubClient:
    def __init__(self, settings: Optional[Settings] = None, client: Optional[httpx.Client] = None):
        self.settings = settings or get_settings()
        self._owns_client = client is None
        self.client = client or httpx.Client(
            timeout=self.settings.request_timeout_seconds, follow_redirects=False
        )

    def close(self):
        if self._owns_client:
            self.client.close()

    def _get(self, path, params=None):
        ttl = self.settings.github_cache_ttl_seconds
        key = (bool(self.settings.github_token), path, tuple(sorted((params or {}).items())))
        now = time.monotonic()
        if ttl:
            with _CACHE_LOCK:
                cached = _CACHE.get(key)
                if cached and cached[0] > now:
                    _CACHE.move_to_end(key)
                    return cached[1]
                if cached:
                    del _CACHE[key]
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if self.settings.github_token:
            headers["Authorization"] = "Bearer " + self.settings.github_token
        for attempt in range(3):
            try:
                response = self.client.get(API + path, params=params, headers=headers)
            except httpx.TimeoutException as exc:
                if attempt < 2:
                    time.sleep(0.1 * (2**attempt))
                    continue
                raise GitHubAPIError("GitHub request timed out") from exc
            except httpx.RequestError as exc:
                if attempt < 2:
                    time.sleep(0.1 * (2**attempt))
                    continue
                raise GitHubAPIError("Could not connect to GitHub") from exc
            if response.status_code in (500, 502, 503, 504) and attempt < 2:
                time.sleep(0.1 * (2**attempt))
                continue
            if response.status_code == 404:
                raise GitHubNotFound("Repository or pull request was not found")
            if response.status_code == 401:
                raise GitHubAuthenticationError("GitHub rejected the configured token")
            if response.status_code == 429 or (
                response.status_code == 403
                and (
                    response.headers.get("X-RateLimit-Remaining") == "0"
                    or "Retry-After" in response.headers
                )
            ):
                raise GitHubRateLimit(
                    "GitHub API rate limit reached; configure GITHUB_TOKEN or retry later"
                )
            if response.status_code >= 400:
                raise GitHubAPIError("GitHub API returned HTTP %s" % response.status_code)
            if len(response.content) > 2_000_000:
                raise GitHubAPIError("GitHub API response exceeded the 2 MB safety limit")
            try:
                result = response.json()
                if ttl:
                    with _CACHE_LOCK:
                        _CACHE[key] = (now + ttl, result)
                        _CACHE.move_to_end(key)
                        while len(_CACHE) > self.settings.github_cache_max_items:
                            _CACHE.popitem(last=False)
                return result
            except ValueError as exc:
                raise GitHubAPIError("GitHub API returned invalid JSON") from exc
        raise GitHubAPIError("GitHub request failed after bounded retries")

    def repository(self, owner, repo):
        from prism.models import Repository

        data = self._get("/repos/%s/%s" % (owner, repo))
        if data.get("private"):
            raise GitHubNotFound("Only public repositories are supported")
        return Repository(
            full_name=data["full_name"],
            html_url=data["html_url"],
            default_branch=data["default_branch"],
            description=data.get("description"),
            private=False,
        )

    def list_pull_requests(self, owner, repo, limit=None):
        limit = min(limit or self.settings.max_pull_requests, self.settings.max_pull_requests, 100)
        page_size = min(30, limit)
        result = []
        for page in range(1, 11):
            data = self._get(
                "/repos/%s/%s/pulls" % (owner, repo),
                {"state": "open", "per_page": page_size, "page": page},
            )
            for item in data:
                result.append(self._pull(item))
                if len(result) >= limit:
                    return result
            if len(data) < page_size:
                break
        return result

    def pull_request(self, owner, repo, number):
        return self._pull(self._get("/repos/%s/%s/pulls/%s" % (owner, repo, number)))

    def changed_files(self, owner, repo, number):
        from prism.models import ChangedFile

        limit = self.settings.max_changed_files
        result = []
        for page in range(1, 31):
            data = self._get(
                "/repos/%s/%s/pulls/%s/files" % (owner, repo, number),
                {"per_page": min(100, limit), "page": page},
            )
            for item in data:
                patch = item.get("patch")
                result.append(
                    ChangedFile(
                        filename=item["filename"],
                        status=item.get("status", "modified"),
                        additions=item.get("additions", 0),
                        deletions=item.get("deletions", 0),
                        changes=item.get("changes", 0),
                        patch=patch[:200_000] if patch else None,
                        patch_available=patch is not None,
                        patch_truncated=bool(patch and len(patch) > 200_000),
                        html_url=item.get("blob_url"),
                    )
                )
                if len(result) >= limit:
                    return result, True
            if len(data) < min(100, limit):
                break
        return result, False

    def guidelines(self, owner, repo, default_branch):
        guides, _ = self.guidelines_with_status(owner, repo, default_branch)
        return guides

    def guidelines_with_status(self, owner, repo, default_branch):
        from prism.models import ContributionGuidelines

        candidates = ["CONTRIBUTING.md", ".github/CONTRIBUTING.md", "docs/CONTRIBUTING.md"]
        found = []
        retrieval_failed = False
        for path in candidates:
            try:
                data = self._get(
                    "/repos/%s/%s/contents/%s" % (owner, repo, path), {"ref": default_branch}
                )
            except GitHubNotFound:
                continue
            except GitHubAPIError:
                retrieval_failed = True
                continue
            if (
                not isinstance(data, dict)
                or data.get("type") != "file"
                or data.get("encoding") != "base64"
            ):
                retrieval_failed = True
                continue
            import base64

            try:
                content = base64.b64decode(data.get("content", "")).decode(
                    "utf-8", errors="replace"
                )
            except (ValueError, TypeError):
                retrieval_failed = True
                continue
            found.append(
                ContributionGuidelines(
                    path=path,
                    content=content[:200_000],
                    url=data["html_url"],
                    truncated=len(content) > 200_000,
                )
            )
        status = "found" if found else "retrieval_failed" if retrieval_failed else "not_found"
        return found, status

    @staticmethod
    def _pull(item):
        from prism.models import PullRequest

        return PullRequest(
            number=item["number"],
            title=item["title"],
            body=item.get("body"),
            state=item.get("state", "open"),
            draft=bool(item.get("draft", False)),
            html_url=item["html_url"],
            user=(item.get("user") or {}).get("login"),
            head_ref=(item.get("head") or {}).get("ref"),
            base_ref=(item.get("base") or {}).get("ref"),
        )
