# ── FastAPI — development image ────────────────────────────────────────────
# Uses uv for fast, reproducible installs (matches the project's uv.lock).
# The image is intentionally lean: no build tools, no dev headers.

FROM python:3.12-slim AS base

# uv — the project uses it for dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# ── System deps (psycopg2 needs libpq) ────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
 && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ────────────────────────────────────────────────────
# Copy only the dependency manifest first — Docker caches this layer until
# pyproject.toml or uv.lock changes, skipping the full install on code-only edits.
COPY api/pyproject.toml api/uv.lock ./api/

# uv export reads uv.lock and emits a PEP 508 requirements file;
# pip installs that into the system Python so all binaries land in
# /usr/local/bin/ — no venv, no PATH gymnastics needed.
RUN cd /app/api && \
    uv export --frozen --no-dev -o /tmp/requirements.txt && \
    pip install --no-cache-dir -r /tmp/requirements.txt

# ── Application source ─────────────────────────────────────────────────────
# Copied here, but in docker-compose dev mode the directory is bind-mounted
# so local changes are reflected without a rebuild.
COPY api/ ./api/
COPY migrations/ ./migrations/
COPY alembic.ini ./

ENV PYTHONPATH=/app/api
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "index:app", "--host", "0.0.0.0", "--port", "8000"]
