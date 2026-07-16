# SPDX-License-Identifier: AGPL-3.0-or-later
"""LedgerFrame FastAPI application entrypoint.

Serves the API under /api/v1, exposes /health, and (in production) serves the
built frontend from ``frontend/dist``. Binds to localhost by default; LAN binding
requires explicit configuration AND a PIN (enforced in the auth layer).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.base import get_sessionmaker

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


class SecurityHeadersMiddleware:
    """Pure-ASGI middleware that adds security headers to every HTTP response.

    Implemented at the ASGI layer (not Starlette's BaseHTTPMiddleware) to avoid the
    anyio task-group overhead/edge cases of the latter under heavy requests.
    """

    _HEADERS = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"referrer-policy", b"no-referrer"),
        (b"permissions-policy", b"geolocation=(), camera=(), microphone=(self)"),
        (b"content-security-policy", _CSP.encode()),
    ]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = message.setdefault("headers", [])
                existing = {k.lower() for k, _ in headers}
                for key, value in self._HEADERS:
                    if key not in existing:
                        headers.append((key, value))
            await send(message)

        await self.app(scope, receive, send_wrapper)


_PLACEHOLDER_SECRET = "change-me-to-a-long-random-string"


def _secret_key_is_weak(key: str) -> bool:
    key = (key or "").strip()
    return not key or key == _PLACEHOLDER_SECRET or len(key) < 32


def _enforce_secret_key(settings) -> None:
    """§1.4 — a weak/placeholder/short secret key is a warning on a loopback-only bind, but
    a hard refusal to start when the app is reachable beyond loopback."""
    if not _secret_key_is_weak(settings.secret_key):
        return
    how = ('Generate one: python -c "import secrets;print(secrets.token_urlsafe(48))" '
           "and set LEDGERFRAME_SECRET_KEY.")
    if settings.lan_exposed:
        raise RuntimeError(
            "Refusing to start: LEDGERFRAME_SECRET_KEY is missing, the placeholder, or "
            f"shorter than 32 characters, while the app is reachable beyond loopback. {how}"
        )
    log.warning("SECURITY: weak LEDGERFRAME_SECRET_KEY (placeholder/short) — tolerated on a "
                "loopback-only bind, but set a strong one before any LAN/remote exposure. %s", how)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging()
    _enforce_secret_key(settings)
    settings.ensure_dirs()

    # Single schema authority (§2.1): bring the DB to head via Alembic. This adopts an
    # existing create_all-bootstrapped DB and applies any pending migrations. create_all is
    # used only by the test fixtures now.
    from app.db.migrate import run_migrations

    run_migrations(log=log.info)

    # Seed the demo portfolio ONLY when it was explicitly asked for (RD-8 / Gate A4). This used to
    # key off `settings.is_demo` — i.e. market_provider == "mock", which is the SHIPPED DEFAULT — so a
    # clean first boot handed a stranger a synthetic net worth. Mock PRICES and a seeded PORTFOLIO are
    # different decisions; only one of them invents the user's money.
    if settings.demo_seed:
        from app.seed.demo import seed_demo_data

        async with get_sessionmaker()() as session:
            try:
                if await seed_demo_data(session):
                    await session.commit()
                    log.info("seeded demo data")
            except Exception as exc:  # noqa: BLE001
                await session.rollback()
                log.warning("demo seed skipped: %s", exc)

    # Load cached ECB reference FX into the in-process map (used only as an FX
    # fallback when the provider can't serve a pair). Best-effort; never fatal.
    try:
        from app.services import ecb_fx

        async with get_sessionmaker()() as session:
            loaded = await ecb_fx.load_from_db(session)
        if loaded:
            log.info("loaded %d ECB reference FX rates", loaded)
    except Exception as exc:  # noqa: BLE001
        log.warning("ECB FX load skipped: %s", exc)

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

    app.add_middleware(SecurityHeadersMiddleware)
    # Outermost: assign a request id before anything else runs, so all logs correlate.
    from app.core.observability import RequestContextMiddleware

    app.add_middleware(RequestContextMiddleware)

    @app.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "version": __version__})

    @app.get("/.well-known/security.txt", include_in_schema=False)
    async def security_txt() -> PlainTextResponse:
        """RFC 9116 security contact (§1.8). Served before the SPA catch-all."""
        from datetime import UTC, datetime, timedelta

        expires = (datetime.now(UTC) + timedelta(days=180)).strftime("%Y-%m-%dT%H:%M:%SZ")
        body = (
            "Contact: https://github.com/gopalasubramanium/LedgerFrame/security/advisories/new\n"
            "Policy: https://github.com/gopalasubramanium/LedgerFrame/blob/main/SECURITY.md\n"
            f"Expires: {expires}\n"
            "Preferred-Languages: en\n"
        )
        return PlainTextResponse(body, media_type="text/plain; charset=utf-8")

    # Router-wide read gate (§1.1): when a PIN is set, data-bearing endpoints require a
    # valid session. No PIN → open, as before. Auth endpoints stay reachable (see deps).
    from app.api.deps import require_read_auth

    app.include_router(api_router, dependencies=[Depends(require_read_auth)])

    # Prometheus metrics (§2.3), gated like the rest: loopback or an authenticated session.
    from app.api.deps import require_metrics_access

    @app.get("/metrics", include_in_schema=False, dependencies=[Depends(require_metrics_access)])
    async def metrics_endpoint() -> PlainTextResponse:
        from app.core.metrics import render

        return PlainTextResponse(render(), media_type="text/plain; version=0.0.4; charset=utf-8")

    # The Reports Pack — the one sanctioned print/export artifact (D-038/D-061; reports-pack §3b).
    # A backend-composed, self-contained HTML document (inline CSS, no app JS, no external fetch —
    # Pack-9). Registered HERE, BEFORE the SPA catch-all below, so the catch-all never shadows it.
    # Access follows the platform read posture (`require_read_auth`, the same router-wide gate the
    # API uses) — no bespoke one-route guard (Pack-9). It is IN the OpenAPI schema (the +1 contract
    # path), unlike /metrics and the SPA catch-all.
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.api.deps import get_db

    @app.get("/reports/pack", response_class=HTMLResponse, tags=["reports"],
             dependencies=[Depends(require_read_auth)])
    async def reports_pack(session: AsyncSession = Depends(get_db)) -> HTMLResponse:
        from app.services.reports_pack import render_reports_pack

        return HTMLResponse(await render_reports_pack(session))

    # Serve the built SPA in production. The dev server handles this in development.
    dist = settings_static_dir()
    if dist is not None:
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa(full_path: str):
            # API + docs are matched first by FastAPI; everything else returns index.html
            # so client-side routing works.
            #
            # …EXCEPT an unmatched /api/ path (page-home §9-4). Without this guard the catch-all
            # answers a RETIRED or misspelled endpoint with `index.html` and **200 OK** — so a
            # client cannot tell "this endpoint is gone" from "this endpoint is fine", and a
            # contract deletion is unobservable. An API path that no route claims is an honest
            # JSON 404 (Guarantee 3: never answer with something you did not mean).
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not Found")
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
