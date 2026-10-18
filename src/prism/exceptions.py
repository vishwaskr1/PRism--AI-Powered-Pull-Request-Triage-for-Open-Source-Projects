"""Domain errors exposed by PRism services."""


class PRismError(Exception):
    """Base error safe to present to an application user."""


class InvalidRepositoryURL(PRismError):
    pass


class GitHubAPIError(PRismError):
    pass


class GitHubNotFound(GitHubAPIError):
    pass


class GitHubRateLimit(GitHubAPIError):
    pass


class GitHubAuthenticationError(GitHubAPIError):
    pass


class OllamaUnavailable(PRismError):
    def __init__(self, message="Ollama is unavailable", reason="unreachable"):
        super().__init__(message)
        self.reason = reason
