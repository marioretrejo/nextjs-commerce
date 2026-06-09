/**
 * Dialing Strategy Service
 *
 * Three responsibilities:
 *  1. pickCallerNumber — area-code proximity matching for local presence
 *  2. isWithinSchedule — timezone-aware schedule window validation
 *  3. resolveDialConfig — aggregates sip_trunks + schedules + numbers
 *
 * Used by /api/calls/dial and /api/v1/calls/outbound before placing a call.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePhoneNumber } from "libphonenumber-js";

type Admin = ReturnType<typeof createAdminClient>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SipTrunk {
  id: string;
  name: string;
  provider: string;
  sip_host: string;
  username: string;
  password: string;
  livekit_trunk_id: string | null;
  priority: number;
}

export interface ScheduleWindow {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  start: string; // "HH:MM" 24-hour
  end: string; // "HH:MM" 24-hour
}

export interface DialConfig {
  /** Best active SIP trunk, or null if none configured */
  trunk: SipTrunk | null;
  /** Outbound caller number closest to the destination, or null */
  callerNumber: string | null;
  /** Whether the current moment is within the workspace/agent schedule */
  withinSchedule: boolean;
  /** IANA timezone used for the schedule check */
  scheduleTimezone: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Extract NANP area code (first 3 digits of national number) from E.164 */
function extractAreaCode(e164: string): string | null {
  try {
    const parsed = parsePhoneNumber(e164);
    if (!["US", "CA"].includes(parsed.country ?? "")) return null;
    return String(parsed.nationalNumber).slice(0, 3);
  } catch {
    return null;
  }
}

/** Extract ISO 3166-1 alpha-2 country from E.164 */
function extractCountry(e164: string): string | null {
  try {
    return parsePhoneNumber(e164).country ?? null;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if the current moment in `timezone` falls inside any of the
 * provided schedule windows.
 *
 * If `windows` is empty the call is considered always allowed.
 */
export function isWithinSchedule(
  windows: ScheduleWindow[],
  timezone: string,
): boolean {
  if (!windows.length) return true;

  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(now);
  const weekday = (parts.find((p) => p.type === "weekday")?.value ?? "")
    .toLowerCase()
    .slice(0, 3);
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minStr = parts.find((p) => p.type === "minute")?.value ?? "00";
  // Intl hour12:false can return "24" for midnight — normalise to "00"
  const hour = parseInt(hourStr === "24" ? "0" : hourStr, 10);
  const minute = parseInt(minStr, 10);
  const nowMins = hour * 60 + minute;

  return windows.some((w) => {
    if (w.day !== weekday) return false;
    const [sh = 9, sm = 0] = w.start.split(":").map(Number);
    const [eh = 18, em = 0] = w.end.split(":").map(Number);
    return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
  });
}

/**
 * Pick the best outbound number for a destination phone number.
 *
 * Priority:
 *  1. Exact NANP area-code match (sip_trunk_numbers table)
 *  2. Same-country match         (sip_trunk_numbers table)
 *  3. Any number in sip_trunk_numbers
 *  4. Fallback: phone_numbers table (legacy), same logic
 */
export async function pickCallerNumber(
  admin: Admin,
  workspaceId: string,
  destination: string,
): Promise<string | null> {
  const destArea = extractAreaCode(destination);
  const destCountry = extractCountry(destination);

  // ── 1. sip_trunk_numbers (new table) ────────────────────────────────────
  const { data: trunkNums } = await admin
    .from("sip_trunk_numbers")
    .select("number, area_code, country_code")
    .eq("workspace_id", workspaceId)
    .order("is_primary", { ascending: false });

  type TrunkNum = {
    number: string;
    area_code: string | null;
    country_code: string;
  };
  if (trunkNums?.length) {
    const nums = trunkNums as TrunkNum[];
    if (destArea) {
      const hit = nums.find((n) => n.area_code === destArea);
      if (hit) return hit.number;
    }
    if (destCountry) {
      const hit = nums.find((n) => n.country_code === destCountry);
      if (hit) return hit.number;
    }
    return nums[0]!.number;
  }

  // ── 2. Legacy phone_numbers table ──────────────────────────────────────
  const { data: legacyNums } = await admin
    .from("phone_numbers")
    .select("number, country_code")
    .eq("workspace_id", workspaceId)
    .eq("status", "available");

  type LegacyNum = { number: string; country_code: string };
  if (legacyNums?.length) {
    const nums = legacyNums as LegacyNum[];
    if (destCountry) {
      const hit = nums.find((n) => n.country_code === destCountry);
      if (hit) return hit.number;
    }
    return nums[0]!.number;
  }

  return null;
}

/**
 * Resolve the complete dialing configuration for a workspace + agent
 * before placing an outbound call.
 *
 * Selects:
 *  • The highest-priority active SIP trunk
 *  • The nearest outbound number to the destination
 *  • Whether the call is within the applicable schedule
 */
export async function resolveDialConfig(
  admin: Admin,
  workspaceId: string,
  agentId: string,
  destination: string,
): Promise<DialConfig> {
  const [trunkRes, scheduleRes, callerNumber] = await Promise.all([
    admin
      .from("sip_trunks")
      .select(
        "id, name, provider, sip_host, username, password, livekit_trunk_id, priority",
      )
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Agent-specific schedule first; fall back to workspace default
    admin
      .from("dialing_schedules")
      .select("windows, timezone")
      .eq("workspace_id", workspaceId)
      .or(`agent_id.eq.${agentId},is_default.eq.true`)
      .order("is_default", { ascending: true })
      .limit(1)
      .maybeSingle(),

    pickCallerNumber(admin, workspaceId, destination),
  ]);

  const trunk = trunkRes.data as SipTrunk | null;
  const schedule = scheduleRes.data as {
    windows: ScheduleWindow[];
    timezone: string;
  } | null;

  return {
    trunk,
    callerNumber,
    withinSchedule: schedule
      ? isWithinSchedule(
          schedule.windows as ScheduleWindow[],
          schedule.timezone,
        )
      : true,
    scheduleTimezone: schedule?.timezone ?? "UTC",
  };
}

/**
 * Cache the LiveKit trunk ID back into the sip_trunks row after first use.
 * Fire-and-forget — failure is non-fatal.
 */
export function cacheLivekitTrunkId(
  admin: Admin,
  trunkId: string,
  livekitTrunkId: string,
): void {
  void Promise.resolve(
    admin
      .from("sip_trunks")
      .update({ livekit_trunk_id: livekitTrunkId })
      .eq("id", trunkId),
  ).catch(() => null);
}
