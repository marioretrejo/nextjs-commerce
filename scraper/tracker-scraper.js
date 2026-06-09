/**
 * tracker-scraper.js — VoiceOS Marketing Finance
 *
 * Modo 1 — spy (DEFAULT):
 *   Abre el dashboard, introduce fechas, pulsa "Consultar" e intercepta
 *   TODAS las llamadas de red para descubrir el endpoint exacto que usa
 *   el tracker al filtrar. Imprime un bloque ── SPY REPORT ── en stderr
 *   con la URL completa, método, body y JSON de respuesta para cada llamada
 *   que cambia respecto al baseline. Esos datos se copian al route.ts.
 *
 * Modo 2 — extract (EXTRACT=1):
 *   Además del spy, extrae los tres bloques de métricas visibles en el DOM
 *   y los imprime como JSON en stdout.
 *
 * Uso:
 *   node scraper/tracker-scraper.js <fechaInicio> <fechaFin>
 *   EXTRACT=1 node scraper/tracker-scraper.js 2026-01-01 2026-06-07
 *   HEADLESS=false node scraper/tracker-scraper.js 2026-01-01 2026-06-07
 *
 * Variables de entorno:
 *   TRACKER_URL      URL base   (default: https://tracker.machukllc.xyz)
 *   TRACKER_USER     Email de login
 *   TRACKER_PASS     Password de login
 *   TRACKER_COOKIES  JSON array de cookies para saltarse el login
 *   HEADLESS         "false" para ver el navegador
 *   EXTRACT          "1" para extraer métricas del DOM además del spy
 *
 * Instalar (una sola vez):
 *   pnpm add -D playwright
 *   npx playwright install chromium
 */

import { chromium } from "playwright";
import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "..", ".env") });

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env["TRACKER_URL"] ?? "https://tracker.machukllc.xyz";
const TRACKER_USER = process.env["TRACKER_USER"] ?? "";
const TRACKER_PASS = process.env["TRACKER_PASS"] ?? "";
const HEADLESS = process.env["HEADLESS"] !== "false";
const EXTRACT = process.env["EXTRACT"] === "1";
const COOKIES_JSON = process.env["TRACKER_COOKIES"] ?? "";

const [, , fechaInicio, fechaFin] = process.argv;
if (!fechaInicio || !fechaFin) {
  console.error(
    "Uso: node scraper/tracker-scraper.js <fechaInicio> <fechaFin>",
  );
  process.exit(1);
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
if (!DATE_RE.test(fechaInicio) || !DATE_RE.test(fechaFin)) {
  console.error("Error: fechas deben ser YYYY-MM-DD");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function clearAndType(page, selector, value) {
  const el = page.locator(selector).first();
  await el.click({ clickCount: 3 });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await el.pressSequentially(value, { delay: 60 });
  await el.evaluate((node) =>
    node.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

async function extractMetric(page, selector) {
  try {
    const text = await page
      .locator(selector)
      .first()
      .innerText({ timeout: 4000 });
    return text.replace(/[^\d.,]/g, "").trim() || null;
  } catch {
    return null;
  }
}

async function findSelector(page, candidates) {
  for (const sel of candidates) {
    if ((await page.locator(sel).count()) > 0) return sel;
  }
  return null;
}

async function findMetricByLabel(page, labels) {
  for (const label of labels) {
    try {
      const el = page.locator(`text=${label}`).first();
      if ((await el.count()) === 0) continue;
      const parentText = await el
        .locator("xpath=..")
        .innerText({ timeout: 3000 });
      const nums = parentText.replace(/[^\d.,]/g, "").trim();
      if (nums) return nums;
    } catch {
      /* next */
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  });

  // ── 1. Inyectar cookies ───────────────────────────────────────────────────
  if (COOKIES_JSON) {
    try {
      await context.addCookies(JSON.parse(COOKIES_JSON));
      console.error("[auth] Cookies inyectadas.");
    } catch (e) {
      console.error("[auth] Error en TRACKER_COOKIES:", e.message);
    }
  }

  const page = await context.newPage();

  // ── 2. SPY: capturar TODAS las requests durante y después del clic ────────
  //    Guardamos baseline antes del clic, luego comparamos tras él.
  const capturedRequests = []; // { url, method, postData, responseBody, status }

  // Activar interceptación
  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();

    // Capturar requests relevantes (APIs, PHP endpoints — no assets estáticos)
    if (
      !/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)(\?|$)/i.test(url)
    ) {
      const entry = {
        url,
        method: req.method(),
        postData: req.postData() ?? null,
        // Incluir cookies — son clave para replicar la sesión en route.ts
        cookie: req.headers()["cookie"] ?? null,
        headers: Object.fromEntries(
          Object.entries(req.headers()).filter(
            ([k]) => !["user-agent"].includes(k),
          ),
        ),
        status: null,
        responseBody: null,
        responseJson: null,
      };

      try {
        const resp = await route.fetch();
        entry.status = resp.status();

        // Solo leer body en respuestas que parezcan datos (JSON / texto corto)
        const ct = resp.headers()["content-type"] ?? "";
        if (/json|text\/plain/.test(ct) && resp.status() < 400) {
          const body = await resp.text();
          entry.responseBody = body.slice(0, 2000); // primeros 2 KB
          try {
            entry.responseJson = JSON.parse(body);
          } catch {
            /* no es JSON */
          }
        }

        capturedRequests.push(entry);
        await route.fulfill({ response: resp });
      } catch (e) {
        capturedRequests.push({ ...entry, error: String(e) });
        await route.continue();
      }
    } else {
      await route.continue();
    }
  });

  // ── 3. Navegar ────────────────────────────────────────────────────────────
  console.error(`[nav] → ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

  // ── 4. Login ──────────────────────────────────────────────────────────────
  const isLogin = (await page.locator('input[type="password"]').count()) > 0;
  if (isLogin) {
    console.error("[auth] Formulario de login detectado, autenticando…");
    const emailSel =
      'input[name="email"], input[type="email"], input[name="username"]';
    const passSel = 'input[type="password"]';
    const submitSel = 'button[type="submit"], input[type="submit"]';
    await page.locator(emailSel).first().fill(TRACKER_USER);
    await page.locator(passSel).first().fill(TRACKER_PASS);

    // Marcar requests del login para excluirlas del spy
    const loginReqCount = capturedRequests.length;
    await page.locator(submitSel).first().click();
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
    await page.waitForTimeout(1500);

    if ((await page.locator('input[type="password"]').count()) > 0) {
      console.error(
        "[auth] ERROR: Login fallido — verifica TRACKER_USER / TRACKER_PASS en .env",
      );
      await browser.close();
      process.exit(2);
    }
    console.error(
      `[auth] Login OK (+${capturedRequests.length - loginReqCount} requests de login)`,
    );
    // Limpiar requests del login — no son relevantes para el spy de fecha
    capturedRequests.length = loginReqCount;
  } else {
    console.error("[auth] Sesión activa por cookies.");
  }

  await page
    .waitForLoadState("networkidle", { timeout: 20_000 })
    .catch(() => null);
  await page.waitForTimeout(800);

  // ── 5. Tomar snapshot baseline de requests (antes del clic) ──────────────
  const baselineCount = capturedRequests.length;
  // También registrar URLs que devuelven el numero de FTDs "baseline"
  const baselineFtdUrls = new Set(
    capturedRequests
      .filter(
        (r) => r.responseJson && JSON.stringify(r.responseJson).includes("21"),
      )
      .map((r) => r.url),
  );

  // ── 6. Introducir fechas ──────────────────────────────────────────────────
  console.error(`[filter] ${fechaInicio} → ${fechaFin}`);

  const dateFromCandidates = [
    'input[name="date_from"]',
    'input[name="dateFrom"]',
    'input[name="from"]',
    'input[id="date_from"]',
    'input[id="dateFrom"]',
    'input[placeholder*="from" i]',
    'input[placeholder*="inicio" i]',
    'form input[type="date"]:first-of-type',
    '.filter input[type="text"]:first-of-type',
  ];
  const dateToCandidates = [
    'input[name="date_to"]',
    'input[name="dateTo"]',
    'input[name="to"]',
    'input[id="date_to"]',
    'input[id="dateTo"]',
    'input[placeholder*="to" i]',
    'input[placeholder*="fin" i]',
    'form input[type="date"]:last-of-type',
    '.filter input[type="text"]:last-of-type',
  ];

  const fromSel = await findSelector(page, dateFromCandidates);
  const toSel = await findSelector(page, dateToCandidates);

  if (fromSel) {
    await clearAndType(page, fromSel, fechaInicio);
    console.error(`[filter] fecha inicio → ${fromSel}`);
  } else {
    console.error("[filter] ⚠️  No se encontró input de fecha inicio");
  }
  if (toSel) {
    await clearAndType(page, toSel, fechaFin);
    console.error(`[filter] fecha fin → ${toSel}`);
  } else {
    console.error("[filter] ⚠️  No se encontró input de fecha fin");
  }

  // ── 7. Click en "Consultar" + captura de requests nuevas ─────────────────
  const buttonCandidates = [
    'button:has-text("Consultar")',
    'input[type="submit"][value*="Consultar" i]',
    'button:has-text("Search")',
    'button:has-text("Buscar")',
    'button:has-text("Filter")',
    'button:has-text("Filtrar")',
    'input[type="submit"]',
    'button[type="submit"]',
  ];
  const btnSel = await findSelector(page, buttonCandidates);
  if (!btnSel) {
    const btns = await page
      .locator('button, input[type="submit"]')
      .allInnerTexts();
    console.error(
      "[filter] ⚠️  Botón no encontrado. Textos disponibles:",
      btns.slice(0, 8),
    );
  } else {
    console.error(`[filter] Click → ${btnSel}`);
    await page.locator(btnSel).first().click();
  }

  // Esperar respuesta de red
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => null);
  await page.waitForTimeout(1800);

  // ── 8. SPY REPORT — requests nuevas tras el clic ──────────────────────────
  const newRequests = capturedRequests.slice(baselineCount);

  console.error("\n" + "═".repeat(70));
  console.error(
    '  SPY REPORT — requests capturadas tras el clic en "Consultar"',
  );
  console.error("═".repeat(70));

  if (newRequests.length === 0) {
    console.error(
      "  ⚠️  NINGUNA request nueva. El botón no disparó llamadas de red.",
    );
    console.error(
      "  → El tracker puede estar filtrando solo en el cliente (JS local).",
    );
    console.error(
      "  → Corre con HEADLESS=false para inspeccionarlo manualmente.",
    );
  }

  for (const [i, r] of newRequests.entries()) {
    const isJson = r.responseJson !== null;
    const hasData =
      isJson && Array.isArray(r.responseJson) && r.responseJson.length > 0;
    const marker = hasData ? "🟢 DATA" : isJson ? "🔵 JSON" : "⚪ TEXT";

    console.error(`\n[${i + 1}] ${marker} ${r.method} ${r.url}`);
    if (r.postData) {
      console.error(`    BODY: ${r.postData.slice(0, 400)}`);
    }
    console.error(`    STATUS: ${r.status}`);

    if (isJson) {
      const preview = JSON.stringify(r.responseJson).slice(0, 600);
      console.error(`    JSON:  ${preview}`);
    } else if (r.responseBody) {
      console.error(`    BODY:  ${r.responseBody.slice(0, 300)}`);
    }
    if (r.error) console.error(`    ERROR: ${r.error}`);
  }

  // Resumen accionable
  const dataRequests = newRequests.filter(
    (r) =>
      r.responseJson &&
      Array.isArray(r.responseJson) &&
      r.responseJson.length > 1,
  );
  console.error("\n" + "─".repeat(70));
  if (dataRequests.length > 0) {
    console.error(
      `\n✅ CANDIDATOS (${dataRequests.length} request(s) con arrays de datos):`,
    );
    for (const r of dataRequests) {
      console.error(`\n  Método:  ${r.method}`);
      console.error(`  URL:     ${r.url}`);
      if (r.postData) console.error(`  Body:    ${r.postData.slice(0, 600)}`);
      const hdrs = r.responseJson?.[0];
      if (Array.isArray(hdrs)) console.error(`  Columns: ${hdrs.join(", ")}`);
      if (r.cookie) console.error(`  Cookie:  ${r.cookie}`);
    }
  } else {
    console.error(
      "\n  ℹ️  Sin requests con arrays de datos — revisa la lista arriba.",
    );
  }

  // ── TRACKER_COOKIES export ────────────────────────────────────────────────
  // Obtener las cookies actuales del contexto (post login + interacción)
  const allCookies = await context.cookies();
  const cookieJson = JSON.stringify(
    allCookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    })),
  );
  console.error("\n" + "─".repeat(70));
  console.error(
    "\n📋 TRACKER_COOKIES (pega esto en tu .env o en Vercel → Env Vars):",
  );
  console.error("\nTRACKER_COOKIES=" + cookieJson);
  console.error(
    "\nEsta sesión dura mientras el tracker no la expire (normalmente horas/días).",
  );
  console.error("═".repeat(70) + "\n");

  // ── 9. Extraer métricas del DOM (si EXTRACT=1) ────────────────────────────
  const metrics = {
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    total_leads: null,
    ftd_originales: null,
    cpa_total: null,
    _extracted_at: new Date().toISOString(),
    _url: page.url(),
  };

  if (EXTRACT) {
    const DIRECT_SELECTORS = {
      total_leads: [
        "#total_leads",
        '[data-metric="leads"]',
        ".stat-leads .value",
      ],
      ftd_originales: [
        "#ftd_originales",
        "#original_ftds",
        '[data-metric="ftd"]',
      ],
      cpa_total: ["#cpa_total", '[data-metric="cpa"]', ".stat-cpa .value"],
    };
    for (const [key, sels] of Object.entries(DIRECT_SELECTORS)) {
      for (const sel of sels) {
        const v = await extractMetric(page, sel);
        if (v) {
          metrics[key] = v;
          break;
        }
      }
    }
    if (!metrics.total_leads)
      metrics.total_leads = await findMetricByLabel(page, [
        "TOTAL LEADS",
        "Total Leads",
        "LEADS",
      ]);
    if (!metrics.ftd_originales)
      metrics.ftd_originales = await findMetricByLabel(page, [
        "FTD ORIGINALES",
        "FTDs Originales",
        "FTD",
      ]);
    if (!metrics.cpa_total)
      metrics.cpa_total = await findMetricByLabel(page, [
        "CPA TOTAL",
        "Total CPA",
        "CPA",
      ]);

    console.log(JSON.stringify(metrics, null, 2));
  }

  await browser.close();
}

run().catch((err) => {
  console.error("[error]", err.message);
  process.exit(1);
});
