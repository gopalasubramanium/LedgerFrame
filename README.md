<!-- RATIFIED 2026-07-14 (release-readiness Gate B5, owner-signed).
     Every claim here is true of THIS repo as it stands. Nothing aspirational.
     Where something is not built yet, it says so. The "Tested on" table lists only
     machines the suites have actually run clean on — a row there is a promise. -->

# LedgerFrame

A **single-user, local-first wealth-reporting appliance**. It consolidates your (and your household's)
holdings across accounts, instruments and currencies into one private picture — net worth, portfolio
analytics, allocation and policy drift, liquidity and cash runway, realised/unrealised P/L, insurance
and estate readiness.

**It reports; it does not act.** It never executes trades, never advises, and never fabricates a
number. If it cannot get a figure, it shows an em dash and tells you why.

**Your data lives on your machine.** No cloud account, no telemetry, no sign-up. Nothing is stored
anywhere but your own disk.

*What LEAVES the device is a separate question, and it is yours to answer.* Prices, news and AI each
require a provider you choose and configure — and a remote AI provider, by definition, sends figures
off-device (the app says so at the point you enable one). **With no-egress on, none of that happens:
the device makes ZERO outbound calls.**

---

## Posture: yours, not ours

**Privacy, network egress, and exposure are your choice — the platform imposes no posture of its own.**
Its job is to honour the posture you choose, faithfully. Some choices are enforced **structurally and
absolutely**: **no-egress means ZERO outbound calls**, enforced at a single choke point a provider
*physically cannot bypass*. Others are delivered **best-effort, and say so plainly.** You are never left
guessing which kind you are relying on.

---

## Before you install: what this is, and what it is not

- **Single user.** There is no multi-user model, no permissions, no account isolation. It is built for
  one person (and their household's data), on their own machine. **Do not put it on a shared box.**
- **Local by default.** It listens on `127.0.0.1`. Access from other devices is off unless you turn it
  on, and remote access is expected to go over a VPN — the app does not terminate TLS itself.
- **Not everything is built.** v2 ships the pages under *What's built* below; the rest of the roadmap
  is public and honest about what is missing.

---

## Install

```bash
git clone <repo-url> ledgerframe && cd ledgerframe
./scripts/install.sh
```

`install.sh` is a guided, idempotent wizard. It asks where your data should live, whether to run the
kiosk display, whether to allow LAN access, and whether to start with demo data. Every question has a
default, and you can see exactly what it would do without doing it:

```bash
./scripts/install.sh --dry-run        # change nothing; print every step
./scripts/install.sh --yes            # accept all defaults, no questions
./scripts/install.sh --help           # every flag
```

**It never formats, partitions or erases a disk.** It creates a folder on a drive you already have.

### Requirements

| | |
|---|---|
| **Python** | 3.12 or newer |
| **Node** | **20.19+ or 22.12+** — the build toolchain's own floor, pinned in `.nvmrc` and `frontend/package.json`. **Node is optional at install time:** a prebuilt dashboard ships in the repo, and you only need Node if you want to rebuild the frontend yourself. |
| **OS / arch** | See **Tested on**, below. |

### Tested on

| OS | Arch | Python | Node | Suites clean |
|---|---|---|---|---|
| Zorin OS 18.1 (Ubuntu-based) | x86-64 | 3.12.3 | 24.14.0 | 2026-07-14 |

**That is the whole list, and it is the whole claim.** Other platforms may well work — including other
Ubuntu derivatives — but **we have not run the suites on them, so we do not say that we have.** If you
run it somewhere else successfully, tell us and it will be added once it has been verified.

---

## First boot

**Your instance starts EMPTY.** LedgerFrame does not invent a portfolio for you.

If you want to look around first, ask for the demo explicitly:

```bash
./scripts/install.sh --demo-mode      # seeds a synthetic sample portfolio
```

Demo data is badged in the UI so you cannot mistake it for your own. Without `--demo-mode` nothing is
seeded — even though the default price provider is the offline `mock` one. *(Mock **prices** and a
seeded **portfolio** are two different things. Only one of them puts numbers in your database that you
did not enter.)*

**Set a PIN.** The app does not force one on a loopback-only install, and it will not nag you forever —
but it is the only thing between your net worth and anyone who can reach the port. **If you enable LAN
access, a PIN is mandatory.**

---

## Where your data lives

One place, and one answer to the question:

```bash
grep LEDGERFRAME_DATA_DIR .env      # this is the answer. Every script honours it.
```

Inside it: `db/` (your SQLite database), `backups/`, `cache/`, `imports/`, `logs/`.

**Everything you own is in that folder.** To move LedgerFrame to another machine, copy it.

## Backup, restore, moving your data

```bash
./scripts/backup.sh                          # timestamped snapshot into <data-dir>/backups/
./scripts/restore.sh <backup-filename>       # restore one (takes a safety copy of the current DB first)
```

Backups can be encrypted with `age`. `restore.sh` verifies a backup's SHA-256 before trusting it.

## Upgrading

```bash
./scripts/update.sh
```

**The upgrade policy, stated plainly:**

- **Migrations are forward-only. There is no supported downgrade.** Once a migration has run, your
  backup *is* the way back — there is no other one.
- Because of that, **`update.sh` refuses to run without a fresh backup.** It takes one itself; if that
  fails, it **stops** rather than migrating your data with nothing to undo it with.
- You can override that, but you have to say so out loud: `./scripts/update.sh --no-backup`.

## Health check

```bash
./scripts/doctor.sh      # read-only: checks the data dir, services, hardware. Changes nothing.
```

## Uninstall

```bash
./scripts/uninstall.sh   # removes the services. NEVER touches your data dir or your backups.
```

---

## Privacy

- **No telemetry, no accounts, no phone-home.** There is no analytics of any kind.
- **No-egress mode** makes the device make **zero** outbound calls — no prices, no news, no version
  check, no AI. Not *fewer*: zero. It is enforced at the single choke point through which every HTTP
  client in the codebase must be created, and the build fails if any code tries to bypass it. The full
  call-site inventory is in [`docs/specs/SECURITY-BASELINE.md`](docs/specs/SECURITY-BASELINE.md).
- **Your API keys** (market data, broker, AI) live only in `.env` on your machine, mode `0600`. They are
  never written to the database and never logged.

## Security

The security posture — **including what it does not do** — is written down honestly in
[`docs/specs/SECURITY-BASELINE.md`](docs/specs/SECURITY-BASELINE.md). Read it before exposing the app to
anything. To report a vulnerability, see [`SECURITY.md`](SECURITY.md).

---

## What's built

**In v2.0:** Home · Net worth · Portfolio · Holdings · Markets · Heatmap · News · Review ·
Pricing Health.

**Not yet built** — and visibly marked as such in the app rather than quietly missing: Accounts, Policy,
Cash flow, Scenarios, Insurance, Estate, Reports, Settings.

Roadmap: [`ROADMAP.md`](ROADMAP.md).

---

## Licence

**AGPL-3.0-or-later** — [`LICENSE`](LICENSE) for the full text, [`NOTICE`](NOTICE) for third-party
attributions.

If you run a modified version as a network service, the AGPL requires you to offer its source to your
users. That is deliberate.

Contributions require a Contributor Licence Agreement (see `docs/audit/CLA-OPTIONS.md`). **It is not
finalised yet, so contributions are not being accepted.**

---

## Development

The above is for *using* LedgerFrame. To work on it:

```bash
uv venv .venv && uv pip install -e '.[dev]'   # backend deps
( cd frontend && npm install )                # frontend deps
make dev                                      # backend (:8321) + frontend (:5173); Ctrl+C stops both
```

On first run `make dev` writes a **development** `.env` — data dir under your home, never `/mnt`, with a
generated secret key — and says so. It does not touch a real deployment's `.env`.

> The frontend proxies to the backend, so **both must be running**. `make dev` starts both.

```bash
make test                          # backend suite
make lint                          # ruff
make api-contract-check            # fail if the frozen OpenAPI contract is stale
make migrate                       # alembic upgrade head
( cd frontend && npm run check )   # lint · typecheck · design-token drift · unit · Playwright
python scripts/license_audit.py    # dependency-licence audit (full transitive graph)
```

The specifications in `docs/specs/` are normative: `PRODUCT-SPEC.md` (the seven Product Guarantees),
`GLOSSARY.md`, `INFORMATION-ARCHITECTURE.md`, `DESIGN-SYSTEM.md`, `MASTER-DATA.md`, `API-CONTRACT.md`,
`SECURITY-BASELINE.md`.
