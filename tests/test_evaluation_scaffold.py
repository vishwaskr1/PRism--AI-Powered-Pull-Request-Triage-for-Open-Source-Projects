import importlib.util
from pathlib import Path

from prism.config import Settings

_SCRIPT = Path(__file__).parent / "eval" / "run_evaluation.py"
_SPEC = importlib.util.spec_from_file_location("prism_evaluation", _SCRIPT)
evaluation = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(evaluation)


def test_no_labeled_fixtures_explicitly_reports_not_yet_run():
    report = evaluation.markdown_report([], False, None, Settings())
    assert "Status: Not yet run" in report
    assert "No accuracy" in report
    assert "minimum description length: 20" in report


def test_labeled_fixtures_report_confusion_matrix_and_error_cases():
    records = [
        {"id": "ok", "human_label": "Likely legitimate", "prediction": "Needs review"},
        {"id": "risky", "human_label": "Potentially suspicious", "prediction": "Needs review"},
        {"id": "unknown", "human_label": "Insufficient information", "prediction": "Needs review"},
    ]
    report = evaluation.markdown_report(records, False, None, Settings())
    assert "| Likely legitimate | 0 | 1 | 0 |" in report
    assert "`ok`" in report and "`risky`" in report and "`unknown`" in report
