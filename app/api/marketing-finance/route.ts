/**
 * Marketing Finance — Live Tracker Scraper
 * Logs in to tracker.machukllc.xyz, fetches campaign stats,
 * applies CPA pricing table, returns a finance report.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Give the function enough time to login + fetch (Vercel Hobby allows up to 60s)
export const maxDuration = 60;

const TRACKER_BASE = 'https://tracker.machukllc.xyz';
const TRACKER_USER = process.env.TRACKER_USER ?? 'conversion@tresenlinea.xyz';
const TRACKER_PASS = process.env.TRACKER_PASS ?? '24731840Mt.';

// ── CPA table (campaign → country → price) ──────────────────────────────────
const CPA_TABLE: Record<string, Record<string, number>> = {
  'FAFX':          { ALL: 750.00 },
  'X37':           { Uruguay: 650.00, Mexico: 750.00, Colombia: 750.00, Ecuador: 700.00 },
  'Xcore':         { Argentina: 750.00, Colombia: 700.00, Ecuador: 650.00, Mexico: 600.00 },
  'Flamad':        { Colombia: 750.00, Ecuador: 750.00, Mexico: 700.00, Argentina: 700.00 },
  'Oneclick':      { Colombia: 761.25, Argentina: 710.50, Ecuador: 710.50, Nicaragua: 761.25, Mexico: 761.25, Uruguay: 710.50, Peru: 761.25 },
  'KK5':           { Colombia: 650.00 },
  'Digify':        { Argentina: 750.00 },
  'Duckmedia':     { Argentina: 750.00, Colombia: 750.00 },
  'Xpoint':        { ALL: 750.00 },
  'Belmar':        { Colombia: 850.00, Uruguay: 800.00, Argentina: 850.00, Mexico: 850.00 },
  'Goat':          { ALL: 765.00 },
  'KV':            { Argentina: 623.63, Colombia: 727.57, Ecuador: 727.57 },
  'OceanLeads':    { Mexico: 700.00 },
  'Newton Group':  { ALL: 772.50 },
  'Emduel':        { 'Costa Rica': 750.00, Colombia: 750.00, Uruguay: 750.00, Honduras: 750.00, Argentina: 900.00 },
  'AMS':           { ALL: 750.00 },
  'NoLimits':      { ALL: 750.00 },
  'Traffomatic':   { ALL: 765.00 },
  'Tenx':          { ALL: 750.00 },
  'Casa Media':    { Argentina: 800.00 },
  'Academic Stock':{ Ecuador: 0.00, Argentina: 0.00 },
  'Hexie':         { Uruguay: 800.00 },
  'Intek':         { Argentina: 800.00 },
};

function getCpaPrice(campaign: string, country: string): number | null {
  const map = CPA_TABLE[campaign];
  if (!map) return null;
  if (map[country] !== undefined) return map[country];
  if (map['ALL'] !== undefined) return map['ALL'];
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
  // getSetCookie() is Node 18+ fetch
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

// ── Tracker login ─────────────────────────────────────────────────────────────
async function loginTracker(): Promise<string | null> {
  const body = new URLSearchParams({
    email:    TRACKER_USER,
    password: TRACKER_PASS,
    login:    '',
    theme:    '',
  });

  const cookies: string[] = [];

  // Step 1: POST login.php — follow redirects automatically and capture final cookies
  let res: Response;
  try {
    res = await fetch(`${TRACKER_BASE}/login.php`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept':        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
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

  // Follow up to 3 redirects manually to accumulate cookies
  let cur = res;
  for (let i = 0; i < 3; i++) {
    const loc = cur.headers.get('location');
    if (!loc || cur.status < 300 || cur.status >= 400) break;
    const url = loc.startsWith('http') ? loc : `${TRACKER_BASE}${loc}`;
    console.log('[mf-scraper] following redirect to:', url);
    try {
      cur = await fetch(url, {
        headers: {
          Cookie:          cookies.join('; '),
          'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
          'Accept':        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
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

  console.log('[mf-scraper] total cookies collected:', cookies.length, cookies.join('; ').slice(0, 80));
  return cookies.length > 0 ? cookies.join('; ') : null;
}

// ── Fetch stats with campaign × subsource × country (3 dimensions) ───────────
// This endpoint gives us Campaign, SubSource (traffic source), Country, Leads, FTDs
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

async function fetchStats(cookie: string, dateFrom?: string, dateTo?: string): Promise<{ data: unknown[][] | null; detail: string }> {
  const path = buildStatsPath(dateFrom, dateTo);
  try {
    const res = await fetch(`${TRACKER_BASE}${path}`, {
      headers: {
        Cookie:          cookie,
        'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept':        'application/json, text/plain, */*',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer':       `${TRACKER_BASE}/crm.new.php`,
      },
      signal: makeSignal(20_000),
    });
    console.log('[mf-scraper] stats status:', res.status, 'content-type:', res.headers.get('content-type'));
    if (!res.ok) return { data: null, detail: `HTTP ${res.status}` };
    const text = await res.text();
    // Detect session expiry — tracker returns HTML login page
    if (text.includes('name="password"') || text.trim().startsWith('<!')) {
      return { data: null, detail: 'Session expired after login' };
    }
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { data: null, detail: 'Response is not JSON' }; }
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return { data: null, detail: `Unexpected response format (${text.slice(0, 80)})` };
    }
    return { data: parsed as unknown[][], detail: 'ok' };
  } catch (e) {
    return { data: null, detail: String(e) };
  }
}

// ── Build finance report ──────────────────────────────────────────────────────
export interface FinanceRow {
  campaign:   string;
  subsource:  string;   // traffic source
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

function buildReport(rawData: unknown[][]): FinanceReport {
  const headers = (rawData[0] as string[]).map(String);
  const rows    = rawData.slice(1);

  let totalLeads = 0, totalFtds = 0, totalCpa = 0, dupFtds = 0;
  const detail: FinanceRow[] = [];

  for (const row of rows) {
    const rec = Object.fromEntries(headers.map((h, i) => [h, String((row as unknown[])[i] ?? '')]));
    const campaign  = (rec['Campaigns'] ?? rec['Campaign'] ?? '').trim();
    // SubSources header may appear as 'SubSources', 'Sub Sources', 'Sub Source', 'SubSource'
    const subsource = (rec['SubSources'] ?? rec['Sub Sources'] ?? rec['SubSource'] ?? rec['Sub Source'] ?? '').trim();
    const country   = normalizeCountry(rec['Country'] ?? '');
    const leads     = parseInt((rec['Leads'] ?? '0').replace(/,/g, ''), 10) || 0;
    const ftds      = parseInt((rec['FTDs']  ?? '0').replace(/,/g, ''), 10) || 0;

    const price  = getCpaPrice(campaign, country);
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
      cr_pct:    leads > 0 ? Math.round((ftds / leads) * 1000) / 10 : 0,
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
  // Auth: superadmin only
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
  const dateFrom = url.searchParams.get('from')  ?? undefined;
  const dateTo   = url.searchParams.get('to')    ?? undefined;

  // Login to tracker
  const cookie = await loginTracker();
  if (!cookie) {
    return NextResponse.json({
      error:          'Could not log in to tracker',
      total_leads:    0, total_ftds: 0, original_ftds: 0,
      duplicate_ftds: 0, total_cpa: 0, ecpa: 0, detail: [],
      scraped_at: new Date().toISOString(),
    } satisfies FinanceReport, { status: 502 });
  }

  // Fetch data with optional date range
  const { data: raw, detail } = await fetchStats(cookie, dateFrom, dateTo);
  if (!raw) {
    console.error('[mf-scraper] fetchStats failed:', detail);
    return NextResponse.json({
      error:          `No se pudo obtener datos del tracker: ${detail}`,
      total_leads:    0, total_ftds: 0, original_ftds: 0,
      duplicate_ftds: 0, total_cpa: 0, ecpa: 0, detail: [],
      scraped_at: new Date().toISOString(),
    } satisfies FinanceReport, { status: 502 });
  }

  const report = buildReport(raw);
  return NextResponse.json(report);
}
