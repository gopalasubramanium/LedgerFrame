# SPDX-License-Identifier: AGPL-3.0-or-later
"""Served cost_basis_method label (page-accounts §9-13).

The titleizer turns `fifo` into "Fifo" — wrong. The served label is rendered verbatim
(§12es-3), so the acronym is fixed at the source with a per-vocab override → "FIFO".
"""

from __future__ import annotations


async def test_cost_basis_method_fifo_label_is_uppercase(app_client):
    rd = (await app_client.get("/api/v1/refdata")).json()
    labels = {x["value"]: x["label"] for x in rd["cost_basis_method"]}
    assert labels["fifo"] == "FIFO"       # today the titleizer serves "Fifo" → RED
    assert labels["average"] == "Average"  # the titleizer is correct here — untouched
