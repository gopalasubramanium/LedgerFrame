"""Best-effort service control via the scoped root helper.

Used after in-process config changes (data source, base currency) to make the
**worker** process pick up the new environment. Restarting only the worker is
safe from inside an API request — restarting the API itself would drop the very
response we're trying to return (that's what the user-facing "Restart services"
button does, and why it runs detached).
"""

from __future__ import annotations

import asyncio
import os

_ADMIN_BIN = "/usr/local/sbin/ledgerframe-admin"


async def restart_worker() -> bool:
    """Restart the background worker so it reloads settings/providers. No-op (and
    never raises) when the helper isn't installed (dev/Docker)."""
    if not os.path.exists(_ADMIN_BIN):
        return False
    try:
        proc = await asyncio.create_subprocess_exec(
            "sudo", "-n", _ADMIN_BIN, "restart-worker",
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.communicate(), timeout=30)
        return proc.returncode == 0
    except Exception:  # noqa: BLE001
        return False
