from typing import Protocol


class AnalysisProvider(Protocol):
    def analyze(self, payload):
        """Return a validated structured list of suggested findings."""
