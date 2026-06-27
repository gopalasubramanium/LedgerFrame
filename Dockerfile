# LedgerFrame container — runs on any machine (Pi or not; AI HAT optional).
# Multi-stage: build the SPA with Node, then a slim Python runtime serves API+UI.

# --- Stage 1: build the frontend ---
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund || npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python runtime ---
FROM python:3.12-slim
WORKDIR /app

# Build deps for argon2/cffi wheels, then trimmed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libffi-dev curl \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md alembic.ini ./
COPY app ./app
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN pip install --no-cache-dir -e .

ENV LEDGERFRAME_ENV=production \
    LEDGERFRAME_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8321

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS http://127.0.0.1:8321/health || exit 1

# Bind 0.0.0.0 so the published port is reachable; auth still gates mutations.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8321"]
