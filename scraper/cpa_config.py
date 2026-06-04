"""
CPA pricing table and lookup logic.
Lookup priority:
  1. Exact match (campaign, country)
  2. Wildcard "ALL" for that campaign
  3. None → FTD counted as duplicate (no price configured)
"""

CPA_TABLE: dict[tuple[str, str], float] = {
    ("FAFX",          "ALL"):         750.00,
    ("X37",           "Uruguay"):     650.00,
    ("X37",           "Mexico"):      750.00,
    ("X37",           "Colombia"):    750.00,
    ("X37",           "Ecuador"):     700.00,
    ("Xcore",         "Argentina"):   750.00,
    ("Xcore",         "Colombia"):    700.00,
    ("Xcore",         "Ecuador"):     650.00,
    ("Xcore",         "Mexico"):      600.00,
    ("Flamad",        "Colombia"):    750.00,
    ("Flamad",        "Ecuador"):     750.00,
    ("Flamad",        "Mexico"):      700.00,
    ("Flamad",        "Argentina"):   700.00,
    ("Oneclick",      "Colombia"):    761.25,
    ("Oneclick",      "Argentina"):   710.50,
    ("Oneclick",      "Ecuador"):     710.50,
    ("Oneclick",      "Nicaragua"):   761.25,
    ("Oneclick",      "Mexico"):      761.25,
    ("Oneclick",      "Uruguay"):     710.50,
    ("Oneclick",      "Peru"):        761.25,
    ("KK5",           "Colombia"):    650.00,
    ("Digify",        "Argentina"):   750.00,
    ("Duckmedia",     "Argentina"):   750.00,
    ("Duckmedia",     "Colombia"):    750.00,
    ("Xpoint",        "ALL"):         750.00,
    ("Belmar",        "Colombia"):    850.00,
    ("Belmar",        "Uruguay"):     800.00,
    ("Belmar",        "Argentina"):   850.00,
    ("Belmar",        "Mexico"):      850.00,
    ("Goat",          "ALL"):         765.00,
    ("KV",            "Argentina"):   623.63,
    ("KV",            "Colombia"):    727.57,
    ("KV",            "Ecuador"):     727.57,
    ("OceanLeads",    "Mexico"):      700.00,
    ("Newton Group",  "ALL"):         772.50,
    ("Emduel",        "Costa Rica"):  750.00,
    ("Emduel",        "Colombia"):    750.00,
    ("Emduel",        "Uruguay"):     750.00,
    ("Emduel",        "Honduras"):    750.00,
    ("Emduel",        "Argentina"):   900.00,
    ("AMS",           "ALL"):         750.00,
    ("NoLimits",      "ALL"):         750.00,
    ("Traffomatic",   "ALL"):         765.00,
    ("Tenx",          "ALL"):         750.00,
    ("Casa Media",    "Argentina"):   800.00,
    ("Academic Stock","Ecuador"):       0.00,
    ("Academic Stock","Argentina"):     0.00,
    ("Hexie",         "Uruguay"):     800.00,
    ("Intek",         "Argentina"):   800.00,
}


def get_cpa_price(campaign: str, country: str) -> float | None:
    """
    Return the CPA price for a (campaign, country) pair.
    Returns None if no price is configured (FTD is a duplicate).
    """
    # 1. Exact match
    exact = CPA_TABLE.get((campaign, country))
    if exact is not None:
        return exact

    # 2. ALL wildcard for this campaign
    wildcard = CPA_TABLE.get((campaign, "ALL"))
    if wildcard is not None:
        return wildcard

    return None
