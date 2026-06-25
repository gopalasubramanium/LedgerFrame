# Assumptions

Recorded per the build brief. These are the sensible defaults chosen where the
spec left room, plus environmental notes.

## Hardware / OS
- Target is a Raspberry Pi 5 (16 GB) with the AI HAT+ 2 (Hailo-10H, 8 GB) on the
  reserved PCIe lane, and a **USB 3** NVMe for data. We assume the NVMe is already
  partitioned, formatted, and mounted by the operator; the installer only validates
  writability and **never** formats/repartitions it.
- This repository was developed and validated on an x86_64 Linux dev box. All code
  is portable; the Pi-/Hailo-specific paths are guarded and degrade gracefully when
  absent (confirmed via `doctor.sh`). A hardware verification report on real Pi 5
  hardware should be produced at deployment time — `doctor.sh` generates it.

## Data location
- Default data dir `/mnt/ledgerframe-data`, overridable via `LEDGERFRAME_DATA_DIR`.
  All mutable state (SQLite DB, cache, imports, logs, backups, generated audio)
  lives there.

## Market data
- **Default is DEMO mode** (`mock` provider): synthetic but realistic, deterministic
  per symbol, labelled DEMO everywhere and entitlement `delayed`. No key/network.
- A `csv` provider reads `<imports>/<SYMBOL>.csv` (`date,open,high,low,close,volume`)
  for local-only/offline use, labelled `end-of-day`.
- One opt-in external adapter is included as a worked example (**Alpha Vantage**),
  chosen because it has a documented free tier; it is **off** unless configured and
  labels quotes `delayed`. We do **not** claim real-time entitlement for it. See
  `DATA_SOURCES.md`. No financial website is ever scraped.
- Base currency defaults to **SGD**, timezone **Asia/Singapore** (per the user's
  locale signals); both are configurable. Supported: SGD, USD, INR, EUR, GBP, JPY,
  AUD, CNY, HKD.

## AI
- `hailo-ollama` is expected at `http://127.0.0.1:8000`. Models are discovered at
  runtime via `/hailo/v1/list`; **no model package version is hard-coded**. The
  client auto-selects the smallest instruct model (target 1–2B) unless
  `LEDGERFRAME_AI_MODEL` is set.
- If you must install a model package, set the local `.deb`/model-zoo path yourself
  (documented in `DATA_SOURCES.md`); we don't fetch models automatically.
- AI is **disabled-safe**: with no NPU/service, the assistant returns deterministic,
  fact-only answers. The LLM never computes financial values.

## Cost basis & valuation
- **FIFO** cost basis by default; fees are added to the lot cost. Splits scale open
  lots; dividends/interest accrue as income (not basis). Realised P/L is tracked
  per the FIFO consumption order.
- Manual assets (cash, FD, property, private) use a `manual_value`; liabilities are
  signed negative toward net worth. Manual/illiquid assets support a price override.

## Security
- Single local PIN (Argon2). No multi-user accounts in v1. LAN access requires a PIN.
- Backups use `age` when a recipient is configured; otherwise they are left
  unencrypted locally with a warning.

## Voice
- Voice is **off by default**, push-to-talk only, fully local (whisper.cpp/Vosk +
  Piper). The service ships as a privacy-preserving skeleton that no-ops cleanly
  when audio deps/devices are absent. Full capture/transcribe wiring is documented
  in `VOICE_SETUP.md` and is a deliberate, swappable layer (see Deferred features).

## Deferred to a later version
- Live external news (demo returns synthetic headlines), per-instrument note editing
  UI, cross-asset correlation matrix (omitted until enough history exists — and
  correlation ≠ causation), full end-to-end voice capture loop, multi-account
  transfer reconciliation, and cash-runway forecasting (needs recurring-expense
  data not modelled in v1).
