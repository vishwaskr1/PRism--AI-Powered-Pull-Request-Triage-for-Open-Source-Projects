"""Bundled, clearly labelled data used by sample mode."""

from prism.models import ChangedFile, ContributionGuidelines, PullRequest, Repository


def get_sample_data():
    owner = "sympy"
    repo = "sympy"
    metadata = Repository(
        full_name="sympy/sympy",
        html_url="https://github.com/sympy/sympy",
        description="A computer algebra system used to demonstrate evidence-backed triage.",
        default_branch="main",
        private=False,
    )
    guidelines = [
        ContributionGuidelines(
            path="CONTRIBUTING.md",
            url="https://github.com/sympy/sympy/blob/main/CONTRIBUTING.md",
            content=(
                "# Contributing Guidelines\n\n"
                "1. Tests are mandatory: any new feature, bug fix, or retry policy must have accompanying unit tests.\n"
                "2. Documentation: all public configuration values and operational limits must be documented in the PR description.\n"
                "3. Concurrency: background workers and delivery retry tasks must acquire and release appropriate locks before execution."
            ),
            truncated=False,
        )
    ]
    pulls = [
        PullRequest(
            number=142,
            title="Add retry policy to webhook delivery",
            user="mira-chen",
            state="open",
            html_url="https://github.com/sympy/sympy/pull/142",
            body="Implements an exponential backoff retry worker with a 30s delay and a 5-attempt cap. Closes #140.",
        ),
        PullRequest(
            number=139,
            title="Document token rotation procedure",
            user="dlopez",
            state="open",
            html_url="https://github.com/sympy/sympy/pull/139",
            body="Documents procedures for rotating API keys and webhook secrets in operations manuals.",
        ),
        PullRequest(
            number=137,
            title="Refactor workspace permissions",
            user="sloane",
            state="open",
            html_url="https://github.com/sympy/sympy/pull/137",
            body="Refactor role checking logic in workspace authorization middlewares.",
        ),
        PullRequest(
            number=134,
            title="Update billing export dependencies",
            user="npatel",
            state="open",
            html_url="https://github.com/sympy/sympy/pull/134",
            body="Bump billing export dependencies to latest patch releases.",
        ),
    ]
    return owner, repo, metadata, pulls, guidelines


class SampleGitHubClient:
    """Small deterministic fixture client for bundled sample pull requests."""

    def pull_request(self, owner, repo, number):
        _, _, _, pulls, _ = get_sample_data()
        return next((pull for pull in pulls if pull.number == number), pulls[0])

    def changed_files(self, owner, repo, number):
        if number == 142:
            return [
                ChangedFile(
                    filename="src/workers/webhook-retry.ts",
                    status="modified",
                    patch=(
                        "@@ -84,10 +84,15 @@\n"
                        " if (result.timedOut) {\n"
                        "   await queue.enqueue(delivery.id, {\n"
                        "     delay: retryPolicy.backoff(attempt),\n"
                        "     attempt: attempt + 1,\n"
                        "   })\n"
                        " }\n"
                    ),
                    patch_available=True,
                ),
                ChangedFile(
                    filename="src/config/delivery.ts",
                    status="modified",
                    patch=(
                        "@@ -15,4 +15,6 @@\n"
                        " export const deliveryLeaseSeconds = 60\n"
                        "+export const firstRetryDelaySeconds = 30\n"
                    ),
                    patch_available=True,
                ),
            ], False
        return [
            ChangedFile(
                filename="docs/token-rotation.md",
                status="modified",
                patch="@@ -1,4 +1,8 @@\n+Token rotation guide\n",
                patch_available=True,
            )
        ], False

    def close(self):
        pass
