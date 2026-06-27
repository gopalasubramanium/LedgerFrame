# Getting LedgerFrame seen — launch & growth playbook

Concrete, ready-to-use material. Adapt the drafts, keep claims honest (it's
local-first, not real-time, not financial advice), and never spam.

## 0. One-line positioning
> **LedgerFrame** — a private, local-first "wealth desk" for Raspberry Pi (or any
> machine / Docker): portfolio & net-worth tracking, benchmarked analytics, world
> markets, and **grounded** on-device AI. Your data never leaves the device.

Keywords to weave in (SEO): *self-hosted portfolio tracker, Raspberry Pi finance
dashboard, net worth tracker, local-first, privacy, Hailo AI, on-device LLM, FIRE,
personal finance, open source, Docker.*

## 1. GitHub hygiene (do first — this is your SEO foundation)
- ✅ Clear **description** + **homepage** + **topics** (already set; keep refining).
- ✅ Strong README with screenshots (done). Add a short **demo GIF** at the top — it
  dramatically lifts click-through. Record the rotation + Ask panel (e.g. with
  `peek`/`asciinema`→gif or OBS), save to `docs/screenshots/demo.gif`, embed in README.
- Add a **social preview image** (Settings → General → Social preview on GitHub;
  1280×640 PNG of the home dashboard) — this is what shows on Reddit/X/Slack/LinkedIn.
- Cut a **release** (v1.0.0) with notes (see CHANGELOG.md) — releases rank and notify.
- Add a **LICENSE** (done), `CONTRIBUTING.md`, and good first issues to invite help.
- Pin the repo on your profile; enable Discussions.

## 2. Where to post (highest signal first)
- **r/selfhosted** — perfect fit (privacy, self-hosted, runs in Docker). 
- **r/raspberry_pi** — the hardware angle + screenshots.
- **Raspberry Pi Forums** → *Projects and showcase*: <https://forums.raspberrypi.com/viewforum.php?f=144>.
- **Hacker News** — "Show HN". Post ~weekday morning ET; reply to every comment.
- **r/HailoAI / r/LocalLLaMA** — the on-device, grounded-AI (no fabrication) angle.
- **Lobsters**, **r/f" + personalfinance / Bogleheads forum** (be careful: read rules;
  frame as a tool, not advice), **r/FIRE**, **DEV.to / Hashnode** (write-up).
- **Awesome lists** PRs: awesome-selfhosted, awesome-raspberry-pi, awesome-fintech.
- **X/LinkedIn/Mastodon (#selfhosted #raspberrypi #opensource)** with the GIF.
- Product directories: **AlternativeTo**, **Slant**, **libhunt**.

## 3. Draft — Reddit (r/selfhosted)
> **Title:** LedgerFrame — a local-first, self-hosted wealth dashboard for Raspberry Pi (or Docker), with on-device grounded AI
>
> I built an always-on personal finance display that keeps everything on your own
> hardware. Portfolio + net-worth tracking, FIFO cost basis, benchmarked performance,
> world markets, free RSS news, and an AI "Ask" that only explains *computed* facts
> (it never makes up numbers — and runs on a local Hailo/Ollama model, or falls back
> to deterministic answers). No telemetry, localhost by default, encrypted backups.
> Runs on a Pi 5 kiosk, but also any Linux/macOS box or `docker compose up`.
> MIT-licensed. Screenshots + repo: <link>. Honest caveat: it's not real-time and
> free market-data tiers are limited — it's transparent about both.

## 4. Draft — Hacker News (Show HN)
> **Show HN: LedgerFrame – local-first wealth dashboard for Raspberry Pi with grounded on-device AI**
>
> It's a self-hosted financial display: deterministic Decimal engine (FIFO, net worth,
> risk stats), pluggable market data (demo/CSV/Alpha Vantage), and an AI layer that is
> only allowed to explain pre-computed, timestamped facts — no fabricated quotes or
> numbers, and it runs locally (Hailo NPU / Ollama) or degrades to templates. Native
> systemd or Docker. I'd love feedback on the grounding approach and the data-honesty
> design (unavailable shows "—", never a fake price). <link>

## 5. Draft — Raspberry Pi Forums (Projects and showcase)
> **LedgerFrame: a private, always-on financial dashboard for the Pi 5 (+ AI HAT+ optional)**
>
> Turns a Pi 5 + screen into a desk "wealth display" — portfolio, net worth,
> benchmarked performance, global markets, news, and a grounded local-AI assistant
> using the Hailo AI HAT+ (optional). One-command guided installer (never formats your
> drives), kiosk mode, encrypted backups, fully local. Also runs in Docker on any box.
> Open source (MIT). Build notes, install guide and screenshots: <link>. Happy to
> answer questions.

## 6. Draft — X / LinkedIn
> Built LedgerFrame: a private, local-first "wealth desk" for Raspberry Pi 🧮📈
> • Portfolio, net worth, benchmarked analytics, world markets, news
> • On-device grounded AI (no fabricated numbers) via Hailo/Ollama
> • No telemetry · encrypted backups · runs on a Pi kiosk *or* Docker anywhere
> Open source (MIT) 👉 <link>  #selfhosted #raspberrypi #opensource #fintech

## 7. After launch
- Respond to **every** comment/issue fast; ship a small fix from feedback within days.
- Add a short **YouTube/Asciinema demo**; embed in README + link in posts.
- Keep a tidy **CHANGELOG** and tag releases — repeat "what's new" posts are fair game.
- Encourage stars/forks in the README footer; add a "Star history" badge once it grows.
