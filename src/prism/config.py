"""Validated environment configuration for PRism."""

import os
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator


class Settings(BaseModel):
    github_token: Optional[str] = None
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: Optional[str] = None
    ollama_timeout_seconds: float = Field(default=60, gt=0, le=600)
    min_description_chars: int = Field(default=20, ge=0, le=1000)
    request_timeout_seconds: float = Field(default=15, gt=0, le=120)
    max_pull_requests: int = Field(default=30, ge=1, le=100)
    max_changed_files: int = Field(default=100, ge=1, le=3000)
    max_comparison_pull_requests: int = Field(default=10, ge=0, le=30)
    overlap_ignored_paths: list[str] = Field(
        default_factory=lambda: [
            "package.json",
            "package-lock.json",
            "npm-shrinkwrap.json",
            "yarn.lock",
            "pnpm-lock.yaml",
            "bun.lock",
            "bun.lockb",
            "composer.lock",
            "Gemfile.lock",
            "Cargo.lock",
            "go.sum",
            "*.lock",
            "**/package.json",
            "**/package-lock.json",
            "**/npm-shrinkwrap.json",
            "**/yarn.lock",
            "**/pnpm-lock.yaml",
            "**/bun.lock",
            "**/bun.lockb",
            "**/composer.lock",
            "**/Gemfile.lock",
            "**/Cargo.lock",
            "**/go.sum",
            "**/*.lock",
            "poetry.lock",
            "Pipfile.lock",
            "requirements*.txt",
            "requirements*.in",
            "README*",
            "**/README*",
            "CHANGELOG*",
            "**/CHANGELOG*",
            "LICENSE*",
            "**/LICENSE*",
            "docs/*",
            ".github/*",
            "**/vendor/**",
            "vendor/**",
            "**/generated/**",
            "generated/**",
            "**/dist/**",
            "dist/**",
            "**/build/**",
            "build/**",
            "**/node_modules/**",
            "node_modules/**",
            "**/coverage/**",
            "coverage/**",
            "*.generated.*",
        ]
    )
    rate_limit_requests: int = Field(default=20, ge=1, le=1000)
    rate_limit_window_seconds: int = Field(default=600, ge=1, le=86400)
    github_cache_ttl_seconds: int = Field(default=300, ge=0, le=86400)
    github_cache_max_items: int = Field(default=256, ge=1, le=10000)
    trust_proxy: bool = False
    allowed_origins: list[str] = Field(default_factory=list)
    dev_mode: bool = False
    max_request_bytes: int = Field(default=1_000_000, ge=1024, le=10_000_000)
    log_level: str = "INFO"

    @field_validator("log_level")
    @classmethod
    def valid_log_level(cls, value):
        value = value.upper()
        if value not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("LOG_LEVEL must be a standard logging level")
        return value

    @field_validator("ollama_base_url")
    @classmethod
    def local_ollama_only(cls, value):
        from urllib.parse import urlparse

        parsed = urlparse(value)
        if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("Ollama URL must use localhost HTTP")
        return value.rstrip("/")


@lru_cache(maxsize=1)
def get_settings():
    load_dotenv()
    return Settings(
        github_token=os.getenv("GITHUB_TOKEN") or None,
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
        ollama_model=os.getenv("OLLAMA_MODEL") or None,
        ollama_timeout_seconds=float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "60")),
        min_description_chars=int(os.getenv("MIN_DESCRIPTION_CHARS", "20")),
        request_timeout_seconds=float(os.getenv("REQUEST_TIMEOUT_SECONDS", "15")),
        max_pull_requests=int(os.getenv("MAX_PULL_REQUESTS", "30")),
        max_changed_files=int(os.getenv("MAX_CHANGED_FILES", "100")),
        max_comparison_pull_requests=int(os.getenv("PRISM_MAX_COMPARISON_PRS", "10")),
        overlap_ignored_paths=[
            item.strip()
            for item in os.getenv("PRISM_OVERLAP_IGNORED_PATHS", "").split(",")
            if item.strip()
        ]
        or Settings().overlap_ignored_paths,
        rate_limit_requests=int(os.getenv("PRISM_RATE_LIMIT_REQUESTS", "20")),
        rate_limit_window_seconds=int(os.getenv("PRISM_RATE_LIMIT_WINDOW_SECONDS", "600")),
        github_cache_ttl_seconds=int(os.getenv("PRISM_GITHUB_CACHE_TTL_SECONDS", "300")),
        github_cache_max_items=int(os.getenv("PRISM_GITHUB_CACHE_MAX_ITEMS", "256")),
        trust_proxy=os.getenv("PRISM_TRUST_PROXY", "0").lower() in {"1", "true", "yes"},
        allowed_origins=[
            origin.strip()
            for origin in os.getenv(
                "PRISM_ALLOWED_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:8443,http://127.0.0.1:8443",
            ).split(",")
            if origin.strip()
        ],
        dev_mode=os.getenv("PRISM_DEV", "0").lower() in {"1", "true", "yes"},
        max_request_bytes=int(os.getenv("PRISM_MAX_REQUEST_BYTES", "1000000")),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
    )
