from fastapi.testclient import TestClient

from prism import server


def test_health_is_minimal_and_security_headers_are_present():
    response = TestClient(server.app).get("/api/health")
    assert response.json() == {"status": "ok"}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_unknown_api_route_is_json_404():
    response = TestClient(server.app).get("/api/unknown")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"detail": "Not Found"}


def test_production_api_documentation_is_disabled():
    client = TestClient(server.app)
    for path in ("/api/docs", "/api/redoc", "/api/openapi.json"):
        assert client.get(path).status_code == 404


def test_dashboard_route_falls_back_to_frontend_build(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<div id='root'>PRism app</div>")
    monkeypatch.setattr(server, "_dist_directory", lambda: tmp_path)
    response = TestClient(server.app).get("/dashboard")
    assert response.status_code == 200
    assert "PRism app" in response.text


def test_frontend_fallback_never_serves_files_outside_build_root(tmp_path, monkeypatch):
    build = tmp_path / "build"
    build.mkdir()
    (build / "index.html").write_text("<div>inside</div>")
    (tmp_path / "secret.txt").write_text("outside-build-secret")
    monkeypatch.setattr(server, "_dist_directory", lambda: build)

    response = TestClient(server.app).get("/%2e%2e/secret.txt")
    assert response.status_code == 404
    assert "outside-build-secret" not in response.text


def test_repository_endpoint_is_rate_limited_per_ip(monkeypatch):
    server._rate_buckets.clear()
    monkeypatch.setattr(server.settings, "rate_limit_requests", 1)
    client = TestClient(server.app)
    first = client.post("/api/repository", json={"url": "not a repository"})
    second = client.post("/api/repository", json={"url": "not a repository"})
    assert first.status_code == 400
    assert second.status_code == 429
    assert second.json()["detail"] == "Too many requests. Please wait before trying again."
    assert second.headers["retry-after"]
    monkeypatch.setattr(server.settings, "rate_limit_requests", 20)
    server._rate_buckets.clear()


def test_analyze_endpoint_is_rate_limited_per_ip(monkeypatch):
    server._rate_buckets.clear()
    monkeypatch.setattr(server.settings, "rate_limit_requests", 1)
    client = TestClient(server.app)
    payload = {"url": "sample", "pull_number": 142}
    assert client.post("/api/analyze", json=payload).status_code == 200
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 429
    assert response.headers.get("retry-after")
    monkeypatch.setattr(server.settings, "rate_limit_requests", 20)
    server._rate_buckets.clear()


def test_analyze_pr_endpoint_caches_by_head_sha(monkeypatch):
    server._rate_buckets.clear()
    server._pr_review_cache.clear()

    class FixtureClient:
        calls = []

        def pull_request_data(self, owner, repo, number):
            self.calls.append("pull")
            return {
                "head": {"sha": "fixture-sha"},
                "user": {"login": "maintainer"},
            }

        def pull_request_files_data(self, owner, repo, number):
            self.calls.append("files")
            return []

        def pull_request_commits(self, owner, repo, number):
            self.calls.append("commits")
            return []

        def user_profile(self, login):
            self.calls.append("user")
            return {"login": login}

        def close(self):
            pass

    client = FixtureClient()
    monkeypatch.setattr(server, "_get_client", lambda: client)
    monkeypatch.setattr(
        server,
        "analyze_pr_review",
        lambda **kwargs: {
            "verdict": "genuine",
            "score": 80,
            "confidence": "medium",
            "summary": "A useful change.",
            "reasons": ["Adds source code."],
            "red_flags": [],
            "green_flags": ["Includes a focused fix."],
            "heuristic_score": 75,
            "signals": {"trivial_change": False},
            "source": "heuristic",
            "model": "heuristic-v1",
        },
    )

    api = TestClient(server.app)
    first = api.post("/api/analyze-pr", json={"owner": "example", "repo": "project", "number": 4})
    second = api.post("/api/analyze-pr", json={"owner": "example", "repo": "project", "number": 4})
    assert first.status_code == 200
    assert first.json()["source"] == "heuristic"
    assert first.json()["cached"] is False
    assert second.json()["cached"] is True
    assert client.calls == ["pull", "files", "commits", "user", "pull"]
    server._pr_review_cache.clear()


def test_analyze_pr_rejects_invalid_repository_components():
    response = TestClient(server.app).post(
        "/api/analyze-pr", json={"owner": "owner/evil", "repo": "repo", "number": 1}
    )
    assert response.status_code == 422


def test_analyze_pr_endpoint_is_rate_limited(monkeypatch):
    server._rate_buckets.clear()
    server._pr_review_cache.clear()

    class FixtureClient:
        def pull_request_data(self, owner, repo, number):
            return {"head": {"sha": "rate-limit-sha"}, "user": {"login": "author"}}

        def pull_request_files_data(self, owner, repo, number):
            return []

        def pull_request_commits(self, owner, repo, number):
            return []

        def user_profile(self, login):
            return None

        def close(self):
            pass

    monkeypatch.setattr(server, "_get_client", lambda: FixtureClient())
    monkeypatch.setattr(
        server,
        "analyze_pr_review",
        lambda **kwargs: {
            "verdict": "low_quality",
            "score": 45,
            "confidence": "low",
            "summary": "Heuristic result.",
            "reasons": [],
            "red_flags": [],
            "green_flags": [],
            "heuristic_score": 45,
            "signals": {},
            "source": "heuristic",
            "model": "heuristic-v1",
        },
    )
    monkeypatch.setattr(server.settings, "rate_limit_requests", 1)
    client = TestClient(server.app)
    body = {"owner": "example", "repo": "project", "number": 9}
    first = client.post("/api/analyze-pr", json=body)
    second = client.post("/api/analyze-pr", json=body)
    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers.get("retry-after")
    monkeypatch.setattr(server.settings, "rate_limit_requests", 20)
    server._rate_buckets.clear()
    server._pr_review_cache.clear()


def test_forwarded_ip_is_trusted_only_when_configured(monkeypatch):
    client = TestClient(server.app)
    monkeypatch.setattr(server.settings, "rate_limit_requests", 1)

    server._rate_buckets.clear()
    monkeypatch.setattr(server.settings, "trust_proxy", False)
    first = client.post(
        "/api/repository", json={"url": "invalid"}, headers={"X-Forwarded-For": "198.51.100.1"}
    )
    second = client.post(
        "/api/repository", json={"url": "invalid"}, headers={"X-Forwarded-For": "198.51.100.2"}
    )
    assert first.status_code == 400
    assert second.status_code == 429

    server._rate_buckets.clear()
    monkeypatch.setattr(server.settings, "trust_proxy", True)
    first = client.post(
        "/api/repository", json={"url": "invalid"}, headers={"X-Forwarded-For": "198.51.100.1"}
    )
    second = client.post(
        "/api/repository", json={"url": "invalid"}, headers={"X-Forwarded-For": "198.51.100.2"}
    )
    assert first.status_code == 400
    assert second.status_code == 400
    monkeypatch.setattr(server.settings, "trust_proxy", False)
    monkeypatch.setattr(server.settings, "rate_limit_requests", 20)
    server._rate_buckets.clear()


def test_sample_analysis_returns_ai_and_guideline_status_fields():
    server._rate_buckets.clear()
    response = TestClient(server.app).post(
        "/api/analyze",
        json={"url": "sample", "pull_number": 142, "pr_limit": 10, "ai_enabled": False},
    )
    assert response.status_code == 200
    analysis = response.json()["analysis"]
    assert analysis["ai_status"] == "disabled"
    assert analysis["ai_error"] is None
    assert analysis["guideline_status"] == "found"
    assert analysis["guideline_path"] == "CONTRIBUTING.md"
    assert analysis["category"] in {
        "Likely legitimate",
        "Needs review",
        "Potentially suspicious",
    }


def test_ai_status_reports_provider_key_availability_without_calling_provider(monkeypatch):
    monkeypatch.setattr(
        server,
        "get_settings",
        lambda: server.settings.model_copy(
            update={
                "groq_api_key": None,
                "gemini_api_key": None,
            }
        ),
    )
    response = TestClient(server.app).get("/api/status")
    assert response.status_code == 200
    assert response.json()["ai_available"] is False

    monkeypatch.setattr(
        server,
        "get_settings",
        lambda: server.settings.model_copy(
            update={
                "groq_api_key": "groq_fixture",
                "gemini_api_key": None,
            }
        ),
    )
    response = TestClient(server.app).get("/api/status")
    assert response.json()["ai_available"] is True
