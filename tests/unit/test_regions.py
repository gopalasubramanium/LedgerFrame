# SPDX-License-Identifier: AGPL-3.0-or-later
"""page-heatmap Phase 0 (ND-8 / §10-9) — the D-083 six-bucket region derivation.

Fail-first: RED on the legacy `region_of` (which mapped only IN/SG/US → else "Global",
so Europe/APAC/Other did not exist). One canonical server-side derivation, reused by the
policy region dimension and the served `HoldingView.region`.
"""
from __future__ import annotations

import pytest

from app.core.regions import REGIONS, region_of


def test_region_vocabulary_is_the_six_d083_buckets():
    assert REGIONS == ("India", "Singapore", "US", "Europe", "APAC", "Other")
    # The legacy "Global" bucket is retired.
    assert "Global" not in REGIONS


@pytest.mark.parametrize(
    ("country", "expected"),
    [
        ("IN", "India"), ("in", "India"),
        ("SG", "Singapore"),
        ("US", "US"),
        # Europe membership (MASTER-DATA §4).
        ("GB", "Europe"), ("DE", "Europe"), ("FR", "Europe"), ("CH", "Europe"), ("MT", "Europe"),
        # APAC membership (excludes IN/SG).
        ("JP", "APAC"), ("CN", "APAC"), ("HK", "APAC"), ("AU", "APAC"), ("VN", "APAC"),
        # Other catch-all — unlisted, unknown, and absent all bucket to Other (total function).
        ("CA", "Other"), ("BR", "Other"), ("AE", "Other"), ("ZA", "Other"),
        ("XX", "Other"), ("", "Other"), (None, "Other"),
    ],
)
def test_region_of_maps_each_bucket(country, expected):
    assert region_of(country) == expected
