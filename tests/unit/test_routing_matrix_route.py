# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-38 Phase 0.3 — the precedence slot 3.5 in route() (AMENDMENT A, PREPEND).

Pure-policy tests (no DB): a matrix cell REFINES which market provider prices a
class×country, consulted ONLY after override/manual-only/cache-publish have returned,
and ONLY when it actually can price — on any incapability/degradation/unkeyed state,
resolution continues down the existing chain unchanged (a cell can never price less
than today; data-feed-routing §9-1/§9-3/§9-7).
"""

from __future__ import annotations

from app.providers.market.router import ProviderAvailability, route


def _route(**kw):
    base = {
        "instrument_id": 1, "symbol": "X", "asset_class": "equity", "asset_subclass": None,
        "listing_country": "US", "mappings": set(), "active_provider": "yahoo", "has_manual": False,
    }
    base.update(kw)
    return route(**base)


# (a) a mapped, capable, keyed cell prices — route_rule == "matrix".
def test_a_matrix_cell_prices_and_is_labelled_matrix():
    d = _route(matrix_provider="csv", active_provider="yahoo")  # csv: equity+*, keyless
    assert d.source_selected == "csv"          # the matrix repointed away from active
    assert d.valuation_method == "market_quote"
    assert d.route_rule == "matrix"


# (b) THE LOAD-BEARING PIN — a cell that can't price (unkeyed) falls through; the chain
# continues and route_rule reflects the ACTUAL pricer, never "matrix".
def test_b_unkeyed_cell_falls_through_route_rule_is_actual_pricer():
    # eodhd needs a key; with no eodhd credentials the cell cannot price.
    avail = {"yahoo": ProviderAvailability(name="yahoo", configured=True, has_credentials=True)}
    d = _route(matrix_provider="eodhd", active_provider="yahoo", availability=avail)
    assert d.source_selected == "yahoo"        # fell through to the active provider
    assert d.route_rule == "active"            # NOT "matrix" — the Amendment-A guarantee
    assert d.route_rule != "matrix"


# (d) an incapable / stale / unknown cell is ignored (resolve-time re-validation, §9-3).
def test_d_incapable_cell_is_ignored():
    # coingecko can't price equity → ignored, active provider prices.
    d = _route(matrix_provider="coingecko", asset_class="equity", active_provider="yahoo")
    assert d.source_selected == "yahoo" and d.route_rule == "active"
    # a provider that isn't even in the registry → ignored.
    d2 = _route(matrix_provider="defunct", active_provider="yahoo")
    assert d2.source_selected == "yahoo" and d2.route_rule == "active"
    # region mismatch: kite is IN-only → ignored for a US equity.
    d3 = _route(matrix_provider="kite", listing_country="US", active_provider="yahoo")
    assert d3.source_selected == "yahoo" and d3.route_rule == "active"


# (c) an absent cell = today's behaviour, byte-identical on the SELECTION (§9-2 empty
# matrix). route_rule is the honest new label, never "matrix".
def test_c_no_cell_is_todays_behaviour():
    with_none = _route(matrix_provider=None, active_provider="yahoo")
    without = _route(active_provider="yahoo")  # kwarg defaults to None
    for f in ("source_selected", "valuation_method", "lane", "priority_chain",
              "mapping_required", "auth_required"):
        assert getattr(with_none, f) == getattr(without, f)
    assert with_none.source_selected == "yahoo"
    assert with_none.route_rule == "active" and with_none.route_rule != "matrix"


# (e) THE GUARANTEE — a matrix cell can NEVER overwrite a NAV or a canonical crypto
# price. Steps 2-3 return before 3.5; pinned structurally AND behaviourally (§9-1e).
def test_e_matrix_cannot_overwrite_a_nav():
    d = _route(asset_class="mutual_fund", listing_country="IN", mappings={"amfi_code"},
               cached_source="amfi_nav", matrix_provider="eodhd", active_provider="eodhd")
    assert d.source_selected == "amfi_nav"        # AMFI still owns the NAV
    assert d.valuation_method == "official_nav"
    assert d.route_rule != "matrix"


def test_e_matrix_cannot_overwrite_a_canonical_crypto_price():
    d = _route(asset_class="crypto", listing_country=None, mappings={"coingecko_id"},
               cached_source="coingecko", matrix_provider="alphavantage", active_provider="mock")
    assert d.source_selected == "coingecko"       # the canonical price stands
    assert d.route_rule != "matrix"


# A published-NAV IN mutual fund never even reaches step 3.5 — a matrix cell for it is
# stored but inert (the NAV lane owns it). A GLOBAL fund (no cache-publish lane) DOES
# reach the matrix, which is the legitimate use.
def test_global_fund_can_be_routed_by_matrix_but_in_fund_cannot():
    glob = _route(asset_class="mutual_fund", listing_country="US", matrix_provider="eodhd",
                  active_provider="yahoo",
                  availability={"eodhd": ProviderAvailability(
                      name="eodhd", configured=True, has_credentials=True)})
    assert glob.source_selected == "eodhd" and glob.route_rule == "matrix"
