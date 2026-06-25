"""Pluggable voice provider Protocols.

Voice is optional, local-first, and privacy-conscious: push-to-talk by default,
no continuous recording, no cloud STT unless explicitly enabled. Concrete
implementations (whisper.cpp / Vosk for STT, Piper for TTS) are wired in
docs/VOICE_SETUP.md. These Protocols define the contract the service depends on.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class SpeechToTextProvider(Protocol):
    name: str
    is_local: bool

    async def transcribe(self, audio_pcm: bytes, sample_rate: int) -> str: ...


@runtime_checkable
class TextToSpeechProvider(Protocol):
    name: str

    async def synthesize(self, text: str) -> bytes: ...  # returns WAV/PCM bytes


@runtime_checkable
class WakeWordProvider(Protocol):
    name: str

    async def detect(self, audio_pcm: bytes, sample_rate: int) -> bool: ...
