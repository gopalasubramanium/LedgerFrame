<!-- RATIFIED + SHIPPED 2026-07-14 (release-readiness Gate B10).
     The SECURITY.md link resolves: it shipped at B8 once B7 (mailbox verification) closed.
     Publishing this before then would have sent someone holding a vulnerability to a 404. -->

# Support boundaries — please read

LedgerFrame is a **single-maintainer, single-user, local-first** project. Issues are **open** because
they are useful, not because there is a support desk behind them.

**What you can expect**

- Issues are read. Not necessarily quickly.
- **There is no SLA and no guaranteed response time.** Some issues will be answered in a day, some in
  a month, and some will sit. That is not rudeness — it is one person.
- Bugs with a **clear reproduction** are the most likely to be fixed, by a wide margin.
- **Not every issue will be actioned, and some will be closed without being fixed.** That will be said
  directly rather than left to rot with silence.

**What issues are good for**

- 🐛 **Bugs** — especially anything where the app showed a **wrong number**, or a number where it
  should have honestly shown nothing. That is the product's central promise; a violation of it is the
  most serious kind of bug this project has.
- 📖 **Documentation that is wrong or misleading** — including install steps that do not work on your
  machine. If the README told you something untrue, that is a defect, and we want it.
- 💡 **Feature requests** — welcome, with the honest caveat that the roadmap is long and the
  maintainer is one person. See `ROADMAP.md`; several things you may be about to ask for are already
  on it, and marked as not built.

**What issues are NOT for**

- 🔒 **Security vulnerabilities.** Do not post these publicly. See [`SECURITY.md`](SECURITY.md) — mail
  **security@ledgerframe.org**.
- 💰 **Financial or investment advice.** LedgerFrame **reports; it does not advise**, and neither does
  its issue tracker.
- 🏢 **Commercial support requests.** There is no support contract to buy.

**Before you open one**

- Run `./scripts/doctor.sh` and paste the output — it answers a surprising number of install issues.
- Say what you actually ran, what you expected, and what happened.
- Include your OS, architecture, and how you installed. *(If your platform is not in the README's
  **Tested on** table, say so — that is useful information, not a disqualification.)*
