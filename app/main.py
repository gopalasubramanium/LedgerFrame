"""LedgerFrame FastAPI application entrypoint.

Serves the API under /api/v1, exposes /health, and (in production) serves the
built frontend from ``frontend/dist``. Binds to localhost by default; LAN binding
requires explicit configuration AND a PIN (enforced in the auth layer).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.base import Base, get_engine, get_sessionmaker

log = logging.getLogger("ledgerframe")

# Content-Security-Policy tuned for a local SPA + ECharts (canvas). 'unsafe-inline'
# is limited to styles; scripts are same-origin only.
_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "font-src 'self' data:; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging()
    settings.ensure_dirs()

    # Create tables (Alembic is provided for migrations; create_all bootstraps fresh installs).
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed demo data when in demo/mock mode and the DB is empty.
    if settings.is_demo:
        from app.seed.demo import seed_demo_data

        async with get_sessionmaker()() as session:
            try:
                if await seed_demo_data(session):
                    await session.commit()
                    log.info("seeded demo data")
            except Exception as exc:  # noqa: BLE001
                await session.rollback()
                log.warning("demo seed skipped: %s", exc)

    log.info("LedgerFrame %s ready (demo=%s, ai=%s)", __version__, settings.is_demo, settings.ai_enabled)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="LedgerFrame",
        version=__version__,
        description="Local-first personal financial intelligence display",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    # CORS: only needed for the Vite dev server. Production is same-origin.
    if settings.env == "development":
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(self)"
        response.headers["Content-Security-Policy"] = _CSP
        return response

    @app.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "version": __version__})

    app.include_router(api_router)

    # Serve the built SPA in production. The dev server handles this in development.
    dist = settings_static_dir()
    if dist is not None:
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa(full_path: str):
            # API + docs are matched first by FastAPI; everything else returns index.html
            # so client-side routing works.
            candidate = dist / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app


def settings_static_dir():
    from pathlib import Path

    dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    return dist if (dist / "index.html").exists() else None


app = create_app()


def run() -> None:
    """Console-script entrypoint: ``ledgerframe``."""
    import uvicorn

    settings = get_settings()
    host = settings.api_host
    if settings.allow_lan:
        host = "0.0.0.0"  # noqa: S104 — explicit, gated by allow_lan + PIN
    uvicorn.run("app.main:app", host=host, port=settings.api_port, log_level=settings.log_level.lower())


if __name__ == "__main__":
    run()
