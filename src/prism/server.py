"""FastAPI API and same-origin production frontend server."""

import math
import os
import re
import time
from collections import OrderedDict
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from prism.ai.ollama_client import OllamaProvider
from prism.config import get_settings
from prism.exceptions import GitHubRateLimit, PRismError
from prism.github import GitHubClient
from prism.sample_data import SampleGitHubClient, get_sample_data
from prism.services.analysis_service import AnalysisService
from prism.services.repository_service import RepositoryService

settings = get_settings()
app = FastAPI(
    title="PRism API",
    description="Evidence-based pull request triage for public repositories",
    version="1.0.0",
    docs_url="/api/docs" if settings.dev_mode else None,
    redoc_url="/api/redoc" if settings.dev_mode else None,
    openapi_url="/api/openapi.json" if settings.dev_mode else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_rate_buckets: OrderedDict[str, list[float]] = OrderedDict()


def _client_ip(request: Request) -> str:
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def security_and_abuse_controls(request: Request, call_next):
    if request.method == "POST" and request.url.path in {"/api/repository", "/api/analyze"}:
        now = time.monotonic()
        cutoff = now - settings.rate_limit_window_seconds
        ip = _client_ip(request)
        bucket = [stamp for stamp in _rate_buckets.get(ip, []) if stamp > cutoff]
        if len(bucket) >= settings.rate_limit_requests:
            retry_after = max(1, math.ceil(bucket[0] + settings.rate_limit_window_seconds - now))
            response = JSONResponse(
                {"detail": "Too many requests. Please wait before trying again."},
                status_code=429,
                headers={"Retry-After": str(retry_after)},
            )
        else:
            bucket.append(now)
            response = None
        _rate_buckets[ip] = bucket
        _rate_buckets.move_to_end(ip)
        while len(_rate_buckets) > 10_000:
            _rate_buckets.popitem(last=False)

        length = request.headers.get("content-length")
        if response is not None:
            pass
        elif length and length.isdigit() and int(length) > settings.max_request_bytes:
            response = JSONResponse({"detail": "Request body is too large."}, status_code=413)
        else:
            body = await request.body()
            if len(body) > settings.max_request_bytes:
                response = JSONResponse({"detail": "Request body is too large."}, status_code=413)
            else:
                delivered = False

                async def receive():
                    nonlocal delivered
                    if delivered:
                        return {"type": "http.disconnect"}
                    delivered = True
                    return {"type": "http.request", "body": body, "more_body": False}

                request._receive = receive
                response = None

        if response is None:
            response = await call_next(request)
    else:
        response = await call_next(request)

    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; "
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


class RepositoryRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    pr_limit: int = Field(default=10, ge=1, le=30)


class AnalyzeRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    pull_number: int = Field(ge=1)
    pr_limit: int = Field(default=10, ge=1, le=30)
    ai_enabled: bool = False
    ollama_model: Optional[str] = Field(default=None, max_length=128)


def _get_client() -> GitHubClient:
    return GitHubClient(settings=get_settings())


def _is_sample_url(value: str) -> bool:
    return value.lower() in {"sample", "demo", "sample://demo", "sympy/sympy (sample)"}


def _diff_excerpt(patch: Optional[str]):
    """Return one short unified-diff hunk and its new-file line range."""
    if not patch:
        return None, None, None, False
    lines = patch.splitlines()
    hunk_index = next((index for index, line in enumerate(lines) if line.startswith("@@")), None)
    if hunk_index is None:
        excerpt_lines = lines[:10]
        return "\n".join(excerpt_lines), None, None, len(lines) > len(excerpt_lines)

    header = lines[hunk_index]
    match = re.search(r"\+(\d+)(?:,(\d+))?", header)
    line_start = int(match.group(1)) if match else None
    hunk_body = []
    for line in lines[hunk_index + 1 :]:
        if line.startswith("@@") or len(hunk_body) >= 10:
            break
        hunk_body.append(line)
    line_end = line_start
    if line_start is not None:
        new_line_count = sum(1 for line in hunk_body if not line.startswith("-"))
        line_end = line_start + max(new_line_count - 1, 0)
    consumed = hunk_index + 1 + len(hunk_body)
    was_clipped = consumed < len(lines) or hunk_index > 0
    return "\n".join([header, *hunk_body]), line_start, line_end, was_clipped


@app.get("/api/health")
def health_check():
    """Liveness probe deliberately returns no configuration or dependency details."""
    return {"status": "ok"}


@app.get("/api/status")
def service_status():
    """Sanitized status used by the dashboard to determine local AI availability."""
    current = get_settings()
    provider = OllamaProvider(base_url=current.ollama_base_url, model=current.ollama_model)
    return {
        "status": "ok",
        "ai_available": provider.ping(),
        "ai_model_configured": bool(current.ollama_model),
    }


@app.get("/api/ollama/models")
def get_ollama_models():
    current = get_settings()
    provider = OllamaProvider(base_url=current.ollama_base_url, model=current.ollama_model)
    connected = provider.ping()
    return {
        "connected": connected,
        "models": provider.list_models() if connected else [],
        "default": current.ollama_model or "llama3",
    }


@app.post("/api/repository")
def fetch_repository(req: RepositoryRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Repository URL is required.")

    if _is_sample_url(url):
        owner, repo, metadata, pulls, guidelines = get_sample_data()
        return {
            "owner": owner,
            "repo": repo,
            "metadata": metadata.model_dump(mode="json"),
            "pulls": [pull.model_dump(mode="json") for pull in pulls[: req.pr_limit]],
            "guidelines": [guide.model_dump(mode="json") for guide in guidelines],
            "guideline_status": "found",
            "sample_mode": True,
        }

    client = _get_client()
    try:
        repository_service = RepositoryService(client)
        owner, repo, metadata, pulls, guidelines = repository_service.fetch(url, req.pr_limit)
        return {
            "owner": owner,
            "repo": repo,
            "metadata": metadata.model_dump(mode="json"),
            "pulls": [pull.model_dump(mode="json") for pull in pulls],
            "guidelines": [guide.model_dump(mode="json") for guide in guidelines],
            "guideline_status": repository_service.guideline_status,
            "sample_mode": False,
        }
    except GitHubRateLimit as exc:
        raise HTTPException(
            status_code=429,
            detail="GitHub API rate limit reached. Try sample mode or wait before retrying.",
        ) from exc
    except PRismError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        client.close()


@app.post("/api/analyze")
def analyze_pull_request_endpoint(req: AnalyzeRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Repository URL is required.")

    current = get_settings()
    is_sample = _is_sample_url(url)
    if is_sample:
        owner, repo, metadata, pulls, guidelines = get_sample_data()
        guideline_status = "found"
        client = SampleGitHubClient()
    else:
        client = _get_client()

    try:
        if not is_sample:
            repository_service = RepositoryService(client)
            owner, repo, metadata, pulls, guidelines = repository_service.fetch(url, req.pr_limit)
            guideline_status = repository_service.guideline_status
        selected_pull = next((pull for pull in pulls if pull.number == req.pull_number), None)
        if not selected_pull:
            raise HTTPException(
                status_code=404, detail="The selected open pull request was not found."
            )

        provider = None
        if req.ai_enabled:
            provider = OllamaProvider(
                base_url=current.ollama_base_url,
                model=req.ollama_model or current.ollama_model,
                timeout=current.ollama_timeout_seconds,
            )

        result = AnalysisService(client, ai_provider=provider).analyze(
            owner,
            repo,
            selected_pull,
            pulls,
            guidelines,
            ai_enabled=req.ai_enabled,
            guideline_status=guideline_status,
        )
        result.guideline_status = guideline_status
        result.guideline_path = guidelines[0].path if guidelines else None
        relevant_paths = {
            evidence.source
            for finding in result.findings
            if finding.category != "overlap"
            for evidence in finding.evidence
            if evidence.source_type == "changed_file"
        }
        selected_files = []
        for file in selected_pull.changed_files:
            if file.filename not in relevant_paths:
                continue
            excerpt, line_start, line_end, excerpt_truncated = _diff_excerpt(file.patch)
            selected_files.append(
                {
                    "filename": file.filename,
                    "patch_excerpt": excerpt,
                    "line_start": line_start,
                    "line_end": line_end,
                    "patch_available": file.patch_available,
                    "patch_truncated": file.patch_truncated or excerpt_truncated,
                }
            )
        comparisons_available = max(len(pulls) - 1, 0)
        comparison_limit = current.max_comparison_pull_requests
        return {
            "repository": metadata.full_name,
            "analysis": result.model_dump(mode="json"),
            "is_sample": is_sample,
            "changed_files": selected_files,
            "files_truncated": selected_pull.files_truncated,
            "comparison": {
                "compared": min(comparisons_available, comparison_limit),
                "available": comparisons_available,
            },
        }
    except GitHubRateLimit as exc:
        raise HTTPException(
            status_code=429,
            detail="GitHub API rate limit reached. Try sample mode or wait before retrying.",
        ) from exc
    except PRismError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        client.close()


def _dist_directory() -> Path:
    configured = os.getenv("PRISM_DIST_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[2] / "dist"


@app.get("/{path:path}", include_in_schema=False)
def frontend_fallback(path: str, request: Request):
    if path == "api" or path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    if request.method != "GET":
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    root = _dist_directory()
    index = root / "index.html"
    if not index.is_file():
        return JSONResponse({"detail": "Frontend build is not available."}, status_code=503)

    # Resolve against the build root so encoded traversal never reads outside it.
    candidate = (root / path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(index)


def start():
    import uvicorn

    current = get_settings()
    uvicorn.run(
        "prism.server:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=current.dev_mode,
    )


if __name__ == "__main__":
    start()
