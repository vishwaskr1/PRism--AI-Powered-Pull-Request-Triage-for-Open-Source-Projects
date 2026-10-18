"""Local Ollama provider for PRism."""

import json
from typing import Any, Dict, List, Optional

import httpx

from prism.ai.prompts import SYSTEM_PROMPT
from prism.ai.schemas import AIResponse
from prism.exceptions import OllamaUnavailable
from prism.models import EvidenceReference, Finding


class OllamaProvider:
    def __init__(
        self,
        base_url: str = "http://127.0.0.1:11434",
        model: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.base_url = (base_url or "http://127.0.0.1:11434").rstrip("/")
        self.model = model or "llama3"
        self.timeout = timeout

    def ping(self) -> bool:
        """Check if Ollama or AI endpoint is reachable."""
        try:
            response = httpx.get(f"{self.base_url}/api/version", timeout=3.0)
            return response.status_code == 200
        except Exception:
            try:
                response = httpx.get(f"{self.base_url}/api/tags", timeout=3.0)
                return response.status_code == 200
            except Exception:
                return False

    def list_models(self) -> List[str]:
        """List models available in local Ollama."""
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                return [m.get("name") for m in data.get("models", []) if m.get("name")]
        except Exception:
            pass
        return []

    def analyze_pr(self, pull_request, guidelines=()) -> List[Finding]:
        """Construct prompt context, run LLM inference, and return validated findings."""
        sources: Dict[str, str] = {}
        sources["pr:title"] = pull_request.title or ""
        sources["pr:body"] = (pull_request.body or "")[:2000]

        for g in guidelines:
            sources[f"guideline:{g.path}"] = (g.content or "")[:3000]

        for f in getattr(pull_request, "changed_files", [])[:10]:
            if f.patch:
                sources[f"file:{f.filename}"] = f.patch[:2000]

        payload = {
            "pr_number": pull_request.number,
            "pr_title": pull_request.title,
            "pr_author": pull_request.user,
            "sources": sources,
        }

        findings_data = self._invoke(payload)

        findings = []
        for item in findings_data:
            source_type, source = self._citation_source(item.source)
            evidence_ref = EvidenceReference(
                source_type=source_type,
                source=source,
                excerpt=item.excerpt,
            )
            findings.append(
                Finding(
                    source_type="ai",
                    category="ai_suggestion",
                    severity="info" if item.confidence < 0.8 else "warning",
                    title=f"[AI] {item.title}",
                    explanation=item.explanation,
                    status="AI_SUGGESTION",
                    confidence=float(item.confidence),
                    evidence=[evidence_ref],
                    limitations=["AI-generated finding: requires human maintainer verification."],
                    recommended_action="Review the cited source excerpt for validity.",
                )
            )
        return findings

    @staticmethod
    def _citation_source(value: str):
        """Map model context keys to the retrieved source identifiers used by validation."""
        if value.startswith("guideline:"):
            return "guideline", value.removeprefix("guideline:")
        if value.startswith("file:"):
            return "changed_file", value.removeprefix("file:")
        if value == "pr:title":
            return "pull_request", "title"
        if value == "pr:body":
            return "pull_request", "body"
        return "unsupported", value

    def analyze(self, payload: Dict[str, Any]):
        return self._invoke(payload)

    def _invoke(self, payload: Dict[str, Any]):
        return self._invoke_ollama(payload)

    def _invoke_ollama(self, payload: Dict[str, Any]):
        try:
            response = httpx.post(
                self.base_url + "/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "format": AIResponse.model_json_schema(),
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                    ],
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            raw = response.json()["message"]["content"]
            result = AIResponse.model_validate_json(raw)
        except httpx.TimeoutException as exc:
            raise OllamaUnavailable("Ollama inference timed out", reason="timeout") from exc
        except httpx.HTTPError as exc:
            raise OllamaUnavailable("Ollama could not be reached", reason="unreachable") from exc
        except (ValueError, KeyError, TypeError) as exc:
            raise OllamaUnavailable(
                "Ollama returned invalid output", reason="invalid_output"
            ) from exc

        known = set(payload.get("sources", {}))
        valid_findings = [
            item
            for item in result.findings
            if item.source in known
            and (not item.excerpt or item.excerpt in payload["sources"][item.source])
        ]
        if result.findings and not valid_findings:
            raise OllamaUnavailable(
                "Ollama response failed evidence validation", reason="invalid_output"
            )
        return valid_findings
