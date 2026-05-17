"""
Playwright login scraper - sitio de prueba: the-internet.herokuapp.com
Exporta datos a Google Sheets via Service Account.
Para adaptar a un CRM real, ver comentarios al final del archivo.
"""

import json
from datetime import datetime, date

import gspread
from google.oauth2.service_account import Credentials
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

LOGIN_URL        = "https://the-internet.herokuapp.com/login"
USERNAME         = "tomsmith"
PASSWORD         = "SuperSecretPassword!"
CREDENTIALS_FILE = "credentials.json"
OUTPUT_COOKIES   = "cookies.json"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

HEADERS = ["URL", "Título", "Heading", "Mensaje", "Cuerpo", "Timestamp"]


def get_or_create_sheet(gc: gspread.Client) -> gspread.Spreadsheet:
    sheet_name = f"CRM Data - {date.today().strftime('%Y-%m-%d')}"
    try:
        spreadsheet = gc.open(sheet_name)
        print(f"      Sheet existente encontrado: '{sheet_name}'")
    except gspread.SpreadsheetNotFound:
        spreadsheet = gc.create(sheet_name)
        ws = spreadsheet.sheet1
        ws.append_row(HEADERS)
        print(f"      Sheet nuevo creado: '{sheet_name}'")
    return spreadsheet


def scrape():
    # ── Auth Google Sheets ─────────────────────────────────────────────────
    print("[0/5] Autenticando con Google Sheets...")
    creds  = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    gc     = gspread.authorize(creds)
    print("      Autenticación OK")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(ignore_https_errors=True)
        page    = context.new_page()

        # ── 1. Navegar al login ────────────────────────────────────────────
        print("[1/5] Navegando a la página de login...")
        page.goto(LOGIN_URL, wait_until="networkidle")
        print(f"      URL actual: {page.url}")

        # ── 2. Completar formulario ────────────────────────────────────────
        print("[2/5] Ingresando credenciales...")
        page.fill("#username", USERNAME)
        page.fill("#password", PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_load_state("networkidle")

        # ── 3. Verificar login exitoso ─────────────────────────────────────
        print("[3/5] Verificando login...")
        try:
            page.locator(".flash.success").wait_for(timeout=5000)
        except PlaywrightTimeout:
            error_text = page.locator(".flash.error").inner_text() if page.locator(".flash.error").count() else "Sin mensaje de error"
            print(f"      LOGIN FALLIDO: {error_text}")
            browser.close()
            return

        print(f"      Login exitoso. URL: {page.url}")

        # ── 4. Extraer datos ───────────────────────────────────────────────
        print("[4/5] Extrayendo datos...")
        row = [
            page.url,
            page.title(),
            page.locator("h2").first.inner_text().strip(),
            page.locator(".flash.success").inner_text().strip(),
            page.locator("#content .example").inner_text().strip(),
            datetime.utcnow().isoformat() + "Z",
        ]
        for header, value in zip(HEADERS, row):
            print(f"      {header}: {value!r}")

        # ── 5a. Guardar cookies ────────────────────────────────────────────
        cookies = context.cookies()
        with open(OUTPUT_COOKIES, "w", encoding="utf-8") as f:
            json.dump(cookies, f, indent=2)
        print(f"      Cookies guardadas en '{OUTPUT_COOKIES}' ({len(cookies)} cookie/s)")

        browser.close()

    # ── 5b. Enviar a Google Sheets ─────────────────────────────────────────
    print("[5/5] Enviando datos a Google Sheets...")
    spreadsheet = get_or_create_sheet(gc)
    spreadsheet.sheet1.append_row(row)

    sheet_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}"
    print(f"      Fila insertada correctamente")
    print(f"\n✓ Scraping completado.")
    print(f"  Sheet: {sheet_url}")


if __name__ == "__main__":
    scrape()


# ══════════════════════════════════════════════════════════════════════════════
# CÓMO ADAPTAR A UN CRM REAL CON CREDENCIALES DESDE .env
# ══════════════════════════════════════════════════════════════════════════════
#
# 1. Crea un archivo .env (NUNCA lo subas a git):
#
#       CRM_LOGIN_URL=https://tu-crm.com/login
#       CRM_USERNAME=tu_usuario
#       CRM_PASSWORD=tu_contraseña_segura
#
# 2. pip install python-dotenv  y al inicio del script:
#
#       from dotenv import load_dotenv
#       import os
#       load_dotenv()
#       LOGIN_URL = os.environ["CRM_LOGIN_URL"]
#       USERNAME  = os.environ["CRM_USERNAME"]
#       PASSWORD  = os.environ["CRM_PASSWORD"]
#
# 3. Ajusta los selectores CSS según el HTML de tu CRM.
#    Para generarlos automáticamente:
#       playwright codegen https://tu-crm.com/login
#
# 4. Para reutilizar la sesión sin hacer login cada vez:
#       context.storage_state(path="session_state.json")
#    Y luego:
#       context = browser.new_context(storage_state="session_state.json")
