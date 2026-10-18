from prism.github import GitHubClient, parse_repository_url


class RepositoryService:
    def __init__(self, client=None):
        self.client = client or GitHubClient()
        self.guideline_status = "retrieval_failed"

    def fetch(self, url, pull_limit=None):
        owner, repo = parse_repository_url(url)
        metadata = self.client.repository(owner, repo)
        pulls = self.client.list_pull_requests(owner, repo, limit=pull_limit)
        get_guidelines = getattr(self.client, "guidelines_with_status", None)
        if callable(get_guidelines):
            guidelines, self.guideline_status = get_guidelines(owner, repo, metadata.default_branch)
        else:
            # Without an explicit retrieval status, an empty list cannot be treated as not_found.
            guidelines = self.client.guidelines(owner, repo, metadata.default_branch)
            self.guideline_status = "found" if guidelines else "retrieval_failed"
        return owner, repo, metadata, pulls, guidelines
