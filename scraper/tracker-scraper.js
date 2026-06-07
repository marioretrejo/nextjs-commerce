/**
 * tracker-scraper.js — VoiceOS Marketing Finance
 *
 * Abre el dashboard de https://tracker.machukllc.xyz con un navegador
 * headless (Playwright), introduce las fechas dinámicamente, pulsa
 * "Consultar" y extrae los tres bloques de métricas.
 *
 * Uso:
 *   node scraper/tracker-scraper.js <fechaInicio> <fechaFin>
 *   node scraper/tracker-scraper.js 2026-01-01 2026-06-07
 *
 * Variables de entorno (opcionales — sobrescriben los valores por defecto):
 *   TRACKER_URL   URL base del panel  (default: https://tracker.machukllc.xyz)
 *   TRACKER_USER  Email de login
 *   TRACKER_PASS  Password de login
 *   TRACKER_COOKIES  JSON string con array de cookies para saltarse el login
 *                    Ejemplo: '[{"name":"PHPSESSID","value":"abc123","domain":"tracker.machukllc.xyz"}]'
 *   HEADLESS      "false" para ver el navegador (útil al depurar)
 *
 * Instalar dependencias (una sola vez):
 *   pnpm add -D playwright
 *   npx playwright install chromium
 */

import { chromium } from 'playwright';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Cargar .env desde la raíz del proyecto ────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '..', '.env') });

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL       = process.env['TRACKER_URL']  ?? 'https://tracker.machukllc.xyz';
const TRACKER_USER   = process.env['TRACKER_USER'] ?? '';
const TRACKER_PASS   = process.env['TRACKER_PASS'] ?? '';
const HEADLESS       = process.env['HEADLESS'] !== 'false';
const COOKIES_JSON   = process.env['TRACKER_COOKIES'] ?? '';   // Override de sesión

// ── Argumentos CLI ────────────────────────────────────────────────────────────
const [, , fechaInicio, fechaFin] = process.argv;

if (!fechaInicio || !fechaFin) {
  console.error('Uso: node scraper/tracker-scraper.js <fechaInicio> <fechaFin>');
  console.error('     Ejemplo: node scraper/tracker-scraper.js 2026-01-01 2026-06-07');
  process.exit(1);
}

// Validar formato YYYY-MM-DD
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
if (!DATE_RE.test(fechaInicio) || !DATE_RE.test(fechaFin)) {
  console.error('Error: las fechas deben tener formato YYYY-MM-DD');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Limpia el contenido de un <input> con Ctrl+A + Delete y escribe el nuevo valor.
 * Más robusto que triple-click en campos con datepickers.
 */
async function clearAndType(page, selector, value) {
  const el = page.locator(selector).first();
  await el.click({ clickCount: 3 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await el.pressSequentially(value, { delay: 60 });
  // Disparar evento 'change' por si el campo es reactivo
  await el.evaluate(node => node.dispatchEvent(new Event('change', { bubbles: true })));
}

/**
 * Extrae el texto limpio (sin símbolos ni espacios extra) de un selector.
 * Devuelve null si el elemento no existe.
 */
async function extractMetric(page, selector) {
  try {
    const el = page.locator(selector).first();
    const text = await el.innerText({ timeout: 5000 });
    // Quitar todo excepto dígitos, puntos y comas
    return text.replace(/[^\d.,]/g, '').trim() || null;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  });

  // ── 1. Inyectar cookies de sesión (si se proporcionaron) ──────────────────
  if (COOKIES_JSON) {
    try {
      const cookies = JSON.parse(COOKIES_JSON);
      await context.addCookies(cookies);
      console.error('[auth] Cookies de sesión inyectadas, saltando login.');
    } catch (e) {
      console.error('[auth] Error parseando TRACKER_COOKIES:', e.message);
    }
  }

  const page = await context.newPage();

  // ── 2. Navegar al panel ────────────────────────────────────────────────────
  console.error(`[nav] Abriendo ${BASE_URL} …`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // ── 3. Login (si no inyectamos cookies) ───────────────────────────────────
  const isLoginPage = await page.locator('input[name="password"], input[type="password"]').count() > 0;

  if (isLoginPage) {
    console.error('[auth] Formulario de login detectado, autenticando…');

    // -----------------------------------------------------------------
    // BLOQUE DE LOGIN — ajustar selectores si el HTML cambia
    // -----------------------------------------------------------------
    const emailSel    = 'input[name="email"], input[type="email"], input[name="username"]';
    const passSel     = 'input[name="password"], input[type="password"]';
    const submitSel   = 'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Entrar"), button:has-text("Iniciar")';

    await page.locator(emailSel).first().fill(TRACKER_USER);
    await page.locator(passSel).first().fill(TRACKER_PASS);
    await page.locator(submitSel).first().click();

    // Esperar a que el panel cargue tras el login
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
    await page.waitForTimeout(1500);

    const stillLogin = await page.locator('input[name="password"], input[type="password"]').count() > 0;
    if (stillLogin) {
      console.error('[auth] ERROR: Login fallido — verifica TRACKER_USER / TRACKER_PASS');
      await browser.close();
      process.exit(2);
    }
    console.error('[auth] Login exitoso.');
    // -----------------------------------------------------------------
  } else {
    console.error('[auth] Sesión activa por cookies, no se requiere login.');
  }

  // Esperar a que el panel principal esté visible
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(1000);

  // ── 4. Introducir fechas ───────────────────────────────────────────────────
  console.error(`[filter] Estableciendo rango: ${fechaInicio} → ${fechaFin}`);

  // -----------------------------------------------------------------
  // BLOQUE DE FECHAS — los selectores más habituales en paneles PHP/Bootstrap.
  // Si el panel usa un datepicker custom, puede que haya que adaptar esto.
  // -----------------------------------------------------------------
  const dateFromSelectors = [
    'input[name="date_from"]',
    'input[name="dateFrom"]',
    'input[name="from"]',
    'input[id="date_from"]',
    'input[id="dateFrom"]',
    'input[placeholder*="from" i]',
    'input[placeholder*="inicio" i]',
    'input[placeholder*="desde" i]',
    // Primer input de tipo date en el área del filtro
    'form input[type="date"]:nth-of-type(1)',
    '.filter input[type="text"]:nth-of-type(1)',
    '#filters input[type="text"]:nth-of-type(1)',
  ];

  const dateToSelectors = [
    'input[name="date_to"]',
    'input[name="dateTo"]',
    'input[name="to"]',
    'input[id="date_to"]',
    'input[id="dateTo"]',
    'input[placeholder*="to" i]',
    'input[placeholder*="fin" i]',
    'input[placeholder*="hasta" i]',
    'form input[type="date"]:nth-of-type(2)',
    '.filter input[type="text"]:nth-of-type(2)',
    '#filters input[type="text"]:nth-of-type(2)',
  ];

  /**
   * Intenta cada selector de la lista; devuelve el primero que encuentre un
   * elemento visible en la página.
   */
  async function findSelector(page, candidates) {
    for (const sel of candidates) {
      const count = await page.locator(sel).count();
      if (count > 0) return sel;
    }
    return null;
  }

  const fromSel = await findSelector(page, dateFromSelectors);
  const toSel   = await findSelector(page, dateToSelectors);

  if (!fromSel) {
    console.error('[filter] ADVERTENCIA: No se encontró input de fecha inicio. Prueba HEADLESS=false para inspeccionar el DOM.');
  } else {
    await clearAndType(page, fromSel, fechaInicio);
    console.error(`[filter] Fecha inicio escrita: ${fechaInicio} → (${fromSel})`);
  }

  if (!toSel) {
    console.error('[filter] ADVERTENCIA: No se encontró input de fecha fin.');
  } else {
    await clearAndType(page, toSel, fechaFin);
    console.error(`[filter] Fecha fin escrita: ${fechaFin} → (${toSel})`);
  }

  // ── 5. Click en el botón "Consultar" ──────────────────────────────────────
  // -----------------------------------------------------------------
  // BLOQUE BOTÓN — ajustar si el texto o tipo de botón cambia
  // -----------------------------------------------------------------
  const buttonSelectors = [
    'button:has-text("Consultar")',
    'input[type="submit"][value*="Consultar" i]',
    'button:has-text("Search")',
    'button:has-text("Buscar")',
    'button:has-text("Filter")',
    'button:has-text("Filtrar")',
    'input[type="submit"]',
    'button[type="submit"]',
  ];

  const btnSel = await findSelector(page, buttonSelectors);
  if (!btnSel) {
    console.error('[filter] ADVERTENCIA: No se encontró el botón "Consultar". Listando botones visibles:');
    const buttons = await page.locator('button, input[type="submit"]').allInnerTexts();
    console.error('[filter]', buttons.slice(0, 10));
  } else {
    console.error(`[filter] Click en botón → (${btnSel})`);
    await page.locator(btnSel).first().click();
  }

  // ── 6. Espera inteligente — el DOM actualiza los bloques de métricas ───────
  console.error('[wait] Esperando actualización del DOM…');
  // Esperar a que termine la carga de red + 1.5s de buffer para renderizado JS
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null);
  await page.waitForTimeout(1500);

  // ── 7. Extraer métricas ────────────────────────────────────────────────────
  // -----------------------------------------------------------------
  // BLOQUE DE EXTRACCIÓN — los selectores apuntan a los contenedores de texto
  // visibles en la interfaz del panel. Si cambia el HTML, ajustar aquí.
  // Estrategia: buscar el texto "TOTAL LEADS" y tomar el número hermano.
  // -----------------------------------------------------------------

  /**
   * Estrategia 1: selectores directos por data-* atributos o IDs conocidos
   */
  const METRIC_SELECTORS = {
    total_leads:     ['#total_leads', '[data-metric="leads"]', '.stat-leads .value', '.total-leads'],
    ftd_originales:  ['#ftd_originales', '#original_ftds', '[data-metric="ftd"]', '.stat-ftd .value', '.ftd-original'],
    cpa_total:       ['#cpa_total', '[data-metric="cpa"]', '.stat-cpa .value', '.cpa-total'],
  };

  /**
   * Estrategia 2: buscar por texto del label en toda la página.
   * Funciona cuando los paneles ponen el label como texto y el número
   * en un nodo hermano o hijo.
   */
  async function findMetricByLabel(page, labelTexts) {
    for (const label of labelTexts) {
      try {
        // Busca un elemento que contenga el label y devuelve el número que lo acompaña
        const el = page.locator(`text=${label}`).first();
        const count = await el.count();
        if (count === 0) continue;

        // Intentar tomar el siguiente elemento hermano (span/div con el número)
        const parent = el.locator('xpath=..');
        const parentText = await parent.innerText({ timeout: 3000 });
        const nums = parentText.replace(/[^\d.,]/g, '').trim();
        if (nums) return nums;

        // Intentar el texto del propio contenedor padre-padre
        const grandParent = el.locator('xpath=../..').first();
        const gpText = await grandParent.innerText({ timeout: 3000 });
        const gpNums = gpText.replace(/[^\d.,]/g, '').trim();
        if (gpNums) return gpNums;
      } catch { /* ignorar */ }
    }
    return null;
  }

  const metrics = {
    fecha_inicio:   fechaInicio,
    fecha_fin:      fechaFin,
    total_leads:    null,
    ftd_originales: null,
    cpa_total:      null,
    _extracted_at:  new Date().toISOString(),
    _url:           page.url(),
  };

  // Intentar selectores directos primero
  for (const [key, selectors] of Object.entries(METRIC_SELECTORS)) {
    for (const sel of selectors) {
      const val = await extractMetric(page, sel);
      if (val) { metrics[key] = val; break; }
    }
  }

  // Si alguna métrica sigue nula, usar búsqueda por label
  if (!metrics.total_leads) {
    metrics.total_leads = await findMetricByLabel(page,
      ['TOTAL LEADS', 'Total Leads', 'LEADS', 'Leads']);
  }
  if (!metrics.ftd_originales) {
    metrics.ftd_originales = await findMetricByLabel(page,
      ['FTD ORIGINALES', 'FTDs Originales', 'ORIGINAL FTD', 'FTD']);
  }
  if (!metrics.cpa_total) {
    metrics.cpa_total = await findMetricByLabel(page,
      ['CPA TOTAL', 'Total CPA', 'CPA', 'TOTAL CPA']);
  }

  // Diagnóstico: si todo sigue nulo, volcar texto visible de la página
  const allNull = !metrics.total_leads && !metrics.ftd_originales && !metrics.cpa_total;
  if (allNull) {
    console.error('[extract] ADVERTENCIA: No se encontraron métricas con los selectores conocidos.');
    console.error('[extract] Dumpeando texto de la página para diagnóstico:');
    const pageText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    // Imprimir primeras 3000 chars para detectar estructura real
    console.error(pageText.slice(0, 3000));
    console.error('\n[extract] Tip: corre con HEADLESS=false para ver el estado visual del DOM.');
  }

  await browser.close();

  // ── 8. Imprimir resultado como JSON limpio en stdout ──────────────────────
  console.log(JSON.stringify(metrics, null, 2));

  if (allNull) process.exit(3);
}

run().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
