"""Run PRism against locally snapshotted and manually labeled fixtures."""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from prism.ai.ollama_client import OllamaProvider  # noqa: E402
from prism.config import get_settings  # noqa: E402
from prism.models import ChangedFile, ContributionGuidelines, PullRequest  # noqa: E402
from prism.services.analysis_service import AnalysisService  # noqa: E402

CATEGORIES = ("Likely legitimate", "Needs review", "Potentially suspicious")


class FixtureGitHub:
    def __init__(self, pull):
        self.pull = pull

    def pull_request(self, owner, repo, number):
        if number != self.pull.number:
            raise ValueError("Fixture PR number mismatch")
        return self.pull.model_copy(deep=True)

    def changed_files(self, owner, repo, number):
        return self.pull.changed_files, self.pull.files_truncated


def analyze_fixture(fixture, use_ai=False):
    parsed = urlparse(fixture["url"])
    parts = parsed.path.strip("/").split("/")
    if parsed.hostname != "github.com" or len(parts) < 4 or parts[2] != "pull":
        raise ValueError("Fixture URL must be https://github.com/owner/repo/pull/number")
    owner, repo = parts[0], parts[1]
    pull = PullRequest(
        number=fixture["pr_number"],
        title=fixture["title"],
        body=fixture.get("description"),
        html_url=fixture["url"],
        changed_files=[
            ChangedFile(
                filename=item["filename"],
                status=item["status"],
                patch=item.get("patch"),
                patch_available=item.get("patch") is not None,
            )
            for item in fixture.get("files", [])
        ],
    )
    guide_data = fixture.get("guideline", {})
    guides = []
    if guide_data.get("status") == "found" and guide_data.get("path") and guide_data.get("text"):
        guides.append(
            ContributionGuidelines(
                path=guide_data["path"],
                content=guide_data["text"],
                url=f"https://github.com/{owner}/{repo}/blob/HEAD/{guide_data['path']}",
            )
        )
    settings = get_settings()
    ai_enabled = use_ai and bool(settings.ollama_model)
    provider = (
        OllamaProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            timeout=settings.ollama_timeout_seconds,
        )
        if ai_enabled
        else None
    )
    result = AnalysisService(FixtureGitHub(pull), ai_provider=provider).analyze(
        owner,
        repo,
        pull,
        [pull],
        guides,
        ai_enabled=ai_enabled,
    )
    result.guideline_status = guide_data.get("status", "retrieval_failed")
    result.guideline_path = guide_data.get("path") if guides else None
    return result


def markdown_report(records, use_ai, model, settings):
    labeled = [row for row in records if row["human_label"] in CATEGORIES]
    if not labeled:
        return (
            """# PRism evaluation\n\n**Status: Not yet run.** No manually labeled fixtures are available. No accuracy, precision, recall, or confusion-matrix result is claimed.\n\nAdd reviewed JSON snapshots under `tests/eval/`, then run `python tests/eval/run_evaluation.py`.\n\nSettings: rules only; AI was %s; Ollama model: `%s`; minimum description length: %s; comparison PR limit: %s.\n"""
            % (
                "requested but unavailable"
                if use_ai and not model
                else "not requested"
                if not use_ai
                else "enabled",
                model or "not configured",
                settings.min_description_chars,
                settings.max_comparison_pull_requests,
            )
        )

    matrix = {expected: Counter() for expected in CATEGORIES}
    false_positives, false_negatives, insufficient = [], [], []
    for row in records:
        if row["human_label"] == "Insufficient information":
            insufficient.append(row)
        if row["human_label"] not in CATEGORIES:
            continue
        matrix[row["human_label"]][row["prediction"]] += 1
        if row["human_label"] == "Likely legitimate" and row["prediction"] != "Likely legitimate":
            false_positives.append(row)
        if (
            row["human_label"] == "Potentially suspicious"
            and row["prediction"] != "Potentially suspicious"
        ):
            false_negatives.append(row)
    output = [
        "# PRism evaluation",
        "",
        f"**Labeled cases:** {len(labeled)}",
        "",
        "## Confusion matrix",
        "",
        "| Human \\ Predicted | " + " | ".join(CATEGORIES) + " |",
        "|---|" + "---|" * len(CATEGORIES),
    ]
    output.extend(
        f"| {expected} | "
        + " | ".join(str(matrix[expected][predicted]) for predicted in CATEGORIES)
        + " |"
        for expected in CATEGORIES
    )
    output += ["", "## False positives", ""] + [
        f"- `{r['id']}`: human {r['human_label']}; predicted {r['prediction']}. Evidence notes: {r.get('evidence_notes', 'none recorded')}"
        for r in false_positives
    ]
    output += ["", "## False negatives", ""] + [
        f"- `{r['id']}`: human {r['human_label']}; predicted {r['prediction']}. Evidence notes: {r.get('evidence_notes', 'none recorded')}"
        for r in false_negatives
    ]
    output += ["", "## Insufficient-information cases", ""] + [
        f"- `{r['id']}`: predicted {r['prediction']}. Limits: {'; '.join(r.get('limitation_notes', [])) or 'none recorded'}"
        for r in insufficient
    ]
    output += [
        "",
        "## Run settings",
        "",
        f"- AI: {'enabled' if use_ai and model else 'rules only'}",
        f"- AI statuses: {dict(Counter(row.get('ai_status', 'disabled') for row in records))}",
        f"- Ollama model: `{model or 'not configured'}`",
        f"- Minimum description length: {settings.min_description_chars}",
        f"- Comparison PR limit: {settings.max_comparison_pull_requests}",
        f"- Overlap ignored paths: {', '.join(settings.overlap_ignored_paths)}",
    ]
    return "\n".join(output) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--ai", action="store_true", help="also request optional local Ollama findings"
    )
    parser.add_argument("--output", default=str(ROOT / "docs/EVALUATION.md"))
    args = parser.parse_args()
    settings = get_settings()
    records = []
    for path in sorted((ROOT / "tests/eval").glob("*.json")):
        if path.name == "fixture.schema.json":
            continue
        fixture = json.loads(path.read_text())
        result = analyze_fixture(fixture, use_ai=args.ai)
        records.append(
            {
                "id": fixture["id"],
                "human_label": fixture.get("human_label"),
                "prediction": result.category,
                "evidence_notes": fixture.get("evidence_notes", "none recorded"),
                "limitation_notes": fixture.get("limitation_notes", []),
                "ai_status": result.ai_status,
            }
        )
    Path(args.output).write_text(markdown_report(records, args.ai, settings.ollama_model, settings))
    print(
        "Wrote evaluation report. Labeled fixtures: %s"
        % sum(row["human_label"] in CATEGORIES for row in records)
    )


if __name__ == "__main__":
    main()
