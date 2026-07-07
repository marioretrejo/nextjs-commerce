import { createAdminClient } from "@/lib/supabase/admin";
import type { CpaMap, FinanceReport, FinanceRow } from "./types";

// ── CPA lookup ────────────────────────────────────────────────────────────────
export async function loadCpaMap(): Promise<CpaMap> {
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

// ── Build finance report ──────────────────────────────────────────────────────
export function buildReport(
  rawData: unknown[][],
  cpaMap: CpaMap,
): FinanceReport {
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
