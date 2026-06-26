"""Guard: .env.example must be parseable by systemd's EnvironmentFile.

systemd does NOT strip trailing inline comments (`KEY=value  # note`) — it feeds
the whole thing as the value, which broke startup on a real Pi. Every value line
must therefore have no trailing inline comment.
"""

from __future__ import annotations

import re
from pathlib import Path

ENV_EXAMPLE = Path(__file__).resolve().parents[2] / ".env.example"
_BAD = re.compile(r"^LEDGERFRAME_[A-Z0-9_]+=[^\s#]*\s+#")


def test_env_example_has_no_trailing_inline_comments():
    offenders = [
        line.rstrip("\n")
        for line in ENV_EXAMPLE.read_text().splitlines()
        if _BAD.match(line)
    ]
    assert not offenders, (
        "These .env.example lines have trailing inline comments that systemd would "
        "treat as part of the value:\n  " + "\n  ".join(offenders)
    )


def test_env_example_values_parse_cleanly():
    for line in ENV_EXAMPLE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        assert "=" in line, f"non-comment line without '=': {line!r}"
        key, _, value = line.partition("=")
        assert key.startswith("LEDGERFRAME_"), f"unexpected key: {key!r}"
        # No value should contain an un-quoted ' #' (would be a smuggled comment).
        assert " #" not in value, f"value for {key} looks like it has an inline comment: {value!r}"
