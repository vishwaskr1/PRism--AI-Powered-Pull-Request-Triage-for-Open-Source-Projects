# MVP scope

The current MVP includes a responsive React/Vite landing page, a dashboard route, a FastAPI backend, public GitHub repository retrieval, deterministic guideline/relevance/overlap checks, evidence validation, sample mode, an optional category filter, and optional local Ollama explanations.

The dashboard lists fetched pull requests and analyzes one selected PR at a time; only a single-PR repository is analyzed automatically. Ollama is partial and not available on the hosted service. No labeled evaluation data or published results are available. Accounts, databases, paid AI providers, private repositories, repository writes, code execution, and automated merge or moderation decisions are out of scope.

Accuracy and performance claims should wait until a labelled evaluation set has been run and its method and results are published.
