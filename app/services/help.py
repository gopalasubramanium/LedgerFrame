# SPDX-License-Identifier: AGPL-3.0-or-later
"""In-app help knowledge base (§ help).

A single structured source of truth used by BOTH the Help page (`GET /help`) and the AI
(help facts in the grounded fact pack), so natural-language questions like "how do I set a
target allocation?" or "what is XIRR?" get answered from the same content. Plain facts —
never advice.
"""

from __future__ import annotations

HELP: list[dict] = [
    # --- Pages -------------------------------------------------------------- #
    # Titles ARE the nav labels, exactly (nav label = H1 = route). Casing traps: "Net worth",
    # "Cash flow", "Pricing Health". Every body describes what the page IS and what it is FOR;
    # figures, procedures and definitions stay owned by the page or the term that owns them.
    {"id": "page-home", "category": "Pages", "title": "Home",
     "body": "Your summary. Net worth and Today's change lead, then performance, allocation by "
             "class, what needs a look, contributors and detractors, gainers and losers, quotes, "
             "and the news briefing with top headlines. Every card summarises a page that owns the "
             "figure, and the arrow on the card opens it. Home computes nothing of its own.",
     "keywords": "home summary overview dashboard today briefing cards"},
    {"id": "page-net-worth", "category": "Pages", "title": "Net worth",
     "body": "Your headline and liquidity. Four figures lead: Net worth, Gross assets, Liabilities, "
             "and Cash & deposits. Below them sit the net-worth trend, composition by class, the "
             "liquidity ladder and the cash runway. Insurance cash value is shown as a named "
             "exclusion — it is deliberately not counted in the headline. Investment analytics live "
             "on Portfolio.",
     "keywords": "net worth headline liabilities cash deposits trend liquidity runway snapshot"},
    {"id": "page-portfolio", "category": "Pages", "title": "Portfolio",
     "body": "Investment analytics. Performance against a benchmark over a window you choose; "
             "allocation by class, sector, currency and tag; contributors and detractors for today; "
             "concentration; return attribution; and costs, which keep recorded fees and estimated "
             "ongoing cost separate rather than blending them. Return / volatility is a ratio of "
             "those two figures — it is not a Sharpe ratio and subtracts no risk-free rate. "
             "Positions are managed on Holdings.",
     "keywords": "portfolio analytics performance benchmark allocation concentration attribution costs"},
    {"id": "page-holdings", "category": "Pages", "title": "Holdings",
     "body": "The one place to add, edit and delete positions. The header carries Import, Export CSV "
             "and Add. Add branches once: a listed instrument you search for, or a manual asset you "
             "describe. Transactions are a section on the page, and a row opens its editor. Import "
             "shows you every row before you commit it and queues any symbol it could not resolve. "
             "Deleted rows stay recoverable for a short while, and purging them for good asks for "
             "your PIN. Exports are produced by the server over your whole dataset, not the rows on "
             "screen.",
     "keywords": "holdings add edit delete import export csv transactions positions purge undo"},
    {"id": "page-accounts", "category": "Pages", "title": "Accounts",
     "body": "Your accounts, the entities that hold them, and the institution master. An account "
             "carries its institution, kind, currency, cost-basis method and entity. Entities are "
             "created and renamed here; one cannot be deleted while an account still points at it. "
             "The institution master is shared with Insurance, so a broker and an insurer come from "
             "the same list, and duplicates can be merged. Per-account value is a summary of your "
             "holdings, never a second figure.",
     "keywords": "accounts entity institution master merge cost basis currency kind"},
    {"id": "page-markets", "category": "Pages", "title": "Markets",
     "body": "Quotes, indices, market status, gainers and losers, the instrument grid and your "
             "watchlists. World indices are grouped into Americas, Europe, Asia-Pacific, Commodities "
             "and Crypto. Where a provider does not serve a real index level, the figure comes from "
             "an ETF proxy and says so. Watchlists are created and edited here and nowhere else.",
     "keywords": "markets indices quotes gainers losers watchlist search proxy status"},
    {"id": "page-heatmap", "category": "Pages", "title": "Heatmap",
     "body": "One view of your holdings: tile size is position value, tile colour is Today's change, "
             "and the strength of the colour tracks how large the move was. Filter by asset class or "
             "region. Holdings with no price are left out and the page says how many; liabilities are "
             "not shown. Every tile opens its instrument.",
     "keywords": "heatmap treemap tiles today change filter asset class region visualisation"},
    {"id": "page-news", "category": "Pages", "title": "News",
     "body": "The market briefing and grouped headlines. Headlines are grouped into My holdings, "
             "India, Singapore, US, Global and Macro / FX; the My holdings group is ranked by how "
             "much of your portfolio a story touches and how recent it is. Headlines are retrieved, "
             "never invented, and the briefing states figures that were computed elsewhere rather "
             "than producing any of its own. Refresh is unavailable while no-egress is on. News about "
             "a single instrument lives on that instrument's page.",
     "keywords": "news headlines briefing feeds groups relevance refresh macro fx"},
    {"id": "page-review", "category": "Pages", "title": "Review",
     "body": "What needs a look. A rail carries Net worth, Today's change, data confidence, the "
             "attention count and when you last reviewed. Every signal names the page that owns it "
             "and links there. Mark reviewed records the moment — the figures as they stood, your "
             "note, and an optional next review date — and the history keeps your recent runs. "
             "Reporting only: a signal is something to look at, not an instruction.",
     "keywords": "review attention signals mark reviewed history confidence next review"},
    {"id": "page-policy", "category": "Pages", "title": "Policy",
     "body": "Your investment policy: targets, bands and drift. Set a target weight and a tolerance "
             "band for asset class, currency and region, plus an optional limit on any single "
             "holding. The page shows where you stand against each target and which buckets sit "
             "outside their band. Drift is worked out when you look at it and is never stored. "
             "Reporting, never a trade instruction.",
     "keywords": "policy target allocation band drift concentration limit rebalance"},
    {"id": "page-cash-flow", "category": "Pages", "title": "Cash flow",
     "body": "What you owe, what you're putting away, and what you're aiming at. Three registers: "
             "income and expenses, contributions, and goals. An obligation can recur or fall once, "
             "and a one-off is not counted in your recurring burn. Contributions do not reduce your "
             "cash runway — they move money rather than spend it. The runway itself belongs to Net "
             "worth; this page shows that figure and links to it.",
     "keywords": "cash flow goals obligations contributions income expense recurring runway planning"},
    {"id": "page-scenarios", "category": "Pages", "title": "Scenarios",
     "body": "What today's values would look like under a hypothetical shock. A scenario, never a "
             "forecast. Exposures cover equities, crypto, property, and holdings in currencies other "
             "than your base. A fixed set of downside shocks is applied to today's figures, and the "
             "liquidity what-ifs ask what happens if income stops or a large obligation is drawn now. "
             "Nothing here is a prediction, and nothing is saved.",
     "keywords": "scenarios shock stress exposure liquidity downside hypothetical simulation"},
    {"id": "page-insurance", "category": "Pages", "title": "Insurance",
     "body": "Your protection register — policies, cover and renewals. A register, never an adequacy "
             "judgment. Each policy carries its insurer, type, cover amount, premium and frequency, "
             "renewal date, insured person and nominee, and a checklist of the papers you hold for "
             "it. Cover by type and upcoming renewals are summarised. Any cash value is recorded "
             "here and is excluded from your net worth; Net worth names that exclusion and links "
             "back.",
     "keywords": "insurance policy cover premium renewal nominee insured cash value documents"},
    {"id": "page-estate", "category": "Pages", "title": "Estate",
     "body": "A readiness register — will, contacts and key documents. A record and reminders, never "
             "legal advice. It holds your will's status and where it is kept, who the executor is, "
             "contacts and the roles they hold, and a register of documents with where each one "
             "lives and when it was last reviewed. It counts what is present and what is missing "
             "or out of date. It carries no money and links to nothing else in the app.",
     "keywords": "estate will executor beneficiary guardian nominee documents readiness contacts"},
    {"id": "page-reports", "category": "Pages", "title": "Reports",
     "body": "Statements, the Realised P/L report and open tax lots — organised for your accountant. "
             "Statements cover income, fees, cash flow, and realised against unrealised. The Realised "
             "P/L report matches sales to purchases first-in, first-out, shows each event in its own "
             "currency, and gives base-currency totals two ways — at today's rates and at the rates "
             "on the trade dates — saying how many events it could not convert. You set the holding "
             "period that counts as long-term. Every export is produced by the server and carries "
             "the same disclaimers you see on screen. The printable Reports Pack opens from here.",
     "keywords": "reports statements realised tax lots fifo csv export pack accountant"},
    {"id": "page-pricing-health", "category": "Pages", "title": "Pricing Health",
     "body": "Why a number is what it is. For every holding: how it was valued, which source served "
             "it, the route that reached that source, how fresh it is, and a confidence score with "
             "the reasons behind it. Each row offers two actions — refresh it, or correct its "
             "source. A holding may say it needs an identifier mapping, or that a provider needs an "
             "API key. The route is shown here so you can see it, and changed in Settings. Refresh "
             "is unavailable while no-egress is on.",
     "keywords": "pricing health source route freshness stale confidence refresh mapping api key"},
    {"id": "page-settings", "category": "Pages", "title": "Settings",
     "body": "Preferences for this install, across six tabs. General covers how figures are "
             "reported. Appearance is theme, density, high contrast and reduced motion, and applies "
             "to this device only. Privacy states what this device is doing — with no-egress on it "
             "makes no network calls — and manages API tokens. Data feeds is your market data "
             "provider and its key, how long a price may go without refreshing, your news feeds and "
             "the routing matrix. AI shows the current configuration. System covers your PIN, "
             "auto-lock, network access and data controls.",
     "keywords": "settings tabs appearance privacy data feeds ai system pin token provider theme"},
    # --- Concepts / terms --------------------------------------------------- #
    {"id": "term-valuation-method", "category": "Terms", "title": "Valuation method",
     "body": "How a value was established: market quote (a delayed/EOD price), official NAV "
             "(a mutual-fund NAV), calculated accrual (deposit/bond principal + interest), "
             "manual valuation (a value you maintain), or estimated (cost used because no "
             "live price was available).",
     "keywords": "valuation method nav manual estimated accrual quote",
     "what": "The label describing how a holding's value was established — a market quote (a "
             "delayed or end-of-day price), an official NAV, a calculated accrual (principal plus "
             "interest), a manual valuation you maintain, or an estimate from cost used when no "
             "live price was available.",
     "why": "It tells you how directly a value is grounded in market data. A market quote or "
            "official NAV is priced externally; a manual valuation or an estimate depends on what "
            "you entered or on cost, so it can lag current market reality.",
     "improves": "Mapping a holding to a live price source (a ticker, an AMFI scheme, or a "
                 "CoinGecko id) moves it from manual or estimated onto a quote or NAV. Deposits and "
                 "bonds use accrual by design and need no mapping."},
    {"id": "term-entitlement-stale", "category": "Terms", "title": "Entitlement & stale",
     "body": "Entitlement is the best data grade a source claims (delayed / end-of-day / "
             "unavailable). 'Stale' means the cached quote is older than the staleness "
             "threshold — the value is shown but flagged, never hidden or faked.",
     "keywords": "entitlement stale delayed freshness threshold",
     "what": "Entitlement is the best data grade a source claims for a holding — delayed, "
             "end-of-day, or unavailable. 'Stale' means the cached quote is older than the "
             "staleness threshold; the value is still shown, but flagged.",
     "why": "Together they tell you how fresh and how authoritative a price is. A stale or "
            "unavailable flag signals that a figure may not reflect the latest market, without the "
            "value being hidden or faked.",
     "improves": "Refreshing the holding fetches a newer quote and clears a stale flag when the "
                 "source responds. An 'unavailable' entitlement is a limit of the source itself, "
                 "not something a refresh can change."},
    {"id": "term-data-confidence", "category": "Terms", "title": "Data confidence",
     "body": "A 0–100 score of how well-sourced a holding's value is: a base by valuation "
             "method minus penalties (stale, needs-mapping, unavailable). Every deduction is "
             "listed. It's a data-quality signal, not a view on the holding.",
     "keywords": "confidence score data quality sourcing",
     "what": "A 0–100 score of how well-sourced a holding's value is: a base set by the valuation "
             "method, minus itemised penalties for being stale, needing a mapping, or being "
             "unavailable. It is a data-quality signal, not a view on the holding.",
     "why": "It summarises in one number how much to trust a value's provenance. A low score "
            "points to a specific data problem — staleness, a missing mapping, or an unavailable "
            "source — rather than to the merit of the asset.",
     "improves": "Resolving the listed deductions raises the score: refresh a stale quote, supply "
                 "a missing identifier mapping, or configure the provider an unavailable source "
                 "needs. The Pricing health page lists each holding's deductions."},
    {"id": "term-xirr-twr", "category": "Terms", "title": "XIRR & TWR",
     "body": "XIRR is a money-weighted return (accounts for the size and timing of your "
             "cash flows). TWR is time-weighted (removes the effect of deposits/withdrawals, "
             "for comparing to a benchmark). Both are shown only where the cash-flow/price "
             "history supports them — 'not applicable' otherwise.",
     "keywords": "xirr twr return money-weighted time-weighted",
     "what": "Two return measures. XIRR is money-weighted: it accounts for the size and timing of "
             "your cash flows. TWR is time-weighted: it removes the effect of deposits and "
             "withdrawals so returns compare cleanly to a benchmark.",
     "why": "They answer different questions — XIRR reflects the return you actually experienced "
            "given when you added or withdrew money, while TWR isolates investment performance for "
            "benchmark comparison. The two can differ substantially.",
     "improves": "Both need enough dated cash-flow and price history to compute, and show 'not "
                 "applicable' where history is insufficient. Recording accurate transaction dates "
                 "and keeping prices current is what lets them be calculated."},
    {"id": "term-drift", "category": "Terms", "title": "Drift & bands",
     "body": "Drift is the gap between a bucket's actual share and its policy target. If it "
             "exceeds the tolerance band it's 'over' or 'under'. This is neutral reporting of "
             "distance from your own target — not a recommendation to trade.",
     "keywords": "drift band target over under rebalance policy",
     "what": "Drift is the gap between a bucket's actual share of the portfolio and its policy "
             "target. When that gap exceeds the tolerance band you set, the bucket is flagged "
             "'over' or 'under'. It is neutral reporting of distance from your own target.",
     "why": "It shows where the portfolio has moved away from the allocation you chose, so "
            "concentration or an under-weight is visible early — measured against your policy, not "
            "against any external recommendation.",
     "improves": "Drift is a measurement, so nothing in the data needs fixing. It narrows when the "
                 "actual allocation moves back toward target, or when you revise the target or band "
                 "on the Investment policy page. LedgerFrame never tells you to trade."},
    {"id": "term-liquidity", "category": "Terms", "title": "Liquidity ladder",
     "body": "Groups assets by how quickly they turn to cash: Immediate (cash & listed), "
             "Short (funds & bonds), Locked (deposits & retirement), Illiquid (property & "
             "private). Indicative — not a guarantee of sale price or timing.",
     "keywords": "liquidity ladder immediate short locked illiquid",
     "what": "A grouping of assets by how quickly they turn into cash: Immediate (cash and listed "
             "securities), Short (funds and bonds), Locked (deposits and retirement accounts), and "
             "Illiquid (property and private holdings). It is indicative, not a guarantee of sale "
             "price or timing.",
     "why": "It shows how much of your wealth could be reached quickly versus tied up, which is "
            "the basis for the cash runway and for seeing concentration in hard-to-sell assets.",
     "improves": "The ladder reflects the asset classes you hold, so it shifts as your holdings "
                 "change. Keeping each holding's asset-class classification accurate is what keeps "
                 "the grouping correct; there is no other action to take."},
    {"id": "term-cash-runway", "category": "Terms", "title": "Cash runway",
     "body": "Liquid assets ÷ your recorded recurring net burn (recurring expenses − income "
             "from Planning). 'Positive' means income covers expenses; 'no data' means add "
             "recurring obligations. Not a forecast of income.",
     "keywords": "runway burn cash flow months liquid",
     "what": "Liquid assets divided by your recorded recurring net burn — recurring expenses minus "
             "income, taken from Planning. 'Positive' means recorded income covers recorded "
             "expenses; 'no data' means no recurring obligations are entered. It is not a forecast "
             "of income.",
     "why": "It estimates how many months your liquid assets would cover recorded outflows, "
            "turning the liquidity ladder and your Planning entries into a single at-a-glance "
            "figure.",
     "improves": "The figure is only as complete as its inputs: adding recurring obligations "
                 "(expenses and income) in Planning replaces 'no data' with a computed runway, and "
                 "keeping them current keeps it accurate. It reflects only what you record."},
    {"id": "term-realised-pl", "category": "Terms", "title": "Realised P/L",
     "body": "What a sale actually made or lost: proceeds minus the cost of the parcels sold, "
             "matched first-in, first-out. Reported in the currency of the trade, which is exact; "
             "any base-currency figure uses today's exchange rates and is not for filing. Not tax "
             "advice.",
     "keywords": "realised profit loss sale proceeds cost fifo tax lot holding period",
     "what": "Sale proceeds minus the first-in, first-out matched cost of the parcels sold — the "
             "profit or loss a sale actually crystallised. Figures are reported in the trade's own "
             "currency, which is exact; any base-currency figure uses today's exchange rates and is "
             "not for filing.",
     "why": "It shows what your sales actually realised, parcel by parcel, so holding periods and "
            "cost are visible — organised for review, not as tax advice.",
     "improves": "Accuracy depends on complete buy and sell history with correct dates and costs, "
                 "since FIFO matching walks the recorded lots. For filing, use native-currency "
                 "figures and your own records; the base-currency total is indicative only."},
    {"id": "term-provenance", "category": "Terms", "title": "Provenance",
     "body": "Provenance is the record of where a value came from and how it was derived — its "
             "source (a provider or your own entry), the valuation method applied, any identifier "
             "mapping used, and how fresh it is. Every displayed figure can be traced back to this "
             "chain; nothing is fabricated.",
     "keywords": "provenance source origin trace lineage sourcing chain",
     "what": "The traceable record of where a value came from: the provider or manual entry that "
             "supplied it, the valuation method used, the identifier mapping that connected the "
             "holding to a price, and the timestamp of the data.",
     "why": "It is what lets every number be checked rather than trusted blindly — you can see "
            "whether a value is a live quote, an official NAV, or your own manual figure, and how "
            "recent it is. It underpins the data-confidence score.",
     "improves": "Provenance strengthens as a holding is mapped to a live source and refreshed, "
                 "which replaces manual or estimated values with quoted or NAV-based ones. The "
                 "Pricing health page shows each holding's source, routing, and freshness."},
    {"id": "term-fifo", "category": "Terms", "title": "FIFO (first-in, first-out)",
     "body": "FIFO is the lot-matching rule used for cost basis: when you sell, the "
             "earliest-acquired parcels are treated as sold first. It determines which acquisition "
             "costs are matched against sale proceeds to compute Realised P/L, and which lots "
             "remain open.",
     "keywords": "fifo first in first out lot matching cost basis realised profit loss",
     "what": "First-in, first-out: the rule that matches a sale against the earliest-acquired "
             "parcels first when computing cost basis, deciding which purchase costs offset the "
             "proceeds and which lots stay open.",
     "why": "The matching rule changes both the Realised P/L and the remaining open lots, so "
            "knowing FIFO is applied explains why a particular acquisition cost and holding period "
            "were used for a sale.",
     "improves": "FIFO is applied deterministically from your recorded transactions, so correct "
                 "buy and sell dates and costs are what make the matching accurate. It is a fixed "
                 "method, not a setting to tune."},
    {"id": "term-gross-assets", "category": "Terms", "title": "Gross assets",
     "body": "What everything you hold is worth right now, summed in your base currency at today's "
             "exchange rates. Liabilities are not subtracted — that figure is Net worth. It moves "
             "with prices and exchange rates, and reflects how each holding was valued.",
     "keywords": "gross assets holdings worth current base currency positive value",
     "what": "The sum of every holding's current market value, in your base currency at today's "
             "exchange rates, before any liability is subtracted. Subtracting what you owe gives "
             "Net worth.",
     "why": "It is the headline figure the rest of the panel is measured against — weights, yield, "
            "and concentration are all shares of this total — so its accuracy depends on how well "
            "each holding is priced.",
     "improves": "The figure is only as sound as its inputs: mapping holdings to live prices and "
                 "keeping FX current makes it track the market more closely. It measures what you "
                 "hold, not a number to steer."},
    {"id": "term-unrealised-pl", "category": "Terms", "title": "Unrealised P/L",
     "body": "Unrealised profit or loss is the paper gain or loss on positions you still hold: "
             "current market value minus cost basis. It becomes 'realised' only when you sell. Shown "
             "in base currency at today's rates.",
     "keywords": "unrealised profit loss paper gain cost basis mark to market",
     "what": "The paper gain or loss on holdings you have not sold — current market value minus cost "
             "basis — marked to today's prices and exchange rates. It turns into realised P/L only at "
             "sale.",
     "why": "It shows how far current positions sit above or below what you paid, separating gains "
            "you have actually banked (realised) from those that still depend on where the market "
            "goes.",
     "improves": "Accuracy depends on complete purchase history (dates and costs) and live pricing, "
                 "so unmapped or manually valued holdings can distort it. It measures a position's "
                 "standing, not a result to engineer."},
    {"id": "term-income", "category": "Terms", "title": "Income (dividends & interest)",
     "body": "Income is the dividends and interest recorded in your transaction ledger, summed in "
             "base currency at today's rates. It counts cash actually received and entered, not "
             "accrued or projected income.",
     "keywords": "income dividends interest cash received ledger",
     "what": "The total dividends and interest recorded in your ledger, converted to base currency "
             "at today's exchange rates. It reflects cash actually received and entered, not accrued "
             "or forecast income.",
     "why": "It shows the cash your holdings have paid out over time, distinct from price gains — a "
            "different kind of return that some portfolios are built around.",
     "improves": "It is only as complete as the dividend and interest transactions you record; "
                 "missing entries understate it. It measures cash received, not a stream to steer."},
    {"id": "term-income-yield", "category": "Terms", "title": "Income yield",
     "body": "Income yield is recorded income divided by current gross assets, as a percent. It is "
             "trailing and backward-looking — income already received against today's value — not a "
             "forward or annualised yield.",
     "keywords": "income yield trailing dividend interest percent backward",
     "what": "Recorded income (dividends and interest) divided by current gross assets, as a percent. "
             "It is a trailing ratio of income already received to today's value — not a forward, "
             "projected, or annualised yield.",
     "why": "It gives a rough sense of how much cash income the portfolio has generated relative to "
            "its size, without implying anything about future income.",
     "improves": "Because it divides recorded income by current value, complete income entries and "
                 "accurate pricing keep it meaningful. It is a backward-looking measurement, not a "
                 "rate to target."},
    {"id": "term-total-return", "category": "Terms", "title": "Total return",
     "body": "Total return is the overall percentage gain or loss on the portfolio relative to its "
             "cost basis, measured to date rather than over a fixed window. It is a cumulative figure "
             "across all holdings.",
     "keywords": "total return percent performance overall cumulative cost",
     "what": "The overall percentage gain or loss on the portfolio relative to its cost basis, "
             "measured to date rather than over a fixed period. It is cumulative across all "
             "holdings.",
     "why": "It answers 'how has the whole portfolio done since I bought in?' in one number, "
            "complementing the money- and time-weighted returns that account for the timing of cash "
            "flows.",
     "improves": "This reflects how your holdings performed relative to what you paid; it is a "
                 "measurement, not a target. Complete cost history keeps it accurate. LedgerFrame "
                 "reports it and never suggests changing your holdings."},
    {"id": "term-period-return", "category": "Terms", "title": "1-year return",
     "body": "The portfolio's return over the trailing one year, computed from the invested "
             "performance series. It is best-effort: when provider price history is unavailable it "
             "shows 0.0, so a zero can mean 'no data' rather than a flat year.",
     "keywords": "1y one year return period performance trailing",
     "what": "The portfolio's percentage return over the trailing twelve months, derived from the "
             "invested performance series. It is best-effort — if the underlying price history "
             "cannot be fetched it shows 0.0, so a displayed zero may mean 'no data' rather than a "
             "genuinely flat year.",
     "why": "It gives a recent, fixed-window view of performance to sit alongside the since-inception "
            "total return, useful for seeing how the last year in particular went.",
     "improves": "This reflects how your holdings behaved over the past year; it is a measurement, "
                 "not a target. Keeping price history available lets it compute rather than fall back "
                 "to 0.0. LedgerFrame reports it and never suggests changing your holdings."},
    {"id": "term-volatility", "category": "Terms", "title": "1-year volatility",
     "body": "Volatility is how much the portfolio's value fluctuated over the trailing year — the "
             "annualised standard deviation of its returns. It is best-effort; when history is "
             "unavailable it shows 0.0, which can mean 'no data' rather than no movement.",
     "keywords": "volatility standard deviation swings 1y fluctuation variability",
     "what": "The annualised standard deviation of the portfolio's returns over the trailing year — "
             "a measure of how much its value fluctuated. It is best-effort from the performance "
             "series; when history is unavailable it shows 0.0, which can mean 'no data' rather than "
             "genuinely no movement.",
     "why": "It characterises how bumpy the ride was, independent of direction — two portfolios with "
            "the same return can have very different volatility, which describes how steadily that "
            "return was reached.",
     "improves": "This reflects how much your holdings' value fluctuated over the period; it is a "
                 "characteristic being measured, not a target. Available price history lets it "
                 "compute rather than show 0.0. LedgerFrame reports it and never suggests changing "
                 "your holdings."},
    {"id": "term-return-volatility", "category": "Terms", "title": "Return / volatility",
     "body": "The return-to-volatility ratio divides the one-year return by the one-year volatility. "
             "It is deliberately NOT a Sharpe ratio: no risk-free rate is subtracted, so it is not "
             "risk-adjusted in the Sharpe sense — just return per unit of variability.",
     "keywords": "return volatility ratio sharpe not risk-free variability",
     "what": "The trailing one-year return divided by the trailing one-year volatility — return per "
             "unit of variability. It is explicitly NOT a Sharpe ratio: LedgerFrame subtracts no "
             "risk-free rate, so the figure is not risk-adjusted in the Sharpe sense and must not be "
             "read as one.",
     "why": "It gives a rough sense of how much return accompanied each unit of fluctuation, letting "
            "two portfolios be compared on return relative to their swings — without the risk-free-"
            "rate assumption a true Sharpe ratio would require.",
     "improves": "This combines two measured characteristics of the past year; it is a ratio being "
                 "reported, not a target. Both inputs are best-effort and blank out when history is "
                 "unavailable. LedgerFrame reports it and never suggests changing your holdings."},
    {"id": "term-max-drawdown", "category": "Terms", "title": "Maximum drawdown (1-year)",
     "body": "Maximum drawdown is the largest peak-to-trough fall in the portfolio's value over the "
             "trailing year, as a percent. It describes the worst decline endured in that window. "
             "Best-effort; when history is unavailable it shows 0.0.",
     "keywords": "max drawdown peak trough decline fall 1y worst",
     "what": "The largest peak-to-trough decline in the portfolio's value over the trailing year, as "
             "a percent. It is best-effort from the performance series; when history is unavailable "
             "it shows 0.0, which can mean 'no data' rather than no decline.",
     "why": "It characterises the worst fall the portfolio actually went through in the window — a "
            "felt measure of downside that a return or volatility figure alone does not convey.",
     "improves": "This reflects how far your holdings fell from a peak over the period; it is a "
                 "measurement of what happened, not a target. Available price history lets it compute "
                 "rather than show 0.0. LedgerFrame reports it and never suggests changing your "
                 "holdings."},
    {"id": "term-allocation-weight", "category": "Terms", "title": "Allocation weights",
     "body": "Allocation weights show each asset group's share of your gross assets — cash & "
             "deposits, equities & ETFs, crypto, and alternatives. Gross assets exclude liabilities, "
             "so a large loan can't push a group above 100%.",
     "keywords": "allocation weight asset class share cash equity crypto alternatives gross mix",
     "what": "The share each asset group — cash and deposits, equities and ETFs, crypto, or "
             "alternatives — makes up of your gross assets, as a percent. Gross assets exclude "
             "liabilities, so weights stay on a 0–100% scale even with a large mortgage.",
     "why": "They show how the portfolio is spread across kinds of asset, which is the basis for "
            "reading balance and for comparing the current mix against any policy target you set.",
     "improves": "Accurate weights depend on every holding being classified into the right asset "
                 "class and priced; misclassified or unpriced holdings skew the mix. This describes "
                 "how your assets are currently spread — a measurement, not a prescription."},
    {"id": "term-concentration", "category": "Terms", "title": "Concentration",
     "body": "Concentration measures how much of your gross assets sit in the biggest positions — "
             "the single largest holding and the top five combined, each as a percent of gross. "
             "Higher means more of your wealth rides on fewer names.",
     "keywords": "concentration largest position top 5 single holding gross weight",
     "what": "How much of your gross assets is held in your biggest positions — the single largest "
             "holding, and the top five combined — each shown as a percent of gross assets "
             "(liabilities excluded).",
     "why": "It shows how dependent the portfolio is on a few holdings: a high largest-position or "
            "top-five share means more of the outcome is tied to those specific names, a "
            "concentration characteristic worth being aware of.",
     "improves": "The figures depend on accurate pricing of your holdings, since they are value-"
                 "weighted. This describes how concentrated your holdings currently are — a "
                 "measurement LedgerFrame reports; it never tells you to trim or add to a "
                 "position."},
    # --- §4.5 attribution & risk metrics ------------------------------------ #
    {"id": "term-attribution", "category": "Terms", "title": "Return attribution",
     "body": "Return attribution splits the portfolio's return into per-holding contributions — a "
             "holding's contribution is its weight × its return — rolled up to asset class and "
             "sector. The residual is the part current holdings can't explain (income, Realised "
             "P/L, positions closed in the period). A descriptive, single-period approximation.",
     "keywords": "attribution contribution decomposition residual weight return holding sector "
                 "percentage points unattributed",
     "what": "Each holding's contribution to the portfolio's total return, as signed percentage "
             "points — its weight × its return — a descriptive split of the headline return by "
             "holding, asset class, and sector. The residual is the remainder a current-holdings "
             "price decomposition can't place (income, Realised P/L, positions closed in the "
             "period), shown explicitly so the contributions plus the residual reconcile to the "
             "total return — nothing is dropped.",
     "why": "It shows where the period's return came from — which holdings and groups moved the "
            "number, and how much sits in income, Realised P/L, or closed positions (the "
            "residual) rather than in current price moves.",
     "improves": "This is a descriptive, single-period approximation — the more exact multi-period "
                 "method is not applied — and a decomposition being reported, not a target. It "
                 "relies on current holdings and available price history. LedgerFrame reports it "
                 "and never suggests changing your holdings."},
    {"id": "term-beta", "category": "Terms", "title": "Beta",
     "body": "Beta is how sensitively the portfolio's returns move with the benchmark's — the "
             "covariance of the two divided by the benchmark's variance. 1 moves one-for-one, "
             "above 1 amplifies, below 1 dampens, negative moves the opposite way. A measurement "
             "of co-movement, not a quality score.",
     "keywords": "beta sensitivity benchmark covariance variance co-movement market",
     "what": "The sensitivity of the portfolio's returns to the benchmark's — covariance(portfolio, "
             "benchmark) ÷ variance(benchmark) over the paired daily returns. 1 means it tends to "
             "move one-for-one with the benchmark, above 1 amplifies its moves, below 1 dampens "
             "them, and negative means it tends to move the opposite way.",
     "why": "It characterises how much of the benchmark's movement tends to show up in the "
            "portfolio — a descriptive read of co-movement that return or volatility alone does "
            "not give.",
     "improves": "It needs a benchmark series; without one it shows unavailable rather than a "
                 "fabricated value. It is a measured characteristic of co-movement, not a quality "
                 "judgment or a target. LedgerFrame reports it and never suggests changing your "
                 "holdings."},
    {"id": "term-correlation", "category": "Terms", "title": "Correlation",
     "body": "Correlation measures how closely the portfolio's and the benchmark's returns move "
             "together, from −1 (opposite) through 0 (unrelated) to +1 (in lockstep). Unlike beta "
             "it says nothing about magnitude — only the tightness of the co-movement.",
     "keywords": "correlation benchmark co-movement relationship together minus one plus one",
     "what": "How closely the portfolio's returns and the benchmark's move together, on a scale "
             "from −1 (move oppositely) through 0 (unrelated) to +1 (move in lockstep). It "
             "describes the tightness of the relationship, not its size — that is beta.",
     "why": "It shows whether the portfolio tends to track the benchmark or diverge from it — a "
            "descriptive measure of how related the two return streams are.",
     "improves": "It needs a benchmark series; without one it shows unavailable, not a fabricated "
                 "number. It is a measurement of association, not a judgment or a target. "
                 "LedgerFrame reports it and never suggests changing your holdings."},
    {"id": "term-downside-deviation", "category": "Terms", "title": "Downside deviation",
     "body": "Downside deviation is the dispersion of only the portfolio's negative returns — a "
             "downside-risk measure that ignores upside swings. It is deliberately NOT Sortino: no "
             "risk-free rate and no target-return excess are used, so it must not be read as a "
             "risk-adjusted return.",
     "keywords": "downside deviation negative returns risk sortino not risk-free target dispersion",
     "what": "The annualised standard deviation of only the portfolio's negative daily returns — "
             "how much its down days dispersed, ignoring upside. It is explicitly NOT a Sortino "
             "ratio: LedgerFrame subtracts no risk-free rate and uses no target-return excess, so "
             "it is a raw downside-dispersion measure, not a risk-adjusted return.",
     "why": "It isolates downside variability — two portfolios with the same overall volatility can "
            "have very different downside behaviour, which this describes without counting "
            "favourable moves.",
     "improves": "It is a measured characteristic of past down days, not a target, and carries no "
                 "risk-free-rate assumption, so it is not Sortino. It is best-effort and blanks out "
                 "when history is unavailable. LedgerFrame reports it and never suggests changing "
                 "your holdings."},
    {"id": "term-information-ratio", "category": "Terms", "title": "Information ratio",
     "body": "The information ratio divides the portfolio's benchmark-relative excess return by its "
             "tracking error (the standard deviation of the active return). Its reference is the "
             "BENCHMARK, not a risk-free rate — so it is not a Sharpe or Sortino ratio and carries "
             "no risk-free-rate assumption.",
     "keywords": "information ratio active return excess tracking error benchmark not risk-free "
                 "sharpe sortino",
     "what": "The portfolio's excess return over the benchmark divided by its tracking error — the "
             "standard deviation of the active return, the portfolio-minus-benchmark difference. "
             "The reference point is the benchmark itself, NOT a risk-free rate, so it is "
             "explicitly not a Sharpe or Sortino ratio and must not be read as one.",
     "why": "It describes how much benchmark-relative return accompanied each unit of benchmark-"
            "relative variability — comparing active return against the steadiness with which it "
            "was earned, without the risk-free-rate assumption a Sharpe ratio would require.",
     "improves": "It needs a benchmark series; without one it shows unavailable, not a fabricated "
                 "value. It is a reported ratio built on the benchmark, with no risk-free rate, not "
                 "a target. LedgerFrame reports it and never suggests changing your holdings."},
    {"id": "term-tracking-error", "category": "Terms", "title": "Tracking error",
     "body": "Tracking error is the standard deviation of the portfolio's active return — its return "
             "minus the benchmark's, day by day. It is the denominator of the information ratio: a "
             "higher tracking error means the portfolio diverged from the benchmark more.",
     "keywords": "tracking error active return benchmark deviation divergence information ratio "
                 "denominator",
     "what": "The annualised standard deviation of the portfolio's active return — the day-by-day "
             "difference between its return and the benchmark's. It is the denominator of the "
             "information ratio, and describes how much the portfolio's path diverged from the "
             "benchmark's.",
     "why": "It characterises how tightly the portfolio followed the benchmark — a low tracking "
            "error means it moved closely with it, a high one means it went its own way, "
            "independent of whether that helped or hurt.",
     "improves": "It needs a benchmark series; without one it shows unavailable rather than a "
                 "fabricated number. It is a measured characteristic of divergence, not a target. "
                 "LedgerFrame reports it and never suggests changing your holdings."},
    {"id": "term-hhi", "category": "Terms", "title": "HHI (concentration)",
     "body": "The Herfindahl-Hirschman Index sums the squared weights of your holdings — 1/N for N "
             "equally sized positions, up to 1 for a single holding. Higher means more "
             "concentrated. It describes concentration; it is not a recommendation to diversify.",
     "keywords": "hhi herfindahl hirschman concentration squared weights diversification index",
     "what": "The Herfindahl-Hirschman Index — the sum of each holding's squared weight of gross "
             "assets. It runs from 1/N for N equally sized positions up to 1 for a single holding; "
             "higher means the portfolio is more concentrated in fewer names.",
     "why": "It condenses concentration into one number, complementing the largest-position and "
            "top-five figures — a compact read of how spread out or bunched the holdings are.",
     "improves": "It depends on accurate pricing, since weights are value-weighted. It describes "
                 "how concentrated your holdings currently are — a measurement LedgerFrame reports; "
                 "it never tells you to diversify, trim, or add to a position."},
    # --- §4.6 cost of ownership --------------------------------------------- #
    {"id": "term-ongoing-cost", "category": "Terms", "title": "Estimated ongoing cost",
     "body": "The estimated ongoing cost is NOT a fee you paid; it is a forward estimate from the "
             "fund's expense ratio (annual_cost_bps) applied to today's value. It is kept separate "
             "from the recorded fees (a real currency fact) and never blended with them.",
     "keywords": "ongoing cost expense ratio bps basis points estimate fee forward recorded",
     "what": "A forward ESTIMATE of yearly ongoing cost: each instrument's expense ratio (in basis "
             "points) applied to its current value. It is not a fee you have paid — it is what "
             "today's holdings would cost per year at the recorded rate. It is shown separately "
             "from recorded fees (the actual currency amount from FEE transactions and fee fields), "
             "and the two are deliberately never added into one 'total cost of ownership'.",
     "why": "It gives a forward-looking sense of the drag from fund fees, which recorded fees "
            "(historical, only what has already been charged) don't convey. Currency-primary with "
            "the rate restated as a percent, so the size and the rate are both visible.",
     "improves": "It covers only holdings whose instrument has an expense ratio set; a holding with "
                 "none is shown as unavailable with a reason, never counted as 0 (that would "
                 "fabricate a fact), and the coverage ('covers N of M holdings') is stated. It is an "
                 "estimate LedgerFrame reports, not advice — set each fund's rate to make it "
                 "compute rather than stay unavailable."},
    # --- Guarantees --------------------------------------------------------- #
    {"id": "guarantee", "category": "About", "title": "What LedgerFrame will never do",
     "body": "It never places trades, gives buy/sell/hold or tax/financial advice, or "
             "fabricates a price, headline or figure. Unavailable data shows '—' with a "
             "reason. The AI explains verified facts; it never invents a number. Your data is "
             "local-first with no telemetry.",
     "keywords": "guarantee no advice no trading honest local private telemetry"},
]

_CATEGORIES = ["Pages", "Terms", "About"]


def all_help() -> dict:
    def _project(e: dict) -> dict:
        out = {k: e[k] for k in ("id", "category", "title", "body")}
        # Glossary popover fields — present only on Terms entries; omit where absent.
        out.update({k: e[k] for k in ("what", "why", "improves") if k in e})
        return out

    return {"categories": _CATEGORIES, "entries": [_project(e) for e in HELP]}


def search_help(query: str, limit: int = 4) -> list[dict]:
    """Rank help entries by keyword/title/body overlap with a natural-language query."""
    q = (query or "").lower()
    terms = {t for t in _re_words(q) if len(t) > 2}
    if not terms:
        return []
    scored = []
    for e in HELP:
        hay = f"{e['title']} {e['keywords']} {e['body']}".lower()
        score = sum(1 for t in terms if t in hay)
        # Title/keyword hits weigh more.
        score += sum(2 for t in terms if t in f"{e['title']} {e['keywords']}".lower())
        if score:
            scored.append((score, e))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [{k: e[k] for k in ("id", "category", "title", "body")} for _s, e in scored[:limit]]


def _re_words(s: str) -> list[str]:
    import re
    return re.findall(r"[a-z0-9]+", s)
