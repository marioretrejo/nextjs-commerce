/**
 * Marketing Finance — Live Tracker Scraper
 * Logs in to tracker.machukllc.xyz, fetches campaign stats,
 * applies CPA pricing from Supabase, returns a finance report.
 *
 * Flow (confirmed by Playwright network spy):
 *   1. POST /login.php          → obtain session cookie
 *   2. GET  /crm.new.php        → warm up PHP $_SESSION (required before date filter works)
 *   3. GET  /get_data.php?type=stats_pb&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&…
 *                               → returns filtered JSON array
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const TRACKER_BASE = "https://tracker.machukllc.xyz";
const TRACKER_USER = process.env.TRACKER_USER ?? "";
const TRACKER_PASS = process.env.TRACKER_PASS ?? "";
// Pre-captured browser session cookies (from tracker-scraper.js spy).
// When set, bypasses the HTTP login flow which the tracker often rejects.
// Format: JSON array — [{"name":"PHPSESSID","value":"...","domain":"...","path":"/"}]
const TRACKER_COOKIES = process.env.TRACKER_COOKIES ?? "";

// ── CPA lookup ────────────────────────────────────────────────────────────────
type CpaMap = Map<string, number>;

async function loadCpaMap(): Promise<CpaMap> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mf_cpa_prices")
    .select("campaign, country, price");

  if (error || !data) {
    console.error("[mf] Failed to load CPA prices:", error?.message);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data) {
    map.set(`${row.campaign}|${row.country}`, Number(row.price));
  }
  return map;
}

function getCpaPrice(
  map: CpaMap,
  campaign: string,
  country: string,
): number | null {
  return (
    map.get(`${campaign}|${country}`) ?? map.get(`${campaign}|ALL`) ?? null
  );
}

// ── Country normalisation ─────────────────────────────────────────────────────
const COUNTRY_MAP: Record<string, string> = {
  AR: "Argentina",
  CO: "Colombia",
  MX: "Mexico",
  UY: "Uruguay",
  EC: "Ecuador",
  PE: "Peru",
  NI: "Nicaragua",
  CR: "Costa Rica",
  HN: "Honduras",
  VE: "Venezuela",
  BO: "Bolivia",
  PY: "Paraguay",
  CL: "Chile",
  BR: "Brazil",
  GT: "Guatemala",
  SV: "El Salvador",
  DO: "Dominican Republic",
  PA: "Panama",
  CU: "Cuba",
  PR: "Puerto Rico",
  US: "United States",
  ES: "Spain",
  GB: "United Kingdom",
};

function normalizeCountry(raw: string): string {
  return COUNTRY_MAP[raw.trim().toUpperCase()] ?? raw.trim();
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
function extractCookies(headers: Headers): string[] {
  type H = Headers & { getSetCookie?: () => string[] };
  const h = headers as H;
  if (typeof h.getSetCookie === "function") {
    return (h.getSetCookie() ?? []).map((c) => c.split(";")[0]!.trim());
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw
    .split(/,(?=[^ ])/)
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean);
}

function mergeCookies(base: string, additions: string[]): string {
  const map = new Map<string, string>();
  for (const c of [...base.split("; "), ...additions].filter(Boolean)) {
    const idx = c.indexOf("=");
    if (idx > 0) map.set(c.slice(0, idx), c);
  }
  return [...map.values()].join("; ");
}

function makeSignal(ms: number) {
  return AbortSignal.timeout(ms);
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

// ── Step 1: Login ─────────────────────────────────────────────────────────────
async function loginTracker(): Promise<string | null> {
  const body = new URLSearchParams({
    email: TRACKER_USER,
    password: TRACKER_PASS,
    login: "",
    theme: "",
  });

  let res: Response;
  try {
    res = await fetch(`${TRACKER_BASE}/login.php`, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html,*/*",
      },
      body: body.toString(),
      redirect: "manual",
      signal: makeSignal(20_000),
    });
  } catch (e) {
    console.error("[mf] login POST error:", e);
    return null;
  }

  const cookies: string[] = [...extractCookies(res.headers)];

  // Follow up to 3 redirects manually to collect all Set-Cookie headers
  let cur = res;
  for (let i = 0; i < 3; i++) {
    const loc = cur.headers.get("location");
    if (!loc || cur.status < 300 || cur.status >= 400) break;
    const url = loc.startsWith("http")
      ? loc
      : `${TRACKER_BASE}/${loc.replace(/^\//, "")}`;
    try {
      cur = await fetch(url, {
        headers: {
          ...BROWSER_HEADERS,
          Cookie: cookies.join("; "),
          Accept: "text/html,*/*",
        },
        redirect: "manual",
        signal: makeSignal(15_000),
      });
      cookies.push(...extractCookies(cur.headers));
    } catch {
      break;
    }
  }

  const joined = cookies.join("; ");
  console.log("[mf] login → cookies:", cookies.length, "cookie(s)");
  return cookies.length > 0 ? joined : null;
}

// ── Step 2: Warm-up — visit crm.new.php to initialise PHP $_SESSION ───────────
// The tracker stores the active date range in the PHP session. Without visiting
// crm.new.php first, get_data.php ignores date_from/date_to and returns all-time data.
async function warmUpSession(cookie: string): Promise<string> {
  try {
    const res = await fetch(`${TRACKER_BASE}/crm.new.php`, {
      headers: { ...BROWSER_HEADERS, Cookie: cookie, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: makeSignal(15_000),
    });
    const updated = mergeCookies(cookie, extractCookies(res.headers));
    console.log("[mf] warm-up crm.new.php →", res.status);
    return updated;
  } catch (e) {
    console.warn("[mf] warm-up failed (continuing):", e);
    return cookie;
  }
}

// ── Step 3: Fetch stats ───────────────────────────────────────────────────────
// Confirmed URL format from Playwright network spy:
//   GET /get_data.php?type=stats_pb&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&export=1&…
const STATS_PARAMS =
  "type=stats_pb&export=1&stats_type=Campaigns&sec_stats_type=Sub+Sources&third_stats_type=Country&id=0";

async function fetchStats(
  cookie: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ data: unknown[][] | null; detail: string }> {
  const dateQs =
    dateFrom && dateTo
      ? `&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`
      : "";

  const url = `${TRACKER_BASE}/get_data.php?${STATS_PARAMS}${dateQs}`;
  console.log("[mf] fetching:", url);

  try {
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Cookie: cookie,
        Accept: "application/json, text/plain, */*",
        Referer: `${TRACKER_BASE}/crm.new.php`,
      },
      signal: makeSignal(20_000),
    });

    if (!res.ok) return { data: null, detail: `HTTP ${res.status}` };
    const text = await res.text();
    if (text.includes('name="password"'))
      return { data: null, detail: "session_expired" };

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { data: null, detail: `not_json: ${text.slice(0, 80)}` };
    }

    if (!Array.isArray(parsed) || parsed.length < 2) {
      return { data: null, detail: `bad_format: ${text.slice(0, 80)}` };
    }

    const hdrs = (parsed[0] as string[]).map(String);
    const rows = (parsed as unknown[][]).length - 1;
    console.log("[mf] got", rows, "rows | headers:", hdrs.join(", "));
    return { data: parsed as unknown[][], detail: "ok" };
  } catch (e) {
    return { data: null, detail: String(e) };
  }
}

// ── Build finance report ──────────────────────────────────────────────────────
export interface FinanceRow {
  campaign: string;
  subsource: string;
  country: string;
  leads: number;
  ftds: number;
  cr_pct: number;
  unit_price: number | null;
  cpa_total: number;
}

export interface FinanceReport {
  total_leads: number;
  total_ftds: number;
  original_ftds: number;
  duplicate_ftds: number;
  total_cpa: number;
  ecpa: number;
  detail: FinanceRow[];
  scraped_at: string;
  error?: string;
  _debug?: string[];
}

function buildReport(rawData: unknown[][], cpaMap: CpaMap): FinanceReport {
  const headers = (rawData[0] as string[]).map(String);
  const rows = rawData.slice(1);
  const subsrcKey = headers.find((h) => /sub.?source/i.test(h)) ?? "";

  let totalLeads = 0,
    totalFtds = 0,
    totalCpa = 0,
    dupFtds = 0;
  const detail: FinanceRow[] = [];

  for (const row of rows) {
    const rec = Object.fromEntries(
      headers.map((h, i) => [h, String((row as unknown[])[i] ?? "")]),
    );
    const campaign = (rec["Campaigns"] ?? rec["Campaign"] ?? "").trim();
    const subsource = (subsrcKey ? (rec[subsrcKey] ?? "") : "").trim();
    const country = normalizeCountry(rec["Country"] ?? "");
    const leads = parseInt((rec["Leads"] ?? "0").replace(/,/g, ""), 10) || 0;
    const ftds = parseInt((rec["FTDs"] ?? "0").replace(/,/g, ""), 10) || 0;

    const price = getCpaPrice(cpaMap, campaign, country);
    const rowCpa = price !== null ? ftds * price : 0;
    if (price === null) dupFtds += ftds;

    totalLeads += leads;
    totalFtds += ftds;
    totalCpa += rowCpa;

    detail.push({
      campaign,
      subsource,
      country,
      leads,
      ftds,
      cr_pct: leads > 0 ? Math.round((ftds / leads) * 1000) / 10 : 0,
      unit_price: price,
      cpa_total: rowCpa,
    });
  }

  detail.sort((a, b) => b.cpa_total - a.cpa_total);

  return {
    total_leads: totalLeads,
    total_ftds: totalFtds,
    original_ftds: totalFtds - dupFtds,
    duplicate_ftds: dupFtds,
    total_cpa: Math.round(totalCpa * 100) / 100,
    ecpa: totalFtds > 0 ? Math.round((totalCpa / totalFtds) * 100) / 100 : 0,
    detail,
    scraped_at: new Date().toISOString(),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("from") ?? undefined;
  const dateTo = url.searchParams.get("to") ?? undefined;

  // ── Resolve session cookie ────────────────────────────────────────────────
  // Priority 1: pre-captured browser session (TRACKER_COOKIES env var)
  //   Set via: node scraper/tracker-scraper.js <from> <to>  → copy the printed TRACKER_COOKIES line
  // Priority 2: HTTP login flow (less reliable — tracker may reject headless sessions)
  let cookie: string;

  if (TRACKER_COOKIES) {
    try {
      const parsed = JSON.parse(TRACKER_COOKIES) as Array<{
        name: string;
        value: string;
      }>;
      cookie = parsed.map((c) => `${c.name}=${c.value}`).join("; ");
      console.log(
        "[mf] using TRACKER_COOKIES env var →",
        parsed.length,
        "cookie(s)",
      );
    } catch {
      console.error(
        "[mf] TRACKER_COOKIES is not valid JSON — falling back to login",
      );
      cookie = "";
    }
  }

  const [cpaMap, loginCookie] = await Promise.all([
    loadCpaMap(),
    cookie! ? Promise.resolve(null) : loginTracker(),
  ]);

  if (!cookie!) {
    if (!loginCookie) {
      return NextResponse.json(
        {
          error:
            "No se pudo autenticar en el tracker (configura TRACKER_COOKIES en .env)",
          total_leads: 0,
          total_ftds: 0,
          original_ftds: 0,
          duplicate_ftds: 0,
          total_cpa: 0,
          ecpa: 0,
          detail: [],
          scraped_at: new Date().toISOString(),
        } satisfies FinanceReport,
        { status: 502 },
      );
    }
    // Step 2: warm up session so PHP initialises $_SESSION date vars
    cookie = await warmUpSession(loginCookie);
  }

  // Step 3: fetch stats (with or without date filter)
  const { data: raw, detail } = await fetchStats(cookie, dateFrom, dateTo);

  if (!raw) {
    return NextResponse.json(
      {
        error: `No se pudo obtener datos del tracker: ${detail}`,
        total_leads: 0,
        total_ftds: 0,
        original_ftds: 0,
        duplicate_ftds: 0,
        total_cpa: 0,
        ecpa: 0,
        detail: [],
        scraped_at: new Date().toISOString(),
      } satisfies FinanceReport,
      { status: 502 },
    );
  }

  return NextResponse.json(buildReport(raw, cpaMap));
}
