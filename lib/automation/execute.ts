import type { SupabaseClient } from "@supabase/supabase-js";
import { twilio } from "@/lib/twilio/client";

interface AutomationRule {
  id: string;
  workspace_id: string;
  agent_id: string;
  action_type: string;
  action_config: Record<string, unknown>;
}

interface CallRecord {
  id?: string;
  retell_call_id?: string;
  contact_phone?: string | null;
  campaign_id?: string | null;
  outcome?: string | null;
  sentiment?: string | null;
  duration_seconds?: number;
}

/**
 * Validates a webhook URL against SSRF attack vectors.
 * Only https:// is permitted; private/loopback IPs are rejected.
 */
function isSafeWebhookUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();

  const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
  if (blockedHosts.includes(host)) return false;

  // Reject private / link-local IPv4 ranges when host is a bare IP
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.map(Number);
    const a = parts[1]!;
    const b = parts[2]!;
    if (
      a === 10 ||                          // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||           // 192.168.0.0/16
      (a === 169 && b === 254)              // 169.254.0.0/16 link-local
    ) return false;
  }

  return true;
}

export async function executeAutomationRule(
  rule: AutomationRule,
  call: CallRecord,
  admin: SupabaseClient,
): Promise<void> {
  const config = rule.action_config;

  try {
    switch (rule.action_type) {
      case "webhook": {
        const url = config["url"] as string | undefined;
        if (!url || !isSafeWebhookUrl(url)) {
          console.warn(
            `[automation] rule ${rule.id}: webhook skipped — URL missing or unsafe: ${url ?? "(none)"}`,
          );
          break;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              rule_id: rule.id,
              call_id: call.retell_call_id ?? call.id ?? null,
              outcome: call.outcome ?? null,
              contact_phone: call.contact_phone ?? null,
              agent_id: rule.agent_id,
              workspace_id: rule.workspace_id,
            }),
          });
        } finally {
          clearTimeout(timeoutId);
        }
        break;
      }

      case "send_sms": {
        const to =
          (config["to_number"] as string | undefined) ?? call.contact_phone;
        const template = (config["message"] as string | undefined) ?? "";
        if (to && template) {
          const message = template
            .replace("{{outcome}}", call.outcome ?? "")
            .replace("{{phone}}", call.contact_phone ?? "");
          await twilio.sendSMS(to, message);
        }
        break;
      }

      case "notify_team": {
        // Notify the workspace owner
        const { data: workspace } = await admin
          .from("workspaces")
          .select("owner_id")
          .eq("id", rule.workspace_id)
          .single();
        if (workspace) {
          const ws = workspace as { owner_id: string };
          await admin.from("notifications").insert({
            user_id: ws.owner_id,
            type: "automation",
            title:
              (config["title"] as string | undefined) ?? "Automation triggered",
            body:
              (config["message"] as string | undefined) ??
              `Call ${call.outcome}: ${call.contact_phone ?? "unknown"}`,
          });
        }
        break;
      }

      case "add_to_campaign": {
        const targetCampaignId = config["campaign_id"] as string | undefined;
        if (targetCampaignId && call.contact_phone) {
          await admin.from("campaign_contacts").insert({
            campaign_id: targetCampaignId,
            phone: call.contact_phone,
            status: "pending",
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Log but don't throw — one failing action shouldn't block the others
    console.error(
      `Automation rule ${rule.id} (${rule.action_type}) failed:`,
      err,
    );
  }
}
