.PHONY: install run dev test lint format
install:
	python3 -m pip install -e '.[dev]'
	npm install
run:
	.venv/bin/uvicorn prism.server:app --reload --port 8000
dev:
	npm run dev
test:
	pytest
lint:
	ruff check .
format:
	ruff format .
