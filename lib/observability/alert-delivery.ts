/**
 * lib/observability/alert-delivery.ts
 *
 * Delivery drivers for alert notifications.
 *
 * Security rules:
 *   - External sends (Slack/Email/Webhook) are DISABLED by default.
 *   - Set VOICEOS_ALERTING_SEND_EXTERNAL=true to enable.
 *   - Never log full webhook URLs or email addresses.
 *   - Never store Bearer tokens or API keys.
 *   - Dashboard delivery is always safe (DB-only, no network calls).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertIncidentRow } from "./alerting";

// ── Config ─────────────────────────────────────────────────────────────────────

function isExternalEnabled(): boolean {
  return process.env["VOICEOS_ALERTING_SEND_EXTERNAL"] === "true";
}

function slackWebhookUrl(): string | null {
  return process.env["VOICEOS_ALERTING_SLACK_WEBHOOK_URL"] ?? null;
}

function defaultEmail(): string | null {
  return process.env["VOICEOS_ALERTING_DEFAULT_EMAIL"] ?? null;
}

// ── Delivery update helper ─────────────────────────────────────────────────────

async function markDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
  status: "sent" | "failed" | "skipped",
  opts: { lastError?: string; sentAt?: string } = {},
) {
  await supabase
    .from("alert_deliveries")
    .update({
      status,
      last_error: opts.lastError ? opts.lastError.slice(0, 200) : null,
      sent_at:
        opts.sentAt ?? (status === "sent" ? new Date().toISOString() : null),
      attempts: supabase
        .from("alert_deliveries")
        .select("attempts")
        .eq("id", deliveryId),
    })
    .eq("id", deliveryId);
}

async function incrementAttempts(supabase: SupabaseClient, deliveryId: string) {
  const { error } = await supabase.rpc("increment_alert_delivery_attempts", {
    delivery_id: deliveryId,
  });
  if (error) {
    // RPC unavailable — non-fatal
  }
}

// ── Dashboard delivery ─────────────────────────────────────────────────────────

/**
 * Dashboard delivery: mark the record as sent immediately.
 * This is always enabled — it's a DB-only operation.
 */
export async function deliverDashboard(
  supabase: SupabaseClient,
  deliveryId: string,
): Promise<void> {
  try {
    await supabase
      .from("alert_deliveries")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq("id", deliveryId);
  } catch (err) {
    console.warn("[alert-delivery] deliverDashboard error:", String(err));
  }
}

// ── Slack delivery ─────────────────────────────────────────────────────────────

/**
 * Slack delivery via incoming webhook.
 * ONLY executed when VOICEOS_ALERTING_SEND_EXTERNAL=true AND webhook URL is set.
 * Otherwise marks delivery as skipped.
 */
export async function deliverSlack(
  supabase: SupabaseClient,
  deliveryId: string,
  incident: AlertIncidentRow,
): Promise<void> {
  if (!isExternalEnabled()) {
    await supabase
      .from("alert_deliveries")
      .update({ status: "skipped", last_error: "external sends disabled" })
      .eq("id", deliveryId);
    return;
  }

  const webhookUrl = slackWebhookUrl();
  if (!webhookUrl) {
    await supabase
      .from("alert_deliveries")
      .update({
        status: "skipped",
        last_error: "VOICEOS_ALERTING_SLACK_WEBHOOK_URL not configured",
      })
      .eq("id", deliveryId);
    return;
  }

  const emoji =
    incident.severity === "critical"
      ? "🔴"
      : incident.severity === "warning"
        ? "🟡"
        : "🔵";
  const payload = {
    text: `${emoji} *VoiceOS Alert* — ${incident.title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${incident.title}*\n${incident.description ?? ""}\n\n*Signal:* \`${incident.signal}\` | *Severity:* ${incident.severity}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Occurrences: ${incident.occurrence_count} | First seen: ${incident.first_seen_at.slice(0, 19)}Z`,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      await supabase
        .from("alert_deliveries")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq("id", deliveryId);
    } else {
      await supabase
        .from("alert_deliveries")
        .update({
          status: "failed",
          last_error: `HTTP ${res.status}`,
          attempts: 1,
        })
        .eq("id", deliveryId);
    }
  } catch (err) {
    await supabase
      .from("alert_deliveries")
      .update({
        status: "failed",
        last_error: String(err).slice(0, 200),
        attempts: 1,
      })
      .eq("id", deliveryId);
  }
}

// ── Email delivery (placeholder) ───────────────────────────────────────────────

/**
 * Email delivery placeholder.
 * Currently always skips — real email requires VOICEOS_ALERTING_SEND_EXTERNAL + Resend integration.
 */
export async function deliverEmail(
  supabase: SupabaseClient,
  deliveryId: string,
  // incident intentionally unused for now (placeholder)
  _incident: AlertIncidentRow,
): Promise<void> {
  if (!isExternalEnabled() || !defaultEmail()) {
    await supabase
      .from("alert_deliveries")
      .update({
        status: "skipped",
        last_error: isExternalEnabled()
          ? "VOICEOS_ALERTING_DEFAULT_EMAIL not configured"
          : "external sends disabled",
      })
      .eq("id", deliveryId);
    return;
  }
  // TODO: integrate with lib/email.ts (Resend) when ready for production
  await supabase
    .from("alert_deliveries")
    .update({
      status: "skipped",
      last_error: "email delivery not yet implemented",
    })
    .eq("id", deliveryId);
}

// ── Webhook delivery (placeholder) ────────────────────────────────────────────

/**
 * Outbound webhook delivery placeholder.
 * Currently always skips — requires VOICEOS_ALERTING_SEND_EXTERNAL + webhook URL per rule.
 */
export async function deliverWebhook(
  supabase: SupabaseClient,
  deliveryId: string,
  _incident: AlertIncidentRow,
): Promise<void> {
  await supabase
    .from("alert_deliveries")
    .update({
      status: "skipped",
      last_error: isExternalEnabled()
        ? "webhook delivery not yet implemented"
        : "external sends disabled",
    })
    .eq("id", deliveryId);
}

// ── Process a delivery record ──────────────────────────────────────────────────

export interface ProcessDeliveryResult {
  status: "sent" | "failed" | "skipped";
  external: boolean;
}

/**
 * Dispatch a pending delivery to the appropriate channel driver.
 * Returns a summary of what happened.
 */
export async function processDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
  incident: AlertIncidentRow,
  channel: "dashboard" | "slack" | "email" | "webhook",
): Promise<ProcessDeliveryResult> {
  switch (channel) {
    case "dashboard":
      await deliverDashboard(supabase, deliveryId);
      return { status: "sent", external: false };

    case "slack":
      await deliverSlack(supabase, deliveryId, incident);
      return {
        status: isExternalEnabled() && !!slackWebhookUrl() ? "sent" : "skipped",
        external: isExternalEnabled(),
      };

    case "email":
      await deliverEmail(supabase, deliveryId, incident);
      return { status: "skipped", external: false };

    case "webhook":
      await deliverWebhook(supabase, deliveryId, incident);
      return { status: "skipped", external: false };

    default:
      return { status: "skipped", external: false };
  }
}
