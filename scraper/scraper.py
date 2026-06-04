"""
VoiceOS Marketing Finance — Continuous Tracker Scraper
Scrapes https://tracker.machukllc.xyz every SCRAPE_INTERVAL seconds,
deduplicates rows, saves CSV/JSONL daily files, and prints a CPA report.
"""

import csv
import hashlib
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

from cpa_config import CPA_TABLE, get_cpa_price

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL       = "https://tracker.machukllc.xyz"
TRACKER_USER   = os.getenv("TRACKER_USER", "conversion@tresenlinea.xyz")
TRACKER_PASS   = os.getenv("TRACKER_PASS", "24731840Mt.")
SCRAPE_INTERVAL= int(os.getenv("SCRAPE_INTERVAL", "60"))
OUTPUT_DIR     = Path(os.getenv("OUTPUT_DIR", "data"))
LOG_LEVEL      = os.getenv("LOG_LEVEL", "INFO")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Logging ───────────────────────────────────────────────────────────────────
log_file = OUTPUT_DIR / "scraper.log"
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ── Country code → name ───────────────────────────────────────────────────────
COUNTRY_MAP: dict[str, str] = {
    "AR": "Argentina", "CO": "Colombia",  "MX": "Mexico",
    "UY": "Uruguay",   "EC": "Ecuador",   "PE": "Peru",
    "NI": "Nicaragua", "CR": "Costa Rica","HN": "Honduras",
    "VE": "Venezuela", "BO": "Bolivia",   "PY": "Paraguay",
    "CL": "Chile",     "BR": "Brazil",    "GT": "Guatemala",
    "SV": "El Salvador","DO": "Dominican Republic",
    "PA": "Panama",    "CU": "Cuba",      "PR": "Puerto Rico",
    "US": "United States", "ES": "Spain", "GB": "United Kingdom",
}

def normalize_country(raw: str) -> str:
    raw = raw.strip()
    return COUNTRY_MAP.get(raw.upper(), raw)

# ── Endpoints ─────────────────────────────────────────────────────────────────
ENDPOINTS = {
    "stats_campaign_subsource_country": (
        "/get_data.php?type=stats_pb&export=1"
        "&stats_type=Campaigns&sec_stats_type=SubSources"
        "&third_stats_type=Country&id=0"
    ),
    "stats_campaign_country": (
        "/get_data.php?type=stats_pb&export=1"
        "&stats_type=Campaigns&sec_stats_type=Country"
        "&third_stats_type=none&id=0"
    ),
    "reports_payouts": (
        "/get_data.php?type=reports&export=1"
        "&reports_type=Campaigns&sec_reports_type=Country"
        "&third_reports_type=none&id=0"
    ),
}

# ── Session management ────────────────────────────────────────────────────────
session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0 VoiceOS-Scraper/1.0"})

def login() -> bool:
    log.info("Logging in to tracker…")
    try:
        resp = session.post(
            f"{BASE_URL}/login.php",
            data={"email": TRACKER_USER, "password": TRACKER_PASS, "login": "", "theme": ""},
            allow_redirects=True,
            timeout=30,
        )
        if "crm.new.php" in resp.url or "name=\"password\"" not in resp.text:
            log.info("Login successful.")
            return True
        log.error("Login failed — check credentials.")
        return False
    except Exception as exc:
        log.error("Login error: %s", exc)
        return False

def is_session_expired(text: str) -> bool:
    return 'name="password"' in text

def fetch_endpoint(path: str) -> list[list[str]] | None:
    url = BASE_URL + path
    try:
        resp = session.get(url, timeout=30)
        if is_session_expired(resp.text):
            log.warning("Session expired — re-logging in.")
            if not login():
                return None
            resp = session.get(url, timeout=30)
        data = resp.json()
        if not isinstance(data, list) or len(data) < 2:
            return None
        return data  # first row = headers
    except Exception as exc:
        log.error("Fetch error for %s: %s", path, exc)
        return None

# ── Persistence helpers ───────────────────────────────────────────────────────
seen_hashes: dict[str, set[str]] = {}

def row_hash(row: list[str]) -> str:
    return hashlib.md5("|".join(str(c) for c in row).encode()).hexdigest()

def save_row(name: str, headers: list[str], row: list[str]) -> bool:
    """Returns True if the row is new (not a duplicate)."""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    h = row_hash(row)
    key = f"{name}_{today}"
    if key not in seen_hashes:
        seen_hashes[key] = set()
    if h in seen_hashes[key]:
        return False
    seen_hashes[key].add(h)

    csv_path  = OUTPUT_DIR / f"{name}_{today}.csv"
    jsonl_path= OUTPUT_DIR / f"{name}_{today}.jsonl"
    write_header = not csv_path.exists()

    with csv_path.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if write_header:
            w.writerow(headers)
        w.writerow(row)

    record = dict(zip(headers, row))
    record["_scraped_at"] = datetime.now(timezone.utc).isoformat()
    with jsonl_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

    return True

# ── CPA Finance Report ────────────────────────────────────────────────────────
def build_finance_report(rows: list[dict]) -> dict:
    """
    rows: dicts with keys Campaign, Country, Leads, FTDs (from stats_campaign_country)
    """
    detail: list[dict] = []
    total_leads = 0
    total_ftds  = 0
    total_cpa   = 0.0
    dup_ftds    = 0

    for r in rows:
        campaign = str(r.get("Campaigns") or r.get("Campaign") or "").strip()
        country  = normalize_country(str(r.get("Country", "")).strip())
        try:
            leads = int(str(r.get("Leads", 0)).replace(",", "") or 0)
            ftds  = int(str(r.get("FTDs", 0)).replace(",", "") or 0)
        except ValueError:
            leads = ftds = 0

        price = get_cpa_price(campaign, country)
        if price is None:
            dup_ftds  += ftds
            unit_price = None
            row_cpa    = 0.0
        else:
            row_cpa    = ftds * price
            unit_price = price

        total_leads += leads
        total_ftds  += ftds
        total_cpa   += row_cpa

        try:
            cr_pct = round(ftds / leads * 100, 2) if leads > 0 else 0.0
        except ZeroDivisionError:
            cr_pct = 0.0

        detail.append({
            "campaign":    campaign,
            "country":     country,
            "leads":       leads,
            "ftds":        ftds,
            "cr_pct":      cr_pct,
            "unit_price":  unit_price,
            "cpa_total":   row_cpa,
        })

    orig_ftds = total_ftds - dup_ftds
    ecpa = round(total_cpa / total_ftds, 2) if total_ftds > 0 else 0.0
    detail.sort(key=lambda x: x["cpa_total"], reverse=True)

    return {
        "total_leads":  total_leads,
        "total_ftds":   total_ftds,
        "original_ftds":orig_ftds,
        "duplicate_ftds":dup_ftds,
        "total_cpa":    round(total_cpa, 2),
        "ecpa":         ecpa,
        "detail":       detail,
    }

def print_finance_report(report: dict, date_from: str, date_to: str) -> None:
    sep  = "═" * 62
    line = "─" * 62
    print(f"\n{sep}")
    print(f"  MARKETING FINANCE REPORT")
    print(f"  {date_from}  →  {date_to}")
    print(f"{sep}")
    print(f"  {'TOTAL FTDs':<28} {report['total_ftds']}")
    print(f"  {'FTDs DUPLICADOS':<28} {report['duplicate_ftds']}")
    print(f"  {'FTD ORIGINAL':<28} {report['original_ftds']}")
    print(f"{line}")
    print(f"  {'CPA':<28} $ {report['total_cpa']:,.2f}")
    print(f"  {'ECPA':<28} $ {report['ecpa']:,.2f}")
    print(f"  {'TOTAL LEADS':<28} {report['total_leads']}")
    print()
    print(f"  {'CAMPAIGN':<18} {'COUNTRY':<14} {'LEADS':>6} {'FTDS':>5} {'CR%':>6} {'UNIT $':>8} {'TOTAL $':>10}")
    print(f"{line}")
    for row in report["detail"]:
        unit = f"${row['unit_price']:,.2f}" if row["unit_price"] is not None else "N/A"
        print(
            f"  {row['campaign']:<18} {row['country']:<14} "
            f"{row['leads']:>6} {row['ftds']:>5} {row['cr_pct']:>5.1f}% "
            f"{unit:>8} ${row['cpa_total']:>9,.2f}"
        )
    print(f"{sep}\n")

def save_finance_report(report: dict) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    json_path = OUTPUT_DIR / f"finance_report_{ts}.json"
    csv_path  = OUTPUT_DIR / f"finance_detail_{ts}.csv"

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["campaign","country","leads","ftds","cr_pct","unit_price","cpa_total"])
        w.writeheader()
        w.writerows(report["detail"])

    log.info("Finance report saved → %s | %s", json_path.name, csv_path.name)

# ── Main loop ─────────────────────────────────────────────────────────────────
def scrape_cycle() -> None:
    log.info("Starting scrape cycle…")
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    rows_for_report: list[dict] = []

    for name, path in ENDPOINTS.items():
        data = fetch_endpoint(path)
        if data is None:
            log.warning("No data for endpoint: %s", name)
            continue

        headers = [str(h) for h in data[0]]
        new_rows = 0
        for row in data[1:]:
            row_str = [str(c) for c in row]
            if save_row(name, headers, row_str):
                new_rows += 1

            # Collect stats_campaign_country rows for finance report
            if name == "stats_campaign_country":
                rows_for_report.append(dict(zip(headers, row_str)))

        log.info("%-42s  +%d new rows", name, new_rows)

    # Finance report
    if rows_for_report:
        report = build_finance_report(rows_for_report)
        print_finance_report(report, date_from="today", date_to=now_str)
        save_finance_report(report)
    else:
        log.warning("No stats data available for finance report.")

def main() -> None:
    log.info("VoiceOS Marketing Finance Scraper starting (interval=%ds)…", SCRAPE_INTERVAL)
    if not login():
        log.critical("Cannot log in. Exiting.")
        sys.exit(1)

    while True:
        try:
            scrape_cycle()
        except KeyboardInterrupt:
            log.info("Scraper stopped by user.")
            break
        except Exception as exc:
            log.error("Unexpected error in scrape cycle: %s", exc, exc_info=True)

        log.info("Sleeping %ds…", SCRAPE_INTERVAL)
        time.sleep(SCRAPE_INTERVAL)

if __name__ == "__main__":
    main()
