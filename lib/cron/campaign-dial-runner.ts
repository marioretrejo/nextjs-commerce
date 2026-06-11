/**
 * Campaign dial runner — feature flag guard for operational worker.
 *
 * The full dialing logic lives in app/api/cron/campaign-dial/route.ts.
 * This runner is called by agent/operational_worker.ts.
 *
 * VOICEOS_RUN_CAMPAIGN_DIAL defaults to false — dialing is OFF unless
 * explicitly enabled. This prevents accidental real calls.
 *
 * To enable for production dialing:
 *   VOICEOS_RUN_CAMPAIGN_DIAL=true
 *
 * When enabled, the operational worker makes an authenticated internal
 * HTTP call to /api/cron/campaign-dial rather than duplicating the
 * 836-line route logic here.
 */

export interface CampaignDialRunnerResult {
  skipped: boolean;
  reason?: string;
  dialed?: number;
  ran_at: string;
}

export async function runCampaignDial(opts: {
  appBaseUrl?: string;
  internalSecret?: string;
}): Promise<CampaignDialRunnerResult> {
  const enabled = process.env["VOICEOS_RUN_CAMPAIGN_DIAL"] === "true";

  if (!enabled) {
    return {
      skipped: true,
      reason: "VOICEOS_RUN_CAMPAIGN_DIAL is not enabled",
      ran_at: new Date().toISOString(),
    };
  }

  const baseUrl = opts.appBaseUrl ?? process.env["NEXT_PUBLIC_APP_URL"];
  const secret = opts.internalSecret ?? process.env["INTERNAL_API_SECRET"];

  if (!baseUrl || !secret) {
    console.warn(
      "[campaign-dial-runner] NEXT_PUBLIC_APP_URL or INTERNAL_API_SECRET not set — skipping",
    );
    return {
      skipped: true,
      reason: "Missing NEXT_PUBLIC_APP_URL or INTERNAL_API_SECRET",
      ran_at: new Date().toISOString(),
    };
  }

  // Proxy to the HTTP route rather than duplicating LiveKit/Twilio logic here.
  // The route already has all guards: TCPA compliance, DNC, concurrency slots.
  const res = await fetch(`${baseUrl}/api/cron/campaign-dial`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`campaign-dial HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { dialed?: number };

  return {
    skipped: false,
    dialed: json.dialed ?? 0,
    ran_at: new Date().toISOString(),
  };
}
