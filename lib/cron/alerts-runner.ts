/**
 * Alerts runner — called by both /api/cron/alerts and
 * agent/operational_worker.ts (Render). No HTTP layer.
 *
 * External sends (Slack/email) remain OFF by default.
 * Set VOICEOS_ALERTING_SEND_EXTERNAL=true to enable.
 */
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

const DEFAULT_CHANNELS: AlertChannel[] = ["dashboard"];

export interface AlertsRunnerResult {
  window_minutes: number;
  evaluated: number;
  incidents_created: number;
  incidents_updated: number;
  deliveries_created: number;
  external_sent: number;
  external_skipped: number;
  computed_at: string;
}

export async function runAlerts(opts: {
  windowMinutes?: number;
}): Promise<AlertsRunnerResult> {
  const windowMinutes = Math.min(60, Math.max(5, opts.windowMinutes ?? 15));

  const admin = createAdminClient();
  const signals = await evaluateAlertSignals(admin, windowMinutes, null);

  let incidentsCreated = 0;
  let incidentsUpdated = 0;
  let deliveriesCreated = 0;
  let externalSent = 0;
  let externalSkipped = 0;

  const activeFingerprints = new Set<string>();

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

    const channels: AlertChannel[] = [...DEFAULT_CHANNELS];
    const externalEnabled =
      process.env["VOICEOS_ALERTING_SEND_EXTERNAL"] === "true";
    const slackUrl = process.env["VOICEOS_ALERTING_SLACK_WEBHOOK_URL"];
    if (externalEnabled && slackUrl) {
      channels.push("slack");
    }

    const cooldownMinutes = 30;

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

  try {
    const openIncidents = await getOpenIncidents(admin, {
      workspaceId: undefined,
      status: ["open", "acknowledged"],
      limit: 200,
    });

    for (const incident of openIncidents) {
      if (!activeFingerprints.has(incident.fingerprint)) {
        await resolveIncident(admin, incident.id);
      }
    }
  } catch (err) {
    console.warn("[alerts-runner] auto-resolve error:", String(err));
  }

  return {
    window_minutes: windowMinutes,
    evaluated: signals.length,
    incidents_created: incidentsCreated,
    incidents_updated: incidentsUpdated,
    deliveries_created: deliveriesCreated,
    external_sent: externalSent,
    external_skipped: externalSkipped,
    computed_at: new Date().toISOString(),
  };
}
