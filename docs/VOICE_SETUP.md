# Voice Setup (optional, local-first)

Voice is **disabled by default** and is entirely optional — the touch/keyboard UI
is fully functional without a microphone.

## Privacy posture (enforced)

- Disabled unless `LEDGERFRAME_VOICE_ENABLED=true`.
- **Push-to-talk only** by default. No continuous recording. The service never
  opens a persistent capture stream.
- Wake word is **opt-in** (`LEDGERFRAME_WAKEWORD_ENABLED=true`) and local-only.
- Speech recognition is **local** (no cloud STT) unless you explicitly wire a cloud
  provider. A visible microphone state is always shown in the UI.

## Components (pluggable Protocols)

Defined in `app/providers/voice/base.py`:

- `SpeechToTextProvider` — preferred locals: **whisper.cpp** (tiny/base) or **Vosk**.
- `TextToSpeechProvider` — preferred local: **Piper**.
- `WakeWordProvider` — optional local provider only.

The service entrypoint `app/providers/voice/service.py` checks for audio deps and
devices and **no-ops cleanly** (exit 0) if they're absent, so systemd never
crash-loops and the rest of the app is unaffected.

## Install (Raspberry Pi 5)

```bash
# System audio + libraries
sudo apt install -y portaudio19-dev libsndfile1 alsa-utils

# Python voice extras
source .venv/bin/activate
uv pip install -e ".[voice]"      # vosk + sounddevice

# Text-to-speech (Piper) — download a voice model to the data dir
mkdir -p "$LEDGERFRAME_DATA_DIR/models/piper"
#   fetch a piper voice (e.g. en_US-lessac-medium) per Piper's docs

# Speech-to-text (choose one):
#   Vosk: download a small model (~50 MB) to $LEDGERFRAME_DATA_DIR/models/vosk
#   whisper.cpp: build whisper.cpp and place ggml-tiny.en.bin similarly
```

Enable in `.env`:

```ini
LEDGERFRAME_VOICE_ENABLED=true
LEDGERFRAME_STT_PROVIDER=vosk        # or whispercpp
LEDGERFRAME_TTS_PROVIDER=piper
LEDGERFRAME_WAKEWORD_ENABLED=false
```

Then:

```bash
sudo systemctl enable --now ledgerframe-voice
./scripts/doctor.sh     # audio device checks run when voice is enabled
```

## Voice flow (design)

1. Push-to-talk pressed → capture a short clip locally.
2. Transcribe locally (Vosk/whisper.cpp).
3. Show the transcript for confirmation.
4. Send the text to the grounded AI layer (`/api/v1/ai/chat`).
5. Display the answer; speak it via Piper **only if** speech output is enabled.
6. Cancel is available at any time.

## Status / limitation

v1 ships the Protocols, the privacy-safe service skeleton, configuration, and the
systemd unit. The end-to-end capture→transcribe→speak loop is intentionally a thin,
swappable layer and is listed under **Deferred features** in `docs/ASSUMPTIONS.md`.
Choosing whisper.cpp vs Vosk should be based on measured latency on your Pi 5.
