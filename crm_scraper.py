"""
Playwright login scraper - sitio de prueba: the-internet.herokuapp.com
Para adaptar a un CRM real, ver comentarios al final del archivo.
"""

import csv
import json
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

LOGIN_URL = "https://the-internet.herokuapp.com/login"
USERNAME  = "tomsmith"
PASSWORD  = "SuperSecretPassword!"

OUTPUT_COOKIES = "cookies.json"
OUTPUT_CSV     = "resultado.csv"


def scrape():
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
            flash = page.locator(".flash.success")
            flash.wait_for(timeout=5000)
            login_ok = True
        except PlaywrightTimeout:
            login_ok = False

        if not login_ok:
            error_text = page.locator(".flash.error").inner_text() if page.locator(".flash.error").count() else "Sin mensaje de error"
            print(f"      LOGIN FALLIDO: {error_text}")
            browser.close()
            return

        print(f"      Login exitoso. URL: {page.url}")

        # ── 4. Extraer datos de la página ──────────────────────────────────
        print("[4/5] Extrayendo datos...")
        flash_msg    = page.locator(".flash.success").inner_text().strip()
        page_title   = page.title()
        heading_text = page.locator("h2").first.inner_text().strip()
        body_text    = page.locator("#content .example").inner_text().strip()
        timestamp    = datetime.utcnow().isoformat() + "Z"

        extracted = {
            "url":         page.url,
            "page_title":  page_title,
            "heading":     heading_text,
            "flash_msg":   flash_msg,
            "body_text":   body_text,
            "scraped_at":  timestamp,
        }

        for k, v in extracted.items():
            print(f"      {k}: {v!r}")

        # ── 5a. Guardar cookies ────────────────────────────────────────────
        print("[5/5] Guardando cookies y exportando CSV...")
        cookies = context.cookies()
        with open(OUTPUT_COOKIES, "w", encoding="utf-8") as f:
            json.dump(cookies, f, indent=2)
        print(f"      Cookies guardadas en '{OUTPUT_COOKIES}' ({len(cookies)} cookie/s)")

        # ── 5b. Exportar CSV ───────────────────────────────────────────────
        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=extracted.keys())
            writer.writeheader()
            writer.writerow(extracted)
        print(f"      Datos exportados en '{OUTPUT_CSV}'")

        browser.close()
        print("\n✓ Scraping completado sin errores.")


if __name__ == "__main__":
    scrape()


# ══════════════════════════════════════════════════════════════════════════════
# CÓMO ADAPTAR A UN CRM REAL CON CREDENCIALES DESDE .env
# ══════════════════════════════════════════════════════════════════════════════
#
# 1. Crea un archivo .env en la misma carpeta (NUNCA lo subas a git):
#
#       CRM_LOGIN_URL=https://tu-crm.com/login
#       CRM_USERNAME=tu_usuario
#       CRM_PASSWORD=tu_contraseña_segura
#
# 2. Instala python-dotenv:
#       pip install python-dotenv
#
# 3. Reemplaza las constantes del tope por:
#
#       from dotenv import load_dotenv
#       import os
#       load_dotenv()
#       LOGIN_URL = os.environ["CRM_LOGIN_URL"]
#       USERNAME  = os.environ["CRM_USERNAME"]
#       PASSWORD  = os.environ["CRM_PASSWORD"]
#
# 4. Ajusta los selectores CSS/XPath según el HTML de tu CRM:
#       page.fill("#username", USERNAME)   →  selector del campo de usuario
#       page.fill("#password", PASSWORD)   →  selector del campo de contraseña
#       page.click('button[type="submit"]')→  selector del botón de envío
#
#    Para encontrar los selectores correctos:
#    - Abre DevTools en el CRM → clic derecho en el campo → "Inspeccionar"
#    - O usa: playwright codegen https://tu-crm.com/login
#      (genera el script automáticamente mientras navegás)
#
# 5. Para reutilizar la sesión en llamadas posteriores (sin hacer login de nuevo):
#       context.storage_state(path="session_state.json")
#    Y luego:
#       context = browser.new_context(storage_state="session_state.json")
