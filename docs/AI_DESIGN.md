# Local AI design

PRism uses Ollama only, and AI is optional. Deterministic checks run independently and remain available when Ollama is disabled, unreachable, or returns invalid output. The dashboard defaults AI off.

When enabled, the service sends a bounded set of pull-request fields, contribution-guide text, and file patches to the Ollama server configured on localhost. Model output must cite one of those retrieved sources; the citation and any excerpt are validated against the source before the finding is shown. AI findings remain advisory and require human review.

No cloud-model provider or AI API key configuration is included. Keep the Ollama endpoint on loopback; configuration rejects non-local hostnames and non-HTTP schemes.
