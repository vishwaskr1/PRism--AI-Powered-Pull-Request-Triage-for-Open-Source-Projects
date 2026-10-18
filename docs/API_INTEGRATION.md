# GitHub API integration

The client uses GitHub REST API v3 endpoints for repository metadata, open pull requests, individual pull requests, changed files and contents on the default branch. It limits the number of requests and files, follows no redirects, uses a fixed API host, bounds network timeouts, and caps JSON response bodies at 2 MB. Transient network/timeouts and selected 5xx responses receive at most three attempts. 401, 404, and rate limits map to user-safe domain errors.

Only `https://github.com/{owner}/{repo}` is accepted. No arbitrary URL is fetched. Guide lookup currently checks `CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, and `docs/CONTRIBUTING.md`; missing files are normal. GitHub API patch omissions and truncated changed-file lists are explicit limitations. An optional read-only GitHub token may be set in the backend environment to raise API limits. The token is not accepted or changed through a browser endpoint.

See GitHub's [REST API rate limit documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) and [rate limit troubleshooting guidance](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) for current behavior.
