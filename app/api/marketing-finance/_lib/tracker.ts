/**
 * Marketing Finance — Live Tracker Scraper
 * Logs in to tracker.machukllc.xyz, fetches campaign stats.
 *
 * Flow (confirmed by Playwright network spy):
 *   1. POST /login.php          → obtain session cookie
 *   2. GET  /crm.new.php        → warm up PHP $_SESSION (required before date filter works)
 *   3. GET  /get_data.php?type=stats_pb&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&…
 *                               → returns filtered JSON array
 */

const TRACKER_BASE = "https://tracker.machukllc.xyz";
const TRACKER_USER = process.env.TRACKER_USER ?? "";
const TRACKER_PASS = process.env.TRACKER_PASS ?? "";

// ── Cookie helpers ────────────────────────────────────────────────────────────
export function extractCookies(headers: Headers): string[] {
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
export async function loginTracker(): Promise<string | null> {
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
export async function warmUpSession(cookie: string): Promise<string> {
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

export async function fetchStats(
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
