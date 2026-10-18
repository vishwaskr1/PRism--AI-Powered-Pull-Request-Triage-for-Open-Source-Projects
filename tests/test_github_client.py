import httpx
import pytest

from prism.config import Settings
from prism.exceptions import GitHubNotFound, GitHubRateLimit
from prism.github.client import GitHubClient, clear_response_cache


@pytest.fixture(autouse=True)
def clear_github_response_cache():
    clear_response_cache()
    yield
    clear_response_cache()


def test_repository_api_request_uses_fixed_host_and_parses_model():
    def handler(request):
        assert request.url.host == "api.github.com"
        return httpx.Response(
            200,
            json={
                "full_name": "o/r",
                "html_url": "https://github.com/o/r",
                "default_branch": "main",
                "private": False,
            },
        )

    client = GitHubClient(Settings(), httpx.Client(transport=httpx.MockTransport(handler)))
    repository = client.repository("o", "r")
    assert repository.full_name == "o/r"


def test_pull_requests_are_paginated_and_limited():
    requested = []

    def handler(request):
        requested.append(request.url.params.get("page"))
        page = int(request.url.params.get("page", "1"))
        numbers = list(range(1, 31)) if page == 1 else list(range(31, 36))
        data = [
            {
                "number": number,
                "title": "PR",
                "html_url": "https://github.com/o/r/pull/%d" % number,
                "user": {"login": "u"},
            }
            for number in numbers
        ]
        return httpx.Response(200, json=data)

    settings = Settings(max_pull_requests=35)
    client = GitHubClient(settings, httpx.Client(transport=httpx.MockTransport(handler)))
    assert len(client.list_pull_requests("o", "r")) == 35
    assert requested == ["1", "2"]


def test_github_get_responses_are_cached_with_a_bounded_entry_count():
    requests = []

    def handler(request):
        requests.append(str(request.url))
        return httpx.Response(200, json={"request": len(requests)})

    settings = Settings(github_cache_ttl_seconds=300, github_cache_max_items=1)
    client = GitHubClient(settings, httpx.Client(transport=httpx.MockTransport(handler)))
    assert client._get("/repos/o/r") == {"request": 1}
    assert client._get("/repos/o/r") == {"request": 1}
    assert client._get("/repos/o/r/pulls/1") == {"request": 2}
    # The second key evicts the first rather than allowing the cache to grow unbounded.
    assert client._get("/repos/o/r") == {"request": 3}
    assert len(requests) == 3


@pytest.mark.parametrize(
    "status,headers,error",
    [
        (404, {}, GitHubNotFound),
        (429, {}, GitHubRateLimit),
        (403, {"X-RateLimit-Remaining": "0"}, GitHubRateLimit),
    ],
)
def test_api_errors_are_mapped_without_response_details(status, headers, error):
    transport = httpx.MockTransport(lambda request: httpx.Response(status, headers=headers))
    client = GitHubClient(Settings(), httpx.Client(transport=transport))
    with pytest.raises(error):
        client._get("/repos/o/r")
