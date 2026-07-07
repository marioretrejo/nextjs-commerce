/**
 * Marketing Finance — Live Tracker Scraper
 * Fetches campaign stats from tracker.machukllc.xyz, applies CPA pricing from
 * Supabase, and returns a finance report. Scraping logic lives in _lib/tracker,
 * report building in _lib/cpa.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { loadCpaMap, buildReport } from "./_lib/cpa";
import { loginTracker, warmUpSession, fetchStats } from "./_lib/tracker";
import type { FinanceReport } from "./_lib/types";

export type { FinanceReport, FinanceRow } from "./_lib/types";

export const maxDuration = 60;

// Pre-captured browser session cookies (from tracker-scraper.js spy).
// When set, bypasses the HTTP login flow which the tracker often rejects.
// Format: JSON array — [{"name":"PHPSESSID","value":"...","domain":"...","path":"/"}]
const TRACKER_COOKIES = process.env.TRACKER_COOKIES ?? "";

function emptyReport(error: string): FinanceReport {
  return {
    error,
    total_leads: 0,
    total_ftds: 0,
    original_ftds: 0,
    duplicate_ftds: 0,
    total_cpa: 0,
    ecpa: 0,
    detail: [],
    scraped_at: new Date().toISOString(),
  };
}

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
        emptyReport(
          "No se pudo autenticar en el tracker (configura TRACKER_COOKIES en .env)",
        ),
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
      emptyReport(`No se pudo obtener datos del tracker: ${detail}`),
      { status: 502 },
    );
  }

  return NextResponse.json(buildReport(raw, cpaMap));
}
