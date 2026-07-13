# SPDX-License-Identifier: AGPL-3.0-or-later
"""Region derivation (D-083, D-007) — the SIX-bucket region model.

Region is **derived** from a holding's `listing_country`, never stored (D-007). The
six buckets and their membership are authored in MASTER-DATA §4 (D-083); the same
six values are the policy region-dimension bucket set. This is the ONE canonical
server-side derivation — the frontend never maps country → region (the Markets rule);
it renders the served `region` verbatim.
"""
from __future__ import annotations

# MASTER-DATA §4 (D-083) membership lists — ISO-3166-1 alpha-2 listing countries.
_EUROPE = frozenset({
    "GB", "IE", "FR", "DE", "NL", "BE", "LU", "CH", "AT", "ES", "PT", "IT", "GR",
    "SE", "NO", "DK", "FI", "IS", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI",
    "EE", "LV", "LT", "CY", "MT",
})
_APAC = frozenset({
    "JP", "CN", "HK", "MO", "TW", "KR", "AU", "NZ", "MY", "TH", "ID", "PH", "VN",
})  # Asia-Pacific excluding IN/SG

#: The complete region vocabulary (display order); also the policy-dimension bucket set.
REGIONS = ("India", "Singapore", "US", "Europe", "APAC", "Other")


def region_of(country: str | None) -> str:
    """Map an ISO-3166 alpha-2 listing country to its D-083 region bucket.

    IN/SG/US first, then the Europe and APAC membership lists; anything unmatched —
    including an unknown or absent country — falls to the **Other** catch-all, so every
    holding buckets somewhere (a total function; MASTER-DATA §4).
    """
    c = (country or "").upper()
    if c == "IN":
        return "India"
    if c == "SG":
        return "Singapore"
    if c == "US":
        return "US"
    if c in _EUROPE:
        return "Europe"
    if c in _APAC:
        return "APAC"
    return "Other"
