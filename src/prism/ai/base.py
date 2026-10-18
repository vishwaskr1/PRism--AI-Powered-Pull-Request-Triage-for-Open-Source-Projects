from typing import List, Protocol, Tuple

from prism.ai.schemas import AIResponse
from prism.models import Finding


class AnalysisProvider(Protocol):
    def analyze_pr(self, pull_request, guidelines=()) -> Tuple[AIResponse, List[Finding]]:
        """Return structured model output and only evidence-validated findings."""
