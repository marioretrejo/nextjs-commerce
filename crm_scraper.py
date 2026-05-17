"""
CRM scraper - tracker.machukllc.xyz
Extrae leads del CRM (Tabulator.js) y los exporta a Google Sheets.
Credenciales desde .env (ver instrucciones al final).
"""

import json
import os
from datetime import datetime

import gspread
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

load_dotenv()

LOGIN_URL        = os.getenv("CRM_LOGIN_URL",  "https://tracker.machukllc.xyz/crm.new.php")
USERNAME         = os.getenv("CRM_USERNAME",   "conversion@tresenlinea.xyz")
PASSWORD         = os.getenv("CRM_PASSWORD",   "24731840Mt.")
CREDENTIALS_FILE = os.getenv("GOOGLE_CREDS",   "credentials.json")
SPREADSHEET_ID   = os.getenv("SPREADSHEET_ID", "1-cPywxrJYYI0qhACMWea1MVK3y36X1PNyJExZzWm8sA")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

FIELDS  = ["id", "first_name", "last_name", "email", "phone", "country",
           "traffic_source", "campaign", "brand", "brand_status",
           "creation_date", "delivery_date", "page", "ip_address", "note"]
HEADERS = ["ID", "Nombre", "Apellido", "Email", "Teléfono", "País",
           "Fuente", "Campaña", "Brand", "Estado Brand",
           "Fecha Creación", "Fecha Entrega", "Página", "IP", "Nota",
           "Scrapeado"]


def auth_sheets() -> gspread.Client:
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    return gspread.authorize(creds)


def ensure_headers(ws: gspread.Worksheet):
    if not ws.row_values(1):
        ws.append_row(HEADERS)
        print(f"      Headers insertados ({len(HEADERS)} columnas)")
    else:
        print("      Headers ya presentes")


def scrape_leads(page) -> list[dict]:
    return page.evaluate("""() => {
        return [...document.querySelectorAll('.tabulator-row')].map(row => {
            const obj = {};
            row.querySelectorAll('.tabulator-cell').forEach(cell => {
                const f = cell.getAttribute('tabulator-field');
                if (f) obj[f] = cell.innerText.trim().replace(/\\n/g, ' ');
            });
            return obj;
        });
    }""")


def scrape():
    # ── Auth Google Sheets ─────────────────────────────────────────────────
    print("[0/5] Autenticando con Google Sheets...")
    gc = auth_sheets()
    ws = gc.open_by_key(SPREADSHEET_ID).sheet1
    ensure_headers(ws)
    print("      OK")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(ignore_https_errors=True)
        page    = context.new_page()

        # ── 1. Navegar al login ────────────────────────────────────────────
        print("[1/5] Navegando al CRM...")
        page.goto(LOGIN_URL, wait_until="networkidle", timeout=20000)
        print(f"      URL: {page.url}")

        # ── 2. Login ───────────────────────────────────────────────────────
        print("[2/5] Haciendo login...")
        page.fill("#email",    USERNAME)
        page.fill("#password", PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_load_state("networkidle", timeout=15000)

        # ── 3. Verificar login ─────────────────────────────────────────────
        print("[3/5] Verificando acceso...")
        if "login" in page.url.lower() and page.locator("#email").count():
            print("      LOGIN FALLIDO — verificá las credenciales")
            browser.close()
            return
        print(f"      Login exitoso → {page.url}")

        # Cerrar modal 2FA sin interacción visible
        page.evaluate("document.querySelectorAll('.modal').forEach(m => m.style.display='none')")
        page.wait_for_timeout(800)

        # ── 4. Guardar cookies ─────────────────────────────────────────────
        cookies = context.cookies()
        with open("cookies.json", "w") as f:
            json.dump(cookies, f, indent=2)
        print(f"      Cookies guardadas ({len(cookies)})")

        # ── 5. Extraer leads ───────────────────────────────────────────────
        print("[4/5] Extrayendo leads...")
        page.wait_for_selector(".tabulator-row", timeout=10000)
        leads = scrape_leads(page)
        print(f"      {len(leads)} leads encontrados")
        for lead in leads[:3]:
            print(f"      → {lead.get('first_name')} {lead.get('last_name')} | {lead.get('email')} | {lead.get('country')}")

        browser.close()

    # ── 6. Enviar a Google Sheets ──────────────────────────────────────────
    print("[5/5] Enviando a Google Sheets...")
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    rows = []
    for lead in leads:
        row = [lead.get(f, "") for f in FIELDS] + [timestamp]
        rows.append(row)

    ws.append_rows(rows, value_input_option="RAW")
    sheet_url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
    print(f"      {len(rows)} filas insertadas")
    print(f"\n✓ Listo.")
    print(f"  Sheet: {sheet_url}")


if __name__ == "__main__":
    scrape()


# ══════════════════════════════════════════════════════════════════════════════
# PARA USAR CON .env EN LUGAR DE CREDENCIALES EN EL CÓDIGO
# ══════════════════════════════════════════════════════════════════════════════
#
# Crea un archivo .env (ya está en .gitignore):
#
#   CRM_LOGIN_URL=https://tracker.machukllc.xyz/crm.new.php
#   CRM_USERNAME=conversion@tresenlinea.xyz
#   CRM_PASSWORD=24731840Mt.
#   GOOGLE_CREDS=credentials.json
#   SPREADSHEET_ID=1-cPywxrJYYI0qhACMWea1MVK3y36X1PNyJExZzWm8sA
#
# pip install python-dotenv  (ya instalado)
#
# CAMPOS DISPONIBLES EN EL CRM (30 en total):
#   id, traffic_source, creation_date, delivery_date, sub_source,
#   language, ip_address, note, clickid, page, campaign, brand,
#   brand_lead_id, brand_status, country, email, phone,
#   first_name, last_name, p1, p2, p3, p4, p5
