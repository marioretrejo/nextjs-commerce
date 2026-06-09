/**
 * Scenario Handler Service
 *
 * Resolves the configured response for built-in call scenarios.
 * If no agent-specific override exists in `scenario_handlers`, built-in
 * defaults are used (matching reasonable enterprise outbound behaviour).
 *
 * Scenarios:
 *   voicemail_short  — call answered by voicemail AND duration ≤ 3 s → hang up
 *   voicemail_long   — voicemail answered, longer greeting → leave message
 *   bot_detected     — IVR / automated system detected
 *   disinterest      — contact explicitly not interested
 *   objection        — contact raised objection (retry up to max_attempts=4)
 *   no_response      — prolonged silence beyond threshold
 *   human_requested  — contact asks to speak with a human agent
 */
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScenarioType =
  | "voicemail_short"
  | "voicemail_long"
  | "bot_detected"
  | "disinterest"
  | "objection"
  | "no_response"
  | "human_requested";

export type ScenarioAction =
  | "hangup"
  | "leave_voicemail"
  | "navigate_ivr"
  | "transfer"
  | "retry_later"
  | "custom_response";

export interface ScenarioHandler {
  id: string;
  scenario: ScenarioType;
  action: ScenarioAction;
  config: Record<string, unknown>;
  max_attempts: number;
  isDefault: boolean;
}

// ─── Built-in defaults ────────────────────────────────────────────────────────

const DEFAULTS: Record<
  ScenarioType,
  Pick<ScenarioHandler, "action" | "config" | "max_attempts">
> = {
  voicemail_short: {
    action: "hangup",
    config: {},
    max_attempts: 1,
  },
  voicemail_long: {
    action: "leave_voicemail",
    config: {
      message_template:
        "Hi, this is {{agent_name}} calling on behalf of {{workspace_name}}. " +
        "I was hoping to connect with you. Please call us back at your convenience. Thank you.",
    },
    max_attempts: 1,
  },
  bot_detected: {
    action: "hangup",
    config: {},
    max_attempts: 1,
  },
  disinterest: {
    action: "hangup",
    config: {},
    max_attempts: 1,
  },
  objection: {
    action: "custom_response",
    config: {
      llm_instruction:
        "The contact has raised an objection. Acknowledge it empathetically, " +
        "address it with a specific, relevant benefit, then ask an open-ended question " +
        "to re-engage. Do not give up until you have attempted a recovery at least " +
        "{{max_attempts}} times. On the final attempt, offer to follow up at a better time.",
    },
    max_attempts: 4,
  },
  no_response: {
    action: "hangup",
    config: {},
    max_attempts: 1,
  },
  human_requested: {
    action: "transfer",
    config: {},
    max_attempts: 1,
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch the active scenario handler for an agent.
 * Returns the configured DB row if one exists, otherwise the built-in default.
 */
export async function getScenarioHandler(
  admin: Admin,
  agentId: string,
  scenario: ScenarioType,
): Promise<ScenarioHandler> {
  const { data } = await admin
    .from("scenario_handlers")
    .select("id, scenario, action, config, max_attempts")
    .eq("agent_id", agentId)
    .eq("scenario", scenario)
    .eq("is_active", true)
    .maybeSingle();

  if (data) {
    return {
      ...(data as Omit<ScenarioHandler, "isDefault">),
      isDefault: false,
    };
  }

  const def = DEFAULTS[scenario];
  return {
    id: `default:${scenario}`,
    scenario,
    action: def.action,
    config: def.config,
    max_attempts: def.max_attempts,
    isDefault: true,
  };
}

/**
 * Classify a call that hit voicemail based on how long the call lasted.
 * Calls ≤ 3 s almost always mean the voicemail greeting hadn't started;
 * longer calls captured the full greeting and can leave a message.
 */
export function classifyVoicemailScenario(
  durationSeconds: number,
): ScenarioType {
  return durationSeconds <= 3 ? "voicemail_short" : "voicemail_long";
}

/**
 * Returns the LLM instruction string for an objection-recovery handler,
 * with {{max_attempts}} resolved to the configured value.
 */
export function buildObjectionInstruction(handler: ScenarioHandler): string {
  const raw =
    (handler.config["llm_instruction"] as string | undefined) ??
    (DEFAULTS.objection.config["llm_instruction"] as string);
  return raw.replace(/\{\{max_attempts\}\}/g, String(handler.max_attempts));
}
