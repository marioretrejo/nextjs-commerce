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
type CpaMap = Map<string, number>;

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

// ── Cookie helpers ────────────────────────────────────────────────────────────
function extractCookies(headers: Headers): string[] {
  type H = Headers & { getSetCookie?: () => string[] };
  const h = headers as H;
  if (typeof h.getSetCookie === 'function') {
    return (h.getSetCookie() ?? []).map(c => c.split(';')[0]!.trim());
  }
  const raw = headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=[^ ])/).map(c => c.split(';')[0]!.trim()).filter(Boolean);
}

function mergeCookies(base: string, additions: string[]): string {
  const map = new Map<string, string>();
  for (const c of base.split('; ').filter(Boolean)) {
    const idx = c.indexOf('=');
    if (idx > 0) map.set(c.slice(0, idx), c);
  }
  for (const c of additions) {
    const idx = c.indexOf('=');
    if (idx > 0) map.set(c.slice(0, idx), c);
  }
  return [...map.values()].join('; ');
}

function makeSignal(ms: number) { return AbortSignal.timeout(ms); }

const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

// ── ISO → MM/DD/YYYY ─────────────────────────────────────────────────────────
function toUS(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

// ── Tracker login ─────────────────────────────────────────────────────────────
async function loginTracker(): Promise<string | null> {
  const body = new URLSearchParams({
    email: TRACKER_USER, password: TRACKER_PASS, login: '', theme: '',
  });
  const cookies: string[] = [];

  let res: Response;
  try {
    res = await fetch(`${TRACKER_BASE}/login.php`, {
      method: 'POST',
      headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html,*/*' },
      body: body.toString(),
      redirect: 'manual',
      signal: makeSignal(20_000),
    });
  } catch (e) { console.error('[mf-scraper] login POST error:', e); return null; }

  cookies.push(...extractCookies(res.headers));
  let cur = res;
  for (let i = 0; i < 3; i++) {
    const loc = cur.headers.get('location');
    if (!loc || cur.status < 300 || cur.status >= 400) break;
    const url = loc.startsWith('http') ? loc : `${TRACKER_BASE}/${loc.replace(/^\//, '')}`;
    try {
      cur = await fetch(url, {
        headers: { ...BROWSER_HEADERS, Cookie: cookies.join('; '), Accept: 'text/html,*/*' },
        redirect: 'manual', signal: makeSignal(15_000),
      });
    } catch (e) { console.error('[mf-scraper] redirect error:', e); break; }
    cookies.push(...extractCookies(cur.headers));
  }

  const joined = cookies.join('; ');
  console.log('[mf-scraper] login cookies:', cookies.length, joined.slice(0, 120));
  return cookies.length > 0 ? joined : null;
}

// ── Analyse tracker JS to find date-filter AJAX calls ─────────────────────────
async function analyseTrackerForDateFilter(cookie: string): Promise<{
  html: string;
  ajaxEndpoints: string[];
  dateParamNames: string[];
  formAction: string;
  allInputNames: string[];
}> {
  const result = { html: '', ajaxEndpoints: [] as string[], dateParamNames: [] as string[], formAction: '', allInputNames: [] as string[] };

  try {
    const res = await fetch(`${TRACKER_BASE}/crm.new.php`, {
      headers: { ...BROWSER_HEADERS, Cookie: cookie, Accept: 'text/html,*/*' },
      redirect: 'follow', signal: makeSignal(15_000),
    });
    result.html = await res.text();

    // Log first 1000 chars of the page for debugging
    console.log('[mf-scraper] crm.new.php (1000):', result.html.slice(0, 1000).replace(/\s+/g, ' '));

    // All form input names
    result.allInputNames = [...result.html.matchAll(/\bname=["']([^"']+)["']/gi)].map(m => m[1]!);
    console.log('[mf-scraper] form inputs:', result.allInputNames.join(', ').slice(0, 400));

    // Form action
    const formActionM = result.html.match(/<form[^>]+action=["']([^"']+)["']/i);
    result.formAction = formActionM?.[1] ?? '';
    console.log('[mf-scraper] form action:', result.formAction);

    // Look in inline scripts for AJAX patterns and date params
    const inlineScripts = [...result.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]!);
    for (const s of inlineScripts) {
      // AJAX/fetch URLs
      for (const m of s.matchAll(/(?:url|href)\s*[:=]\s*['"]([^'"]*(?:php|ajax)[^'"]*)['"]/gi)) {
        result.ajaxEndpoints.push(m[1]!);
      }
      // Date param names in objects/params
      for (const m of s.matchAll(/['"](\w*(?:date|from|to|start|end|period|range|filter)\w*)['"]:\s*(?:['"]|[a-z])/gi)) {
        result.dateParamNames.push(m[1]!);
      }
    }

    // Fetch external scripts and analyse
    const extScripts = [...result.html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
      .map(m => { const s = m[1]!; return s.startsWith('http') ? s : `${TRACKER_BASE}/${s.replace(/^\//, '')}`; })
      .slice(0, 8);

    await Promise.allSettled(extScripts.map(async (url) => {
      try {
        const r = await fetch(url, { signal: makeSignal(8_000) });
        const js = await r.text();
        const fname = url.split('/').pop() ?? url;

        // Look for get_data.php references
        if (/get_data|stats_pb|date_from|dateFrom/i.test(js)) {
          const relevantLines = js.split('\n')
            .filter(l => /get_data|date_from|date_to|dateFrom|dateTo|period/i.test(l))
            .slice(0, 8);
          console.log(`[mf-scraper] JS ${fname}:`, relevantLines.join(' | ').slice(0, 600));

          for (const m of js.matchAll(/['"](\w*(?:date|from|to|start|end|period)\w*)['"]:\s*(?:['"]|[a-z])/gi)) {
            result.dateParamNames.push(m[1]!);
          }
          for (const m of js.matchAll(/(?:url|href)\s*[:=]\s*['"]([^'"]*php[^'"]*)['"]/gi)) {
            result.ajaxEndpoints.push(m[1]!);
          }
        }
      } catch { /* skip */ }
    }));

    result.dateParamNames = [...new Set(result.dateParamNames)];
    result.ajaxEndpoints  = [...new Set(result.ajaxEndpoints)];
    console.log('[mf-scraper] date param names found in JS:', result.dateParamNames.join(', ').slice(0, 300));
    console.log('[mf-scraper] AJAX endpoints found:', result.ajaxEndpoints.join(', ').slice(0, 300));
  } catch (e) {
    console.error('[mf-scraper] analyseTrackerForDateFilter error:', e);
  }

  return result;
}

// ── Set date range via PHP session ────────────────────────────────────────────
async function setTrackerDateRange(cookie: string, dateFrom: string, dateTo: string): Promise<string> {
  let activeCookie = cookie;

  // Discover the tracker's actual form structure
  const analysis = await analyseTrackerForDateFilter(activeCookie);

  // Determine date field names (detected or fallback)
  const fromField = analysis.allInputNames.find(n => /date_from|from_date|dateFrom|start/i.test(n)) ?? 'date_from';
  const toField   = analysis.allInputNames.find(n => /date_to|to_date|dateTo|end/i.test(n))     ?? 'date_to';
  console.log('[mf-scraper] using form fields:', fromField, '/', toField);

  // Collect hidden fields (CSRF tokens, etc.)
  const hiddenFields: Record<string, string> = {};
  for (const m of analysis.html.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi)) {
    const tag = m[0];
    const nameM = tag.match(/name=["']([^"']+)["']/i);
    const valM  = tag.match(/value=["']([^"']*)["']/i);
    if (nameM?.[1]) hiddenFields[nameM[1]] = valM?.[1] ?? '';
  }
  // also handle reversed attribute order
  for (const m of analysis.html.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*type=["']hidden["'][^>]*>/gi)) {
    const tag = m[0];
    const valM = tag.match(/value=["']([^"']*)["']/i);
    hiddenFields[m[1]!] = valM?.[1] ?? '';
  }

  // POST with all date format variations
  const dateVariants: Array<[string, string]> = [
    [dateFrom, dateTo],
    [toUS(dateFrom), toUS(dateTo)],
  ];

  for (const [from, to] of dateVariants) {
    try {
      const postBody = new URLSearchParams({
        ...hiddenFields,
        [fromField]: from,
        [toField]:   to,
        // Also send under common alternative names
        date_from: from, date_to: to,
        from: from, to: to,
        start_date: from, end_date: to,
        dateFrom: from, dateTo: to,
        stats_type: 'Campaigns',
        filter: '1',
        period: 'custom',
      });
      const res = await fetch(`${TRACKER_BASE}/crm.new.php`, {
        method: 'POST',
        headers: {
          ...BROWSER_HEADERS,
          Cookie: activeCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,*/*',
          Referer: `${TRACKER_BASE}/crm.new.php`,
        },
        body: postBody.toString(),
        redirect: 'follow',
        signal: makeSignal(12_000),
      });
      activeCookie = mergeCookies(activeCookie, extractCookies(res.headers));
      console.log(`[mf-scraper] POST crm (${from}) → ${res.status}`);
    } catch (e) { console.warn('[mf-scraper] POST crm failed:', from, e); }
  }

  // Also try GET with date params (some trackers read from $_GET into session)
  for (const qs of [
    `date_from=${dateFrom}&date_to=${dateTo}&period=custom`,
    `from=${dateFrom}&to=${dateTo}&period=custom`,
    `date_from=${toUS(dateFrom)}&date_to=${toUS(dateTo)}&period=custom`,
  ]) {
    try {
      const res = await fetch(`${TRACKER_BASE}/crm.new.php?${qs}&stats_type=Campaigns`, {
        headers: { ...BROWSER_HEADERS, Cookie: activeCookie, Accept: 'text/html,*/*', Referer: `${TRACKER_BASE}/crm.new.php` },
        redirect: 'follow', signal: makeSignal(8_000),
      });
      activeCookie = mergeCookies(activeCookie, extractCookies(res.headers));
      console.log(`[mf-scraper] GET crm (?${qs.slice(0,40)}) → ${res.status}`);
    } catch { /* skip */ }
  }

  return activeCookie;
}

// ── Try GET and POST stats calls with multiple date formats ───────────────────
const STATS_PARAMS = 'type=stats_pb&export=1&stats_type=Campaigns&sec_stats_type=SubSources&third_stats_type=Country&id=0';

async function tryStatsCall(
  cookie: string,
  method: 'GET' | 'POST',
  extraParams: Record<string, string>,
): Promise<{ data: unknown[][] | null; detail: string }> {
  const paramStr = Object.entries(extraParams).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const fullParams = STATS_PARAMS + (paramStr ? `&${paramStr}` : '');

  try {
    const opts: RequestInit = {
      headers: {
        ...BROWSER_HEADERS,
        Cookie: cookie,
        Accept: 'application/json, text/plain, */*',
        Referer: `${TRACKER_BASE}/crm.new.php`,
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      signal: makeSignal(20_000),
      ...(method === 'GET'
        ? { method: 'GET' }
        : { method: 'POST', body: fullParams }),
    };

    const url = method === 'GET'
      ? `${TRACKER_BASE}/get_data.php?${fullParams}`
      : `${TRACKER_BASE}/get_data.php`;

    const res = await fetch(url, opts);
    if (!res.ok) return { data: null, detail: `HTTP ${res.status}` };
    const text = await res.text();
    if (text.includes('name="password"') || text.trim().startsWith('<!')) {
      return { data: null, detail: 'session_expired' };
    }
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { data: null, detail: `not_json:${text.slice(0,60)}` }; }
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return { data: null, detail: `bad_format:${text.slice(0,60)}` };
    }
    return { data: parsed as unknown[][], detail: 'ok' };
  } catch (e) {
    return { data: null, detail: String(e) };
  }
}

async function fetchStats(
  cookie: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ data: unknown[][] | null; detail: string; debugLines: string[] }> {
  const debugLines: string[] = [];
  const strategies: Array<{ method: 'GET' | 'POST'; params: Record<string, string>; label: string }> = [];

  if (dateFrom && dateTo) {
    const usFrom = toUS(dateFrom), usTo = toUS(dateTo);
    strategies.push(
      { method: 'GET',  label: 'GET ISO',       params: { date_from: dateFrom, date_to: dateTo, period: 'custom' } },
      { method: 'GET',  label: 'GET US-format',  params: { date_from: usFrom,   date_to: usTo,   period: 'custom' } },
      { method: 'GET',  label: 'GET from/to',    params: { from: dateFrom, to: dateTo } },
      { method: 'POST', label: 'POST ISO',       params: { date_from: dateFrom, date_to: dateTo, period: 'custom' } },
      { method: 'POST', label: 'POST US-format', params: { date_from: usFrom,   date_to: usTo,   period: 'custom' } },
    );
  }
  strategies.push({ method: 'GET', label: 'GET sin fecha (baseline)', params: {} });

  for (const s of strategies) {
    const result = await tryStatsCall(cookie, s.method, s.params);
    const rowCount = result.data ? result.data.length - 1 : 0;
    const line = `${s.label} → ${result.detail} | rows: ${rowCount}`;
    debugLines.push(line);
    console.log(`[mf-scraper] ${line}`);

    if (result.data && result.detail === 'ok') {
      const hdrs = (result.data[0] as string[]).map(String);
      debugLines.push(`headers: ${hdrs.join(', ')}`);
      console.log('[mf-scraper] headers:', hdrs.join(', '));
      return { ...result, debugLines };
    }
  }

  return { data: null, detail: 'All strategies failed', debugLines };
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
  _debug?:        string[];
}

function buildReport(rawData: unknown[][], cpaMap: CpaMap): FinanceReport {
  const headers = (rawData[0] as string[]).map(String);
  const rows    = rawData.slice(1);
  const subsourceKey = headers.find(h => /subsource|sub.?source/i.test(h)) ?? '';

  let totalLeads = 0, totalFtds = 0, totalCpa = 0, dupFtds = 0;
  const detail: FinanceRow[] = [];

  for (const row of rows) {
    const rec      = Object.fromEntries(headers.map((h, i) => [h, String((row as unknown[])[i] ?? '')]));
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

    detail.push({ campaign, subsource, country, leads, ftds,
      cr_pct: leads > 0 ? Math.round((ftds / leads) * 1000) / 10 : 0,
      unit_price: price, cpa_total: rowCpa,
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
  if (!profile?.is_superadmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url      = new URL(req.url);
  const dateFrom = url.searchParams.get('from') ?? undefined;
  const dateTo   = url.searchParams.get('to')   ?? undefined;

  const [cpaMap, cookie] = await Promise.all([loadCpaMap(), loginTracker()]);

  if (!cookie) {
    return NextResponse.json({
      error: 'Could not log in to tracker',
      total_leads: 0, total_ftds: 0, original_ftds: 0,
      duplicate_ftds: 0, total_cpa: 0, ecpa: 0, detail: [],
      scraped_at: new Date().toISOString(),
    } satisfies FinanceReport, { status: 502 });
  }

  let activeCookie = cookie;
  const sessionDebug: string[] = [];

  if (dateFrom && dateTo) {
    // Run analysis and date-range setup in parallel with a fresh analysis fetch
    const analysis = await analyseTrackerForDateFilter(cookie);
    sessionDebug.push(`crm inputs: ${analysis.allInputNames.join(', ').slice(0, 200)}`);
    sessionDebug.push(`form action: ${analysis.formAction}`);
    sessionDebug.push(`ajax endpoints: ${analysis.ajaxEndpoints.join(', ').slice(0, 200)}`);
    sessionDebug.push(`date params in JS: ${analysis.dateParamNames.join(', ').slice(0, 200)}`);

    activeCookie = await setTrackerDateRange(cookie, dateFrom, dateTo);
  }

  const { data: raw, detail, debugLines } = await fetchStats(activeCookie, dateFrom, dateTo);
  const allDebug = [...sessionDebug, ...debugLines];

  if (!raw) {
    return NextResponse.json({
      error: `No se pudo obtener datos del tracker: ${detail}`,
      total_leads: 0, total_ftds: 0, original_ftds: 0,
      duplicate_ftds: 0, total_cpa: 0, ecpa: 0, detail: [],
      scraped_at: new Date().toISOString(),
      _debug: allDebug,
    } satisfies FinanceReport, { status: 502 });
  }

  const report = buildReport(raw, cpaMap);
  report._debug = allDebug;
  return NextResponse.json(report);
}
