"""Conservative checks for explicit contribution instructions."""

import re

from prism.models import EvidenceReference, Finding


def check_guidelines(guidelines, pull_request):
    findings = []
    for guideline in guidelines:
        lines = guideline.content.splitlines()
        for index, line in enumerate(lines, 1):
            match = re.search(
                r"\b(?:must|require[sd]?|please)\b.*\btests?\b|\btests?\b.*\b(?:must|required)\b",
                line,
                re.I,
            )
            if match and not any(
                f.filename.lower().startswith(("test", "tests/", "spec/"))
                for f in pull_request.changed_files
            ):
                findings.append(
                    Finding(
                        category="guideline",
                        severity="info",
                        title="Test-related guidance may need review",
                        explanation="The repository guidance mentions tests, but no changed path is clearly a test file. This does not establish that a test is required for this change.",
                        status="NEEDS_REVIEW",
                        confidence=0.35,
                        evidence=[
                            EvidenceReference(
                                source_type="guideline",
                                source=guideline.path,
                                excerpt=line.strip(),
                                start_line=index,
                                end_line=index,
                            )
                        ]
                        + [
                            EvidenceReference(source_type="changed_file", source=file.filename)
                            for file in pull_request.changed_files
                        ],
                        limitations=[
                            "A changed test may use a project-specific path or test coverage may be unnecessary for this change."
                        ],
                        recommended_action="Ask a maintainer whether tests are appropriate for this change.",
                    )
                )
    return findings
