/**
 * Call Actions Service
 *
 * Executes pre/post-call hooks stored in the `call_actions` table.
 * Supported action types: webhook, sms, email, crm_update.
 *
 * All config strings support {{key}} variable injection — resolved against
 * the CallActionVars map before the action fires.
 *
 * Errors are isolated per action: one failing webhook never blocks others.
 */
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionTrigger =
  | "pre_call"
  | "post_call"
  | "on_transfer"
  | "on_voicemail"
  | "on_converted"
  | "on_no_answer"
  | "on_error";

export interface CallActionVars {
  contact_name?: string;
  contact_phone?: string;
  agent_name?: string;
  workspace_id?: string;
  call_id?: string;
  room_name?: string;
  disposition?: string;
  outcome?: string;
  duration_seconds?: number;
  transcript?: string;
  summary?: string;
  [key: string]: unknown;
}

interface ActionRow {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

// ─── Template resolution ──────────────────────────────────────────────────────

/**
 * Replace {{key}} placeholders in `template` with values from `vars`.
 * Unresolved keys are left as {{key}} so the caller can debug missing data.
 */
export function resolveTemplate(
  template: string,
  vars: CallActionVars,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : `{{${key}}}`,
  );
}

// ─── Action executors ─────────────────────────────────────────────────────────

async function runWebhook(
  action: ActionRow,
  vars: CallActionVars,
): Promise<void> {
  const cfg = action.config as {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body_template?: string;
  };

  const url = resolveTemplate(cfg.url, vars);
  const method = (cfg.method ?? "POST").toUpperCase();
  const body = cfg.body_template
    ? resolveTemplate(cfg.body_template, vars)
    : JSON.stringify(vars);

  const res = await Promise.race([
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...cfg.headers },
      body: method === "GET" ? undefined : body,
    }),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("webhook timeout")), 10_000),
    ),
  ]);

  if (!res.ok) {
    console.warn(`[call-action] webhook "${action.name}" → HTTP ${res.status}`);
  }
}

async function runSms(action: ActionRow, vars: CallActionVars): Promise<void> {
  const cfg = action.config as {
    to_template: string;
    body_template: string;
    provider?: string;
  };

  const to = resolveTemplate(cfg.to_template, vars);
  const body = resolveTemplate(cfg.body_template, vars);

  // Route through workspace's configured SMS provider via internal API
  await Promise.race([
    fetch(`${process.env["NEXT_PUBLIC_APP_URL"] ?? ""}/api/internal/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, body, provider: cfg.provider ?? "twilio" }),
    }),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("sms timeout")), 10_000),
    ),
  ]);
}

async function runCrmUpdate(
  action: ActionRow,
  vars: CallActionVars,
): Promise<void> {
  const cfg = action.config as {
    crm_type: string;
    field_mappings: Record<string, string>;
  };

  const payload: Record<string, unknown> = {};
  for (const [crmField, template] of Object.entries(cfg.field_mappings)) {
    payload[crmField] = resolveTemplate(template, vars);
  }

  await Promise.race([
    fetch(
      `${process.env["NEXT_PUBLIC_APP_URL"] ?? ""}/api/internal/crm/${cfg.crm_type}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, workspace_id: vars.workspace_id }),
      },
    ),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("crm timeout")), 10_000),
    ),
  ]);
}

async function dispatchAction(
  action: ActionRow,
  vars: CallActionVars,
): Promise<void> {
  switch (action.type) {
    case "webhook":
      return runWebhook(action, vars);
    case "sms":
      return runSms(action, vars);
    case "crm_update":
      return runCrmUpdate(action, vars);
    default:
      console.warn(
        `[call-action] unknown type "${action.type}" for action "${action.name}"`,
      );
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Fire all active call actions for a given trigger.
 *
 * Pass `agentId` to include agent-scoped actions; workspace-wide actions
 * (agent_id IS NULL) are always included.
 *
 * Returns after all actions settle — individual failures are logged but
 * never propagated so a broken webhook can't stall the call pipeline.
 */
export async function executeCallActions(
  admin: Admin,
  workspaceId: string,
  agentId: string | null,
  trigger: ActionTrigger,
  vars: CallActionVars,
): Promise<void> {
  let query = admin
    .from("call_actions")
    .select("id, name, type, config")
    .eq("workspace_id", workspaceId)
    .eq("trigger", trigger)
    .eq("is_active", true);

  if (agentId) {
    // agent-specific OR workspace-wide (agent_id is null)
    query = query.or(`agent_id.eq.${agentId},agent_id.is.null`);
  } else {
    query = query.is("agent_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[call-action] failed to load actions:", error.message);
    return;
  }
  if (!data?.length) return;

  const results = await Promise.allSettled(
    (data as ActionRow[]).map((a) => dispatchAction(a, vars)),
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r?.status === "rejected") {
      const a = (data as ActionRow[])[i];
      console.error(
        `[call-action] "${a?.name}" (${a?.type}) failed:`,
        String(r.reason),
      );
    }
  }
}
