/**
 * GET /api/cron/alerts
 *
 * Evaluates alert signals across all observable sources and creates/updates
 * alert incidents. Enqueues delivery records for each incident.
 *
 * Auth:    Bearer INTERNAL_API_SECRET or x-internal-secret header (timing-safe).
 * Schedule: every 5 minutes (see vercel.json).
 *
 * Returns:
 *   { evaluated, incidents_created, incidents_updated,
 *     deliveries_created, external_sent, external_skipped }
 *
 * Security:
 *   - External sends (Slack/email/webhook) are OFF by default.
 *   - Set VOICEOS_ALERTING_SEND_EXTERNAL=true to enable.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateAlertSignals,
  createOrUpdateIncident,
  shouldNotifyIncident,
  enqueueAlertDelivery,
  getOpenIncidents,
  resolveIncident,
  type AlertChannel,
} from "@/lib/observability/alerting";
import { processDelivery } from "@/lib/observability/alert-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifySecret(provided: string | null): boolean {
  const secret =
    process.env["INTERNAL_API_SECRET"] ?? process.env["CRON_SECRET"];
  if (!secret || secret.trim().length < 16) return false;
  if (!provided || provided.trim().length === 0) return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(provided.trim(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const DEFAULT_CHANNELS: AlertChannel[] = ["dashboard"];

export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const secretHeader = req.headers.get("x-internal-secret");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : secretHeader;

  if (!verifySecret(provided)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const windowMinutes = Math.min(
    60,
    Math.max(5, parseInt(url.searchParams.get("window_minutes") ?? "15", 10)),
  );

  const admin = createAdminClient();

  // ── 1. Evaluate signals ───────────────────────────────────────────────────────
  const signals = await evaluateAlertSignals(admin, windowMinutes, null);

  let incidentsCreated = 0;
  let incidentsUpdated = 0;
  let deliveriesCreated = 0;
  let externalSent = 0;
  let externalSkipped = 0;

  const activeFingerprints = new Set<string>();

  // ── 2. Create/update incidents and enqueue deliveries ────────────────────────
  for (const signal of signals) {
    activeFingerprints.add(signal.fingerprint);

    const result = await createOrUpdateIncident(admin, signal, null);
    if (!result) continue;

    const { incident, isNew } = result;
    if (isNew) {
      incidentsCreated++;
    } else {
      incidentsUpdated++;
    }

    // Determine channels — use default rules for now (no per-workspace rules yet)
    const channels: AlertChannel[] = [...DEFAULT_CHANNELS];
    const externalEnabled =
      process.env["VOICEOS_ALERTING_SEND_EXTERNAL"] === "true";
    const slackUrl = process.env["VOICEOS_ALERTING_SLACK_WEBHOOK_URL"];
    if (externalEnabled && slackUrl) {
      channels.push("slack");
    }

    // Only notify on new incidents or re-notify after cooldown
    const cooldownMinutes = 30; // default cooldown

    for (const channel of channels) {
      const shouldNotify = await shouldNotifyIncident(
        admin,
        incident.id,
        channel,
        cooldownMinutes,
      );
      if (!shouldNotify) continue;

      const deliveryId = await enqueueAlertDelivery(
        admin,
        incident.id,
        incident.workspace_id,
        channel,
        channel === "slack" ? slackUrl : null,
      );
      if (!deliveryId) continue;

      deliveriesCreated++;

      const deliveryResult = await processDelivery(
        admin,
        deliveryId,
        incident,
        channel,
      );

      if (deliveryResult.external) {
        if (deliveryResult.status === "sent") {
          externalSent++;
        } else {
          externalSkipped++;
        }
      }
    }
  }

  // ── 3. Auto-resolve incidents whose signals are no longer firing ──────────────
  try {
    const openIncidents = await getOpenIncidents(admin, {
      workspaceId: undefined, // global
      status: ["open", "acknowledged"],
      limit: 200,
    });

    for (const incident of openIncidents) {
      if (!activeFingerprints.has(incident.fingerprint)) {
        // Signal is no longer active — auto-resolve
        await resolveIncident(admin, incident.id);
      }
    }
  } catch (err) {
    console.warn("[alerts-cron] auto-resolve error:", String(err));
  }

  return NextResponse.json({
    window_minutes: windowMinutes,
    evaluated: signals.length,
    incidents_created: incidentsCreated,
    incidents_updated: incidentsUpdated,
    deliveries_created: deliveriesCreated,
    external_sent: externalSent,
    external_skipped: externalSkipped,
    computed_at: new Date().toISOString(),
  });
}
