/**
 * Marketing Finance — Live Tracker Scraper
 * Logs in to tracker.machukllc.xyz, fetches campaign stats,
 * applies CPA pricing from Supabase, returns a finance report.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const TRACKER_BASE = 'https://tracker.machukllc.xyz';
const TRACKER_USER = process.env.TRACKER_USER ?? 'conversion@tresenlinea.xyz';
const TRACKER_PASS = process.env.TRACKER_PASS ?? '24731840Mt.';

// ── CPA lookup using Supabase table ──────────────────────────────────────────
type CpaMap = Map<string, number>; // key: "campaign|country" or "campaign|ALL"

async function loadCpaMap(): Promise<CpaMap> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('mf_cpa_prices')
    .select('campaign, country, price');

  if (error || !data) {
    console.error('[mf-scraper] Failed to load CPA prices from DB:', error?.message);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data) {
    map.set(`${row.campaign}|${row.country}`, Number(row.price));
  }
  return map;
}

function getCpaPrice(map: CpaMap, campaign: string, country: string): number | null {
  const exact = map.get(`${campaign}|${country}`);
  if (exact !== undefined) return exact;
  const wildcard = map.get(`${campaign}|ALL`);
  if (wildcard !== undefined) return wildcard;
  return null;
}

// ── Country code normalisation ────────────────────────────────────────────────
const COUNTRY_MAP: Record<string, string> = {
  AR: 'Argentina', CO: 'Colombia',  MX: 'Mexico',
  UY: 'Uruguay',   EC: 'Ecuador',   PE: 'Peru',
  NI: 'Nicaragua', CR: 'Costa Rica', HN: 'Honduras',
  VE: 'Venezuela', BO: 'Bolivia',   PY: 'Paraguay',
  CL: 'Chile',     BR: 'Brazil',    GT: 'Guatemala',
  SV: 'El Salvador', DO: 'Dominican Republic',
  PA: 'Panama',    CU: 'Cuba',      PR: 'Puerto Rico',
  US: 'United States', ES: 'Spain', GB: 'United Kingdom',
};

function normalizeCountry(raw: string): string {
  const up = raw.trim().toUpperCase();
  return COUNTRY_MAP[up] ?? raw.trim();
}

// ── Cookie helper ─────────────────────────────────────────────────────────────
function extractCookies(headers: Headers): string[] {
  type HeadersWithGetSetCookie = Headers & { getSetCookie?: () => string[] };
  const h = headers as HeadersWithGetSetCookie;
  if (typeof h.getSetCookie === 'function') {
    return (h.getSetCookie() ?? []).map(c => c.split(';')[0]!.trim());
  }
  const raw = headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=[^ ])/).map(c => c.split(';')[0]!.trim()).filter(Boolean);
}

function makeSignal(ms: number) {
  return AbortSignal.timeout(ms);
}

const BROWSER_HEADERS = {
  'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

// ── Tracker login ─────────────────────────────────────────────────────────────
async function loginTracker(): Promise<string | null> {
  const body = new URLSearchParams({
    email:    TRACKER_USER,
    password: TRACKER_PASS,
    login:    '',
    theme:    '',
  });

  const cookies: string[] = [];

  let res: Response;
  try {
    res = await fetch(`${TRACKER_BASE}/login.php`, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept':       'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      body:     body.toString(),
      redirect: 'manual',
      signal:   makeSignal(20_000),
    });
  } catch (e) {
    console.error('[mf-scraper] login POST error:', e);
    return null;
  }

  console.log('[mf-scraper] login status:', res.status, 'location:', res.headers.get('location'));
  cookies.push(...extractCookies(res.headers));

  let cur = res;
  for (let i = 0; i < 3; i++) {
    const loc = cur.headers.get('location');
    if (!loc || cur.status < 300 || cur.status >= 400) break;
    const url = loc.startsWith('http') ? loc : `${TRACKER_BASE}${loc}`;
    console.log('[mf-scraper] following redirect to:', url);
    try {
      cur = await fetch(url, {
        headers: {
          ...BROWSER_HEADERS,
          Cookie: cookies.join('; '),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual',
        signal:   makeSignal(15_000),
      });
    } catch (e) {
      console.error('[mf-scraper] redirect fetch error:', e);
      break;
    }
    cookies.push(...extractCookies(cur.headers));
    console.log('[mf-scraper] redirect', i + 1, 'status:', cur.status, 'new cookies:', extractCookies(cur.headers));
  }

  console.log('[mf-scraper] total cookies:', cookies.length, cookies.join('; ').slice(0, 80));
  return cookies.length > 0 ? cookies.join('; ') : null;
}

// ── Set date range in tracker PHP session ─────────────────────────────────────
// The tracker stores date filters in the PHP session via a form POST on crm.new.php.
// URL params on get_data.php are ignored — we must POST here first.
async function setTrackerDateRange(cookie: string, dateFrom: string, dateTo: string): Promise<string> {
  const formBody = new URLSearchParams({
    date_from:   dateFrom,
    date_to:     dateTo,
    stats_type:  'Campaigns',
    filter_type: 'date',
  });

  let updatedCookie = cookie;

  try {
    const res = await fetch(`${TRACKER_BASE}/crm.new.php`, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        Cookie:         cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept':       'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer':      `${TRACKER_BASE}/crm.new.php`,
      },
      body:     formBody.toString(),
      redirect: 'manual',
      signal:   makeSignal(15_000),
    });
    const newCookies = extractCookies(res.headers);
    if (newCookies.length > 0) {
      // Merge new cookies, replacing any existing ones with the same name
      const existing = new Map(cookie.split('; ').map(c => {
        const idx = c.indexOf('=');
        return [c.slice(0, idx), c] as [string, string];
      }));
      for (const nc of newCookies) {
        const idx = nc.indexOf('=');
        existing.set(nc.slice(0, idx), nc);
      }
      updatedCookie = [...existing.values()].join('; ');
    }
    console.log('[mf-scraper] date range set via POST to crm.new.php, status:', res.status);
  } catch (e) {
    console.warn('[mf-scraper] setTrackerDateRange failed (non-fatal):', e);
  }

  // Also try GET with date params as query string (some tracker versions use this)
  try {
    const getUrl = `${TRACKER_BASE}/crm.new.php?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&stats_type=Campaigns`;
    const res2 = await fetch(getUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Cookie:   updatedCookie,
        Accept:   'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer:  `${TRACKER_BASE}/crm.new.php`,
      },
      redirect: 'manual',
      signal:   makeSignal(10_000),
    });
    const newCookies2 = extractCookies(res2.headers);
    if (newCookies2.length > 0) {
      const existing = new Map(updatedCookie.split('; ').map(c => {
        const idx = c.indexOf('=');
        return [c.slice(0, idx), c] as [string, string];
      }));
      for (const nc of newCookies2) {
        const idx = nc.indexOf('=');
        existing.set(nc.slice(0, idx), nc);
      }
      updatedCookie = [...existing.values()].join('; ');
    }
    console.log('[mf-scraper] date range GET to crm.new.php, status:', res2.status);
  } catch (e) {
    console.warn('[mf-scraper] setTrackerDateRange GET failed (non-fatal):', e);
  }

  return updatedCookie;
}

// ── Fetch stats ───────────────────────────────────────────────────────────────
const STATS_BASE =
  '/get_data.php?type=stats_pb&export=1' +
  '&stats_type=Campaigns&sec_stats_type=SubSources' +
  '&third_stats_type=Country&id=0';

function buildStatsPath(dateFrom?: string, dateTo?: string): string {
  let path = STATS_BASE;
  if (dateFrom) path += `&date_from=${encodeURIComponent(dateFrom)}`;
  if (dateTo)   path += `&date_to=${encodeURIComponent(dateTo)}`;
  return path;
}

async function fetchStats(
  cookie: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ data: unknown[][] | null; detail: string; headers?: string[] }> {
  const path = buildStatsPath(dateFrom, dateTo);
  try {
    const res = await fetch(`${TRACKER_BASE}${path}`, {
      headers: {
        ...BROWSER_HEADERS,
        Cookie:  cookie,
        Accept:  'application/json, text/plain, */*',
        Referer: `${TRACKER_BASE}/crm.new.php`,
      },
      signal: makeSignal(20_000),
    });
    console.log('[mf-scraper] stats status:', res.status, 'content-type:', res.headers.get('content-type'));
    if (!res.ok) return { data: null, detail: `HTTP ${res.status}` };
    const text = await res.text();
    if (text.includes('name="password"') || text.trim().startsWith('<!')) {
      return { data: null, detail: 'Session expired after login' };
    }
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { data: null, detail: 'Response is not JSON' }; }
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return { data: null, detail: `Unexpected response format (${text.slice(0, 80)})` };
    }
    const arr = parsed as unknown[][];
    const hdrs = (arr[0] as string[]).map(String);
    console.log('[mf-scraper] column headers:', hdrs.join(', '));
    return { data: arr, detail: 'ok', headers: hdrs };
  } catch (e) {
    return { data: null, detail: String(e) };
  }
}

// ── Build finance report ──────────────────────────────────────────────────────
export interface FinanceRow {
  campaign:   string;
  subsource:  string;
  country:    string;
  leads:      number;
  ftds:       number;
  cr_pct:     number;
  unit_price: number | null;
  cpa_total:  number;
}

export interface FinanceReport {
  total_leads:    number;
  total_ftds:     number;
  original_ftds:  number;
  duplicate_ftds: number;
  total_cpa:      number;
  ecpa:           number;
  detail:         FinanceRow[];
  scraped_at:     string;
  error?:         string;
}

function buildReport(rawData: unknown[][], cpaMap: CpaMap): FinanceReport {
  const headers = (rawData[0] as string[]).map(String);
  const rows    = rawData.slice(1);

  // Find subsource column dynamically — the tracker may use various names
  const subsourceKey = headers.find(h =>
    /subsource|sub.?source/i.test(h)
  ) ?? '';

  let totalLeads = 0, totalFtds = 0, totalCpa = 0, dupFtds = 0;
  const detail: FinanceRow[] = [];

  for (const row of rows) {
    const rec = Object.fromEntries(headers.map((h, i) => [h, String((row as unknown[])[i] ?? '')]));
    const campaign  = (rec['Campaigns'] ?? rec['Campaign'] ?? '').trim();
    const subsource = (subsourceKey ? rec[subsourceKey] ?? '' : '').trim();
    const country   = normalizeCountry(rec['Country'] ?? '');
    const leads     = parseInt((rec['Leads'] ?? '0').replace(/,/g, ''), 10) || 0;
    const ftds      = parseInt((rec['FTDs']  ?? '0').replace(/,/g, ''), 10) || 0;

    const price  = getCpaPrice(cpaMap, campaign, country);
    const rowCpa = price !== null ? ftds * price : 0;
    if (price === null) dupFtds += ftds;

    totalLeads += leads;
    totalFtds  += ftds;
    totalCpa   += rowCpa;

    detail.push({
      campaign,
      subsource,
      country,
      leads,
      ftds,
      cr_pct:     leads > 0 ? Math.round((ftds / leads) * 1000) / 10 : 0,
      unit_price: price,
      cpa_total:  rowCpa,
    });
  }

  detail.sort((a, b) => b.cpa_total - a.cpa_total);

  return {
    total_leads:    totalLeads,
    total_ftds:     totalFtds,
    original_ftds:  totalFtds - dupFtds,
    duplicate_ftds: dupFtds,
    total_cpa:      Math.round(totalCpa * 100) / 100,
    ecpa:           totalFtds > 0 ? Math.round((totalCpa / totalFtds) * 100) / 100 : 0,
    detail,
    scraped_at: new Date().toISOString(),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('is_superadmin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url      = new URL(req.url);
  const dateFrom = url.searchParams.get('from') ?? undefined;
  const dateTo   = url.searchParams.get('to')   ?? undefined;

  // Load CPA prices from Supabase and log in to tracker concurrently
  const [cpaMap, cookie] = await Promise.all([
    loadCpaMap(),
    loginTracker(),
  ]);

  if (!cookie) {
    return NextResponse.json({
      error:          'Could not log in to tracker',
      total_leads: 0, total_ftds: 0, original_ftds: 0,
      duplicate_ftds: 0, total_cpa: 0, ecpa: 0, detail: [],
      scraped_at: new Date().toISOString(),
    } satisfies FinanceReport, { status: 502 });
  }

  // Set date range in PHP session if a custom range is requested
  let activeCookie = cookie;
  if (dateFrom || dateTo) {
    const from = dateFrom ?? '2020-01-01';
    const to   = dateTo   ?? new Date().toISOString().slice(0, 10);
    activeCookie = await setTrackerDateRange(cookie, from, to);
  }

  const { data: raw, detail } = await fetchStats(activeCookie, dateFrom, dateTo);
  if (!raw) {
    console.error('[mf-scraper] fetchStats failed:', detail);
    return NextResponse.json({
      error:          `No se pudo obtener datos del tracker: ${detail}`,
      total_leads: 0, total_ftds: 0, original_ftds: 0,
      duplicate_ftds: 0, total_cpa: 0, ecpa: 0, detail: [],
      scraped_at: new Date().toISOString(),
    } satisfies FinanceReport, { status: 502 });
  }

  const report = buildReport(raw, cpaMap);
  return NextResponse.json(report);
}
