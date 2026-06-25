"""Logging setup with secret redaction.

Logs go to journald (stdout under systemd) and to a rotating file on the NVMe.
A filter scrubs anything that looks like a secret so tokens never hit disk.
"""

from __future__ import annotations

import logging
import re
from logging.handlers import RotatingFileHandler

from app.core.config import get_settings

# Patterns redacted from every log record's message.
_REDACT_PATTERNS = [
    re.compile(r"(api[_-]?key\"?\s*[:=]\s*\"?)([^\s\",}]+)", re.IGNORECASE),
    re.compile(r"(secret[_-]?key\"?\s*[:=]\s*\"?)([^\s\",}]+)", re.IGNORECASE),
    re.compile(r"(token\"?\s*[:=]\s*\"?)([^\s\",}]+)", re.IGNORECASE),
    re.compile(r"(password\"?\s*[:=]\s*\"?)([^\s\",}]+)", re.IGNORECASE),
    re.compile(r"(authorization:\s*bearer\s+)(\S+)", re.IGNORECASE),
]


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        for pat in _REDACT_PATTERNS:
            msg = pat.sub(r"\1***REDACTED***", msg)
        record.msg = msg
        record.args = ()
        return True


def setup_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(name)s | %(message)s")
    redactor = RedactingFilter()

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    stream = logging.StreamHandler()
    stream.setFormatter(fmt)
    stream.addFilter(redactor)
    root.addHandler(stream)

    try:
        settings.logs_dir.mkdir(parents=True, exist_ok=True)
        fileh = RotatingFileHandler(
            settings.logs_dir / "ledgerframe.log",
            maxBytes=5 * 1024 * 1024,
            backupCount=5,
        )
        fileh.setFormatter(fmt)
        fileh.addFilter(redactor)
        root.addHandler(fileh)
    except (OSError, PermissionError):
        root.warning("log directory not writable; logging to stdout only")

    # Quiet noisy libraries.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
