import { createAdminClient } from "@/lib/supabase/admin";

interface TelegramViolationPayload {
  workspaceId: string;
  interactionId: string;
  agentName: string;
  ruleName: string;
  departmentName: string | null;
}

const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between alerts per workspace

async function getTelegramConfig(workspaceId: string): Promise<{
  botToken: string;
  chatId: string;
  settings: Record<string, unknown>;
} | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .select("credentials, status, settings")
    .eq("workspace_id", workspaceId)
    .eq("type", "telegram_qa")
    .eq("status", "connected")
    .single();

  if (error || !data) return null;

  const row = data as {
    credentials: Record<string, unknown>;
    settings: Record<string, unknown> | null;
  };
  const botToken = row.credentials?.bot_token;
  const chatId = row.credentials?.chat_id;

  if (typeof botToken !== "string" || typeof chatId !== "string") return null;
  if (!botToken || !chatId) return null;

  return { botToken, chatId, settings: row.settings ?? {} };
}

async function updateLastAlertAt(workspaceId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("integrations")
    .update({
      settings: { last_critical_alert_at: new Date().toISOString() },
    })
    .eq("workspace_id", workspaceId)
    .eq("type", "telegram_qa");
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export async function sendComplianceCriticalAlert(
  payload: TelegramViolationPayload,
): Promise<void> {
  try {
    const config = await getTelegramConfig(payload.workspaceId);
    if (!config) return;

    // Throttle: skip if an alert was sent within the cooldown window
    const lastSentAt = config.settings?.last_critical_alert_at;
    if (typeof lastSentAt === "string") {
      const elapsed = Date.now() - new Date(lastSentAt).getTime();
      if (elapsed < ALERT_COOLDOWN_MS) return;
    }

    const appUrl =
      process.env["NEXT_PUBLIC_APP_URL"] ?? "https://app.voiceos.com";

    const lines = [
      "🚨 *ALERTA DE COMPLIANCE — CRITICAL*",
      "",
      `👤 Agente: ${escapeMarkdown(payload.agentName)}`,
      `📋 Regla violada: ${escapeMarkdown(payload.ruleName)}`,
      `🏢 Departamento: ${escapeMarkdown(payload.departmentName ?? "Sin departamento")}`,
      `🔴 Severidad: CRITICAL`,
      "",
      `🔗 [Ver llamada](${appUrl}/qa\\-center/calls/${payload.interactionId})`,
    ];

    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: lines.join("\n"),
          parse_mode: "MarkdownV2",
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (response.ok) {
      await updateLastAlertAt(payload.workspaceId);
    } else {
      const body = await response.text();
      console.error("[Telegram] sendMessage failed:", response.status, body);
    }
  } catch (err) {
    console.error("[Telegram] Alert failed silently:", err);
  }
}

export async function sendTelegramTestMessage(
  botToken: string,
  chatId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ VoiceOS QA Center conectado correctamente\\. Las alertas de compliance críticas llegarán aquí\\.",
          parse_mode: "MarkdownV2",
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
    };

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.description ?? "Error desconocido" };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
