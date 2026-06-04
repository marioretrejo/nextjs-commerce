/**
 * Marketing Finance — Live Tracker Scraper
 * Logs in to tracker.machukllc.xyz, fetches campaign stats,
 * applies CPA pricing table, returns a finance report.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

// ── Tracker login ─────────────────────────────────────────────────────────────
async function loginTracker(): Promise<string | null> {
  const body = new URLSearchParams({
    email:    TRACKER_USER,
    password: TRACKER_PASS,
    login:    '',
    theme:    '',
  });

  const cookies: string[] = [];

  // Step 1: POST login.php (manual redirect to capture cookies)
  let res: Response;
  try {
    res = await fetch(`${TRACKER_BASE}/login.php`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'User-Agent':    'Mozilla/5.0 VoiceOS-App/1.0',
      },
      body:     body.toString(),
      redirect: 'manual',
    });
  } catch (e) {
    console.error('[mf-scraper] login fetch error:', e);
    return null;
  }

  cookies.push(...extractCookies(res.headers));

  // Follow up to 3 redirects manually to accumulate cookies
  let cur = res;
  for (let i = 0; i < 3; i++) {
    const loc = cur.headers.get('location');
    if (!loc || cur.status < 300 || cur.status >= 400) break;
    const url = loc.startsWith('http') ? loc : `${TRACKER_BASE}${loc}`;
    cur = await fetch(url, {
      headers: {
        Cookie:       cookies.join('; '),
        'User-Agent': 'Mozilla/5.0 VoiceOS-App/1.0',
      },
      redirect: 'manual',
    });
    cookies.push(...extractCookies(cur.headers));
  }

  return cookies.length > 0 ? cookies.join('; ') : null;
}

// ── Fetch stats_campaign_country endpoint ─────────────────────────────────────
const STATS_PATH =
  '/get_data.php?type=stats_pb&export=1' +
  '&stats_type=Campaigns&sec_stats_type=Country' +
  '&third_stats_type=none&id=0';

async function fetchStats(cookie: string): Promise<unknown[][] | null> {
  try {
    const res = await fetch(`${TRACKER_BASE}${STATS_PATH}`, {
      headers: {
        Cookie:       cookie,
        'User-Agent': 'Mozilla/5.0 VoiceOS-App/1.0',
      },
    });
    if (!res.ok) return null;
    const data = await res.json() as unknown[][];
    if (!Array.isArray(data) || data.length < 2) return null;
    // Detect session expiry (returns HTML login page, not JSON)
    return data;
  } catch {
    return null;
  }
}

// ── Build finance report ──────────────────────────────────────────────────────
export interface FinanceRow {
  campaign:   string;
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
    const campaign = (rec['Campaigns'] ?? rec['Campaign'] ?? '').trim();
    const country  = normalizeCountry(rec['Country'] ?? '');
    const leads    = parseInt((rec['Leads'] ?? '0').replace(',', ''), 10) || 0;
    const ftds     = parseInt((rec['FTDs']  ?? '0').replace(',', ''), 10) || 0;

    const price   = getCpaPrice(campaign, country);
    const rowCpa  = price !== null ? ftds * price : 0;
    if (price === null) dupFtds += ftds;

    totalLeads += leads;
    totalFtds  += ftds;
    totalCpa   += rowCpa;

    detail.push({
      campaign,
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
export async function GET() {
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

  // Fetch data
  const raw = await fetchStats(cookie);
  if (!raw) {
    return NextResponse.json({
      error:          'Could not fetch stats from tracker',
      total_leads:    0, total_ftds: 0, original_ftds: 0,
      duplicate_ftds: 0, total_cpa: 0, ecpa: 0, detail: [],
      scraped_at: new Date().toISOString(),
    } satisfies FinanceReport, { status: 502 });
  }

  const report = buildReport(raw);
  return NextResponse.json(report);
}
