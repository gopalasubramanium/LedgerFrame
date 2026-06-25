# LedgerFrame — Security & Threat Model

LedgerFrame is designed to keep personal financial data private and local. This
document describes the security posture, the threat model, and the controls in
place.

## Principles

- **Local-first, no telemetry.** No analytics SDKs, no third-party trackers, no
  outbound calls except to the market/AI providers you explicitly configure.
- **Localhost by default.** The API binds to `127.0.0.1`. LAN access is opt-in
  (`LEDGERFRAME_ALLOW_LAN=true`) and is *refused* unless a PIN is set.
- **Data stays on device.** Portfolio data is never sent off-device by default.
  The Hailo AI runs locally. The OpenAI-compatible provider is off unless you set
  a base URL, and the UI warns that it transmits data off-device.

## Threat model

| Asset | Threat | Control |
|-------|--------|---------|
| Portfolio data (DB) | Local theft of device/disk | NVMe is yours to encrypt (LUKS recommended); backups encrypted with `age`; data dir `0700`; DB file `0600` |
| Secrets (API keys) | Leak via repo, logs, or API | `.env` git-ignored; `.env.example` only; log redaction filter; settings API has a key allow-list that excludes secrets |
| Unauthorised local use | Someone walks up to the display | Argon2 PIN, auto-lock after inactivity, lock screen blocks the UI |
| Unauthorised mutation | CSRF / unwanted writes over LAN | Mutations require a signed, time-limited session token (HttpOnly, SameSite=strict cookie); LAN requires PIN |
| Malicious CSV | Formula injection / resource exhaustion | Size cap (5 MB), row cap (20k), cells with `= + - @` neutralised on import and export |
| XSS / injection in UI | Script injection | Strict CSP (`script-src 'self'`), `X-Content-Type-Options`, `X-Frame-Options: DENY`, no `dangerouslySetInnerHTML` |
| Supply-chain | Compromised dep | Pinned ranges, no auto-update; manual `update.sh` only |

## Authentication

- A single local **PIN** (min 4 digits) hashed with **Argon2** (`argon2-cffi`).
- Sessions are signed tokens (`itsdangerous`, app secret) with a max age equal to
  the auto-lock window; delivered as an HttpOnly, SameSite=strict cookie.
- Failed unlocks are recorded in `audit_events` (no secret material stored).
- When no PIN is set, a fresh **local** install is unlocked for convenience; LAN
  access without a PIN is hard-blocked.

## Secrets management

- Secrets live in `.env` (root/owner-readable, `0600`) or the environment — never
  in the database or the repo. `LEDGERFRAME_SECRET_KEY` is generated at install.
- The settings API (`PUT /api/v1/settings`) writes only an allow-listed set of
  display/preference keys and **cannot** read or write API keys.
- The logging subsystem (`app/core/logging.py`) redacts `api_key`, `secret`,
  `token`, `password`, and `Authorization: Bearer` patterns from every record.

## Network

- Default bind `127.0.0.1:8321`. Optional LAN bind (`0.0.0.0`) only when
  `LEDGERFRAME_ALLOW_LAN=true` **and** a PIN exists.
- Security headers on every response: CSP, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` (camera/geo denied; microphone self only).
- CORS is enabled only in `development` for the Vite dev origin.

## Backups

- `app/services/backup.py` makes a consistent SQLite snapshot (online backup API),
  then **encrypts it with `age`** before writing, when a recipient is configured
  (`LEDGERFRAME_BACKUP_AGE_RECIPIENT`). Files are `0600` and SHA-256 recorded.
- Restore verifies existence, refuses to overwrite a live DB without `--force`,
  and keeps a pre-restore safety copy.

## Hardware safety

- The installer **never** formats, repartitions, or modifies the NVMe filesystem.
  It validates that the data dir exists and is writable, and aborts otherwise.

## What is intentionally NOT here (v1)

- No bank/broker credential storage; no Plaid-style account aggregation.
- No trading, order placement, or financial advice.
- No remote/unattended code updates.

## Reporting

This is a personal, self-hosted project. If you adapt it and find a vulnerability,
treat the data dir and `.env` as the crown jewels and rotate `LEDGERFRAME_SECRET_KEY`
and any provider keys if exposure is suspected.
