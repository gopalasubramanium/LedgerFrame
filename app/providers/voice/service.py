"""Voice service entrypoint.

Privacy posture (enforced):
- Disabled unless LEDGERFRAME_VOICE_ENABLED=true.
- Push-to-talk only by default; wake word is opt-in.
- No continuous recording: the loop idles until a push-to-talk trigger arrives.
- STT/TTS run locally (whisper.cpp/Vosk + Piper) — no audio leaves the device.

This module starts the service loop and degrades gracefully when audio
dependencies or devices are absent: it logs the reason and exits 0 so systemd
doesn't crash-loop. Full capture/transcribe wiring is documented in
docs/VOICE_SETUP.md and is intentionally a thin, swappable layer.
"""

from __future__ import annotations

import asyncio
import logging

from app.core.config import get_settings
from app.core.logging import setup_logging

log = logging.getLogger("ledgerframe.voice")


def _check_dependencies() -> tuple[bool, str]:
    try:
        import sounddevice  # noqa: F401
    except Exception:  # noqa: BLE001
        return False, "python 'sounddevice' not installed (pip install -e '.[voice]')"
    try:
        import sounddevice as sd

        if not sd.query_devices():
            return False, "no audio devices detected"
    except Exception as exc:  # noqa: BLE001
        return False, f"audio device query failed: {exc}"
    return True, "ok"


async def main() -> None:
    setup_logging()
    settings = get_settings()
    if not settings.voice_enabled:
        log.info("voice disabled (LEDGERFRAME_VOICE_ENABLED=false) — exiting cleanly")
        return

    ok, detail = _check_dependencies()
    if not ok:
        log.warning("voice unavailable: %s — exiting cleanly (touch UI unaffected)", detail)
        return

    log.info(
        "voice service ready: stt=%s tts=%s wakeword=%s (push-to-talk only)",
        settings.stt_provider, settings.tts_provider, settings.wakeword_enabled,
    )
    # Idle loop — push-to-talk requests are driven from the UI/API in a full build.
    # We never open a continuous recording stream here.
    stop = asyncio.Event()
    try:
        await stop.wait()
    except (KeyboardInterrupt, SystemExit):
        pass


if __name__ == "__main__":
    asyncio.run(main())
