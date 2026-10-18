# Build the React app separately so the browser receives only the production bundle.
FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PRISM_DIST_DIR=/app/dist \
    PRISM_DEV=0
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .
COPY --from=frontend /build/dist ./dist
RUN useradd --create-home --uid 10001 prism && chown -R prism:prism /app
USER prism
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn prism.server:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000}"]
