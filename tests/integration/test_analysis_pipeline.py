from prism.config import Settings
from prism.exceptions import GitHubNotFound
from prism.models import ChangedFile, PullRequest
from prism.services.analysis_service import AnalysisService


class FixtureGitHubClient:
    def pull_request(self, owner, repo, number):
        return PullRequest(
            number=number,
            title="Document parser behavior",
            body="Clarify parser edge cases",
            html_url="https://github.com/example/project/pull/%s" % number,
        )

    def changed_files(self, owner, repo, number):
        if number == 2:
            raise GitHubNotFound("fixture comparison unavailable")
        return [ChangedFile(filename="src/parser.py", status="modified")], False


def test_pipeline_keeps_deterministic_findings_and_comparison_limitations():
    target = PullRequest(
        number=1,
        title="Document parser behavior",
        html_url="https://github.com/example/project/pull/1",
    )
    other = PullRequest(
        number=2,
        title="Adjust parser edge cases",
        html_url="https://github.com/example/project/pull/2",
    )
    result = AnalysisService(FixtureGitHubClient()).analyze(
        "example", "project", target, [target, other], []
    )
    assert result.summary.total_findings == len(result.findings)
    assert any("comparison PR #2" in item for item in result.summary.limitations)


def test_pipeline_caps_comparison_pulls_and_reports_the_limit(monkeypatch):
    import prism.services.analysis_service as analysis_module

    class CountingGitHubClient(FixtureGitHubClient):
        requested_comparisons = []

        def changed_files(self, owner, repo, number):
            self.requested_comparisons.append(number)
            return [ChangedFile(filename="src/parser.py", status="modified")], False

    monkeypatch.setattr(
        analysis_module, "get_settings", lambda: Settings(max_comparison_pull_requests=1)
    )
    target = PullRequest(
        number=1,
        title="Document parser behavior",
        html_url="https://github.com/example/project/pull/1",
    )
    others = [
        PullRequest(
            number=number,
            title="Related",
            html_url="https://github.com/example/project/pull/%s" % number,
        )
        for number in range(2, 5)
    ]
    client = CountingGitHubClient()
    result = AnalysisService(client).analyze("example", "project", target, [target, *others])
    assert client.requested_comparisons == [1, 2]
    assert any("capped at 1" in item for item in result.summary.limitations)
