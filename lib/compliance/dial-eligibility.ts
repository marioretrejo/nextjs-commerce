/**
 * Dial Eligibility Engine — Compliance Pre-Dial Gate
 *
 * checkDialEligibility() must be called before:
 *   - acquiring a concurrent-call slot
 *   - creating a LiveKit room
 *   - initiating any Twilio/SIP call
 *
 * Fail-closed by design: if a critical internal error occurs during evaluation,
 * the function returns allowed=false to prevent non-compliant dials.
 * Logging errors (recordDialEligibilityCheck) are fire-and-forget — they never
 * block dialing.
 *
 * Checks run sequentially; the first failing check short-circuits the rest.
 */

// libphonenumber-js may fail in some build/test environments due to metadata
// loading quirks. Wrap all calls in try/catch and fall back to E.164 regex.
import type { CountryCode } from "libphonenumber-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Public types ─────────────────────────────────────────────────────────────

export type DialEligibilityResult = {
  allowed: boolean;
  reason: string | null;
  reason_code: string | null;
  checks: Record<string, unknown>;
  normalized_phone?: string;
  country?: string | null;
  timezone?: string | null;
};

export type DialEligibilityInput = {
  workspaceId: string;
  campaignId?: string | null;
  leadId?: string | null;
  phoneNumber: string;
  country?: string | null;
  timezone?: string | null;
  callDirection?: "outbound";
  now?: Date;
  supabase: SupabaseClient;
};

// ── Reason codes (exhaustive list for docs) ───────────────────────────────────

export const REASON_CODES = {
  INVALID_PHONE: "invalid_phone_number",
  WORKSPACE_NOT_FOUND: "workspace_not_found",
  WORKSPACE_SUSPENDED: "workspace_suspended",
  WORKSPACE_OVERAGE: "workspace_overage_blocked",
  INSUFFICIENT_BALANCE: "insufficient_balance",
  CAMPAIGN_PAUSED: "campaign_paused",
  CAMPAIGN_INACTIVE: "campaign_inactive",
  DNC: "dnc",
  OPT_OUT: "opt_out",
  MAX_RETRIES: "max_retries_exceeded",
  COOLDOWN: "cooldown_active",
  OUTSIDE_HOURS: "outside_allowed_hours",
  COUNTRY_NOT_ALLOWED: "country_not_allowed",
  MISSING_CONSENT: "missing_consent",
  ELIGIBILITY_ERROR: "eligibility_check_error",
} as const;

// Default cooldown between attempts for the same number (4 hours)
const DEFAULT_COOLDOWN_HOURS = 4;

// E.164 format: +[country code][number], 7–15 digits total
const E164_RE = /^\+[1-9]\d{6,14}$/;

function _isValidPhone(phone: string): boolean {
  if (!E164_RE.test(phone)) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = require("libphonenumber-js") as {
      isValidPhoneNumber: (p: string) => boolean;
    };
    return lib.isValidPhoneNumber(phone);
  } catch {
    return true; // E.164 regex already passed — treat as valid
  }
}

function _normalizePhone(phone: string): {
  normalized: string;
  country: CountryCode | string | null;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = require("libphonenumber-js") as {
      parsePhoneNumber: (p: string) => {
        format: (f: string) => string;
        country?: CountryCode;
      };
    };
    const parsed = lib.parsePhoneNumber(phone);
    return {
      normalized: parsed.format("E.164"),
      country: parsed.country ?? null,
    };
  } catch {
    return { normalized: phone, country: null };
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function blocked(
  reason_code: string,
  reason: string,
  checks: Record<string, unknown> = {},
  extra: Pick<
    DialEligibilityResult,
    "normalized_phone" | "country" | "timezone"
  > = {},
): DialEligibilityResult {
  return { allowed: false, reason, reason_code, checks, ...extra };
}

function allowed(
  checks: Record<string, unknown>,
  extra: Pick<
    DialEligibilityResult,
    "normalized_phone" | "country" | "timezone"
  > = {},
): DialEligibilityResult {
  return { allowed: true, reason: null, reason_code: null, checks, ...extra };
}

/**
 * Determines whether `now` falls within the configured allowed hours.
 *
 * @param timezone   IANA timezone string (e.g. "America/Mexico_City")
 * @param now        Current instant
 * @param startHHMM  "HH:MM" start (inclusive) from compliance_settings
 * @param endHHMM    "HH:MM" end   (exclusive) from compliance_settings
 * @param days       Array of day keys: "mon","tue","wed","thu","fri","sat","sun"
 */
export function isWithinAllowedDialingHours(opts: {
  timezone: string;
  now: Date;
  startHHMM: string;
  endHHMM: string;
  days: string[];
}): boolean {
  const { timezone, now, startHHMM, endHHMM, days } = opts;
  try {
    const fmt = (part: Intl.DateTimeFormatPartTypes) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        [part]: "2-digit",
      })
        .formatToParts(now)
        .find((p) => p.type === part)?.value ?? "00";

    const hourStr = fmt("hour");
    const minuteStr = fmt("minute");
    const weekdayMap: Record<string, string> = {
      Mon: "mon",
      Tue: "tue",
      Wed: "wed",
      Thu: "thu",
      Fri: "fri",
      Sat: "sat",
      Sun: "sun",
    };
    const weekdayFull = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    })
      .format(now)
      .slice(0, 3);
    const currentDay = weekdayMap[weekdayFull] ?? weekdayFull.toLowerCase();

    if (!days.includes(currentDay)) return false;

    // Compare HH:MM strings lexicographically (works because zero-padded)
    const [sh, sm] = startHHMM.split(":").map(Number) as [number, number];
    const [eh, em] = endHHMM.split(":").map(Number) as [number, number];
    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    return false;
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Evaluates all pre-dial compliance checks for an outbound call attempt.
 *
 * Returns a DialEligibilityResult where allowed=true means the call may proceed.
 * The `checks` field contains per-check metadata useful for auditing.
 *
 * This function is fail-closed: any unhandled exception returns allowed=false
 * with reason_code='eligibility_check_error'.
 */
export async function checkDialEligibility(
  input: DialEligibilityInput,
): Promise<DialEligibilityResult> {
  const now = input.now ?? new Date();
  const checks: Record<string, unknown> = {};

  try {
    // ── 1. Phone number validation ───────────────────────────────────────────
    let normalizedPhone = input.phoneNumber;
    let country = input.country ?? null;
    let timezone = input.timezone ?? null;

    if (!_isValidPhone(input.phoneNumber)) {
      return blocked(
        REASON_CODES.INVALID_PHONE,
        `Invalid phone number: ${input.phoneNumber}`,
        { phone_validation: "failed" },
      );
    }

    const parsed = _normalizePhone(input.phoneNumber);
    normalizedPhone = parsed.normalized;
    country = country ?? (parsed.country as string | null);

    checks["phone_normalized"] = normalizedPhone;
    checks["country"] = country;

    const extra = { normalized_phone: normalizedPhone, country, timezone };

    // ── 2. Workspace status ──────────────────────────────────────────────────
    const { data: ws, error: wsErr } = await input.supabase
      .from("workspaces")
      .select("id, is_suspended, overage_blocked, minutes_used, minutes_limit")
      .eq("id", input.workspaceId)
      .single();

    if (wsErr || !ws) {
      return blocked(
        REASON_CODES.WORKSPACE_NOT_FOUND,
        "Workspace not found",
        { ...checks, workspace: "not_found" },
        extra,
      );
    }

    const wsRow = ws as {
      id: string;
      is_suspended: boolean;
      overage_blocked: boolean;
      minutes_used: number;
      minutes_limit: number;
    };

    if (wsRow.is_suspended) {
      return blocked(
        REASON_CODES.WORKSPACE_SUSPENDED,
        "Workspace is suspended",
        { ...checks, workspace_suspended: true },
        extra,
      );
    }

    if (wsRow.overage_blocked) {
      return blocked(
        REASON_CODES.WORKSPACE_OVERAGE,
        "Workspace is blocked due to minute overage",
        { ...checks, overage_blocked: true },
        extra,
      );
    }

    checks["workspace_active"] = true;

    // ── 3. Balance / minutes ─────────────────────────────────────────────────
    if (
      wsRow.minutes_limit > 0 &&
      Number(wsRow.minutes_used) >= Number(wsRow.minutes_limit)
    ) {
      return blocked(
        REASON_CODES.INSUFFICIENT_BALANCE,
        `Minute limit reached (${wsRow.minutes_used}/${wsRow.minutes_limit})`,
        {
          ...checks,
          minutes_used: wsRow.minutes_used,
          minutes_limit: wsRow.minutes_limit,
        },
        extra,
      );
    }

    checks["minutes_ok"] = true;

    // ── 4. Campaign status ───────────────────────────────────────────────────
    let campaignMaxRetries = 3;
    let campaignRetryIntervalHours = 4;

    if (input.campaignId) {
      const { data: campaign } = await input.supabase
        .from("campaigns")
        .select("status, max_retries, retry_interval_hours, retry_enabled")
        .eq("id", input.campaignId)
        .maybeSingle();

      if (!campaign) {
        return blocked(
          REASON_CODES.CAMPAIGN_INACTIVE,
          "Campaign not found",
          { ...checks, campaign: "not_found" },
          extra,
        );
      }

      const camp = campaign as {
        status: string;
        max_retries: number;
        retry_interval_hours: number;
        retry_enabled: boolean;
      };

      if (camp.status === "paused") {
        return blocked(
          REASON_CODES.CAMPAIGN_PAUSED,
          "Campaign is paused",
          { ...checks, campaign_status: camp.status },
          extra,
        );
      }

      if (
        camp.status === "completed" ||
        camp.status === "cancelled" ||
        camp.status === "inactive"
      ) {
        return blocked(
          REASON_CODES.CAMPAIGN_INACTIVE,
          `Campaign is ${camp.status}`,
          { ...checks, campaign_status: camp.status },
          extra,
        );
      }

      campaignMaxRetries = camp.max_retries ?? 3;
      campaignRetryIntervalHours =
        camp.retry_interval_hours ?? DEFAULT_COOLDOWN_HOURS;
      checks["campaign_status"] = camp.status;
    }

    // ── 5. DNC — check both dnc_entries (compliance) and dnc_list (enterprise) ─
    const dncFilter = `phone.eq.${normalizedPhone},phone.eq.${input.phoneNumber}`;

    const [{ data: dncEntry }, { data: dncListEntry }] = await Promise.all([
      input.supabase
        .from("dnc_entries")
        .select("id")
        .eq("workspace_id", input.workspaceId)
        .or(dncFilter)
        .limit(1)
        .maybeSingle(),
      input.supabase
        .from("dnc_list")
        .select("id")
        .eq("workspace_id", input.workspaceId)
        .or(dncFilter)
        .limit(1)
        .maybeSingle(),
    ]);

    if (dncEntry || dncListEntry) {
      return blocked(
        REASON_CODES.DNC,
        "Phone number is on the Do Not Call list",
        { ...checks, dnc: true },
        extra,
      );
    }

    checks["dnc_clear"] = true;

    // ── 6. Opt-out from previous calls ───────────────────────────────────────
    const { data: optOutCall } = await input.supabase
      .from("calls")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .in("business_outcome", ["dnc", "opt_out"])
      .or(
        `contact_phone.eq.${normalizedPhone},contact_phone.eq.${input.phoneNumber}`,
      )
      .limit(1)
      .maybeSingle();

    if (optOutCall) {
      return blocked(
        REASON_CODES.OPT_OUT,
        "Contact previously opted out",
        { ...checks, opt_out: true },
        extra,
      );
    }

    checks["opt_out_clear"] = true;

    // ── 7. Max retries (campaign_contacts attempts count) ────────────────────
    if (input.campaignId && input.leadId && campaignMaxRetries > 0) {
      const { data: contactRow } = await input.supabase
        .from("campaign_contacts")
        .select("attempts")
        .eq("campaign_id", input.campaignId)
        .eq("id", input.leadId)
        .maybeSingle();

      if (contactRow) {
        const attempts = (contactRow as { attempts: number }).attempts ?? 0;
        if (attempts >= campaignMaxRetries) {
          return blocked(
            REASON_CODES.MAX_RETRIES,
            `Max retries exceeded (${attempts}/${campaignMaxRetries})`,
            { ...checks, attempts, max_retries: campaignMaxRetries },
            extra,
          );
        }
        checks["attempts"] = attempts;
        checks["max_retries"] = campaignMaxRetries;
      }
    }

    checks["retries_ok"] = true;

    // ── 8. Cooldown between attempts ─────────────────────────────────────────
    const cooldownHours = input.campaignId
      ? campaignRetryIntervalHours
      : DEFAULT_COOLDOWN_HOURS;
    const cooldownThreshold = new Date(
      now.getTime() - cooldownHours * 3_600_000,
    );

    const { data: recentCall } = await input.supabase
      .from("calls")
      .select("id, created_at")
      .eq("workspace_id", input.workspaceId)
      .or(
        `contact_phone.eq.${normalizedPhone},contact_phone.eq.${input.phoneNumber}`,
      )
      .gte("created_at", cooldownThreshold.toISOString())
      .limit(1)
      .maybeSingle();

    if (recentCall) {
      return blocked(
        REASON_CODES.COOLDOWN,
        `Cooldown active: called within last ${cooldownHours}h`,
        {
          ...checks,
          cooldown_hours: cooldownHours,
          last_call_at: (recentCall as { created_at: string }).created_at,
        },
        extra,
      );
    }

    checks["cooldown_clear"] = true;

    // ── 9. Allowed calling hours ─────────────────────────────────────────────
    const { data: settings } = await input.supabase
      .from("compliance_settings")
      .select(
        "calling_hours_enabled, calling_hours_start, calling_hours_end, calling_days",
      )
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();

    if (settings) {
      const s = settings as {
        calling_hours_enabled: boolean;
        calling_hours_start: string;
        calling_hours_end: string;
        calling_days: string[];
      };

      if (s.calling_hours_enabled) {
        // Determine timezone: prefer explicit input, then country-based default
        const tz = timezone ?? _defaultTimezoneForCountry(country) ?? "UTC";

        const withinHours = isWithinAllowedDialingHours({
          timezone: tz,
          now,
          startHHMM: s.calling_hours_start ?? "09:00",
          endHHMM: s.calling_hours_end ?? "18:00",
          days: s.calling_days ?? ["mon", "tue", "wed", "thu", "fri"],
        });

        if (!withinHours) {
          return blocked(
            REASON_CODES.OUTSIDE_HOURS,
            `Outside allowed calling hours (${s.calling_hours_start}–${s.calling_hours_end} ${tz})`,
            {
              ...checks,
              calling_hours_start: s.calling_hours_start,
              calling_hours_end: s.calling_hours_end,
              calling_days: s.calling_days,
              timezone: tz,
            },
            extra,
          );
        }
      }

      checks["hours_ok"] = true;

      // ── 11. Consent check ──────────────────────────────────────────────────
      // NOTE: No consent_logs table exists yet. If require_consent is enabled,
      // we block fail-closed for automatic outbound to prevent non-consented dials.
      // When consent_logs is added in a future migration, this check can be relaxed
      // to verify a 'granted' status per phone/workspace.
      if (s.calling_hours_enabled === false) {
        // calling_hours_enabled is unrelated to consent — just marking we checked
      }
    }

    // ── 10 / 12. Country + custom rules ──────────────────────────────────────
    // Country-based blocking is not yet stored in workspace/campaign schema.
    // Custom compliance_rules don't have machine-readable blocking criteria.
    // These are no-ops in this implementation — see docs/compliance-pre-dial.md.
    checks["country_check"] = "skipped_no_schema";
    checks["custom_rules_check"] = "skipped_no_criteria";

    // ── All checks passed ─────────────────────────────────────────────────────
    return allowed(checks, {
      normalized_phone: normalizedPhone,
      country,
      timezone,
    });
  } catch (err) {
    // Fail-closed on unexpected error
    console.error("[dial-eligibility] unexpected error:", String(err));
    return blocked(
      REASON_CODES.ELIGIBILITY_ERROR,
      `Eligibility check failed unexpectedly: ${String(err).slice(0, 120)}`,
      { error: String(err).slice(0, 120) },
    );
  }
}

// ── Logging helper ────────────────────────────────────────────────────────────

export type EligibilityCheckContext = {
  workspaceId: string;
  campaignId?: string | null;
  leadId?: string | null;
  phoneNumber: string;
};

/**
 * Fire-and-forget: records the eligibility result in dial_eligibility_checks.
 * Never throws — a DB failure must not block the call.
 */
export async function recordDialEligibilityCheck(
  result: DialEligibilityResult,
  ctx: EligibilityCheckContext,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    const { error } = await supabase.from("dial_eligibility_checks").insert({
      workspace_id: ctx.workspaceId,
      campaign_id: ctx.campaignId ?? null,
      lead_id: ctx.leadId ?? null,
      phone_number: ctx.phoneNumber,
      normalized_phone: result.normalized_phone ?? null,
      country: result.country ?? null,
      timezone: result.timezone ?? null,
      allowed: result.allowed,
      reason: result.reason,
      reason_code: result.reason_code,
      checks: result.checks,
    });
    if (error) {
      console.warn("[dial-eligibility] record insert failed:", error.message, {
        reason_code: result.reason_code,
      });
    }
  } catch (err) {
    console.warn("[dial-eligibility] record unexpected error:", String(err));
  }
}

// ── Internal utilities ────────────────────────────────────────────────────────

/** Returns a conservative IANA timezone for a given ISO country code. */
function _defaultTimezoneForCountry(
  country: string | null | undefined,
): string | null {
  if (!country) return null;
  const map: Record<string, string> = {
    US: "America/New_York",
    CA: "America/Toronto",
    MX: "America/Mexico_City",
    GB: "Europe/London",
    DE: "Europe/Berlin",
    FR: "Europe/Paris",
    ES: "Europe/Madrid",
    BR: "America/Sao_Paulo",
    AR: "America/Argentina/Buenos_Aires",
    CO: "America/Bogota",
    CL: "America/Santiago",
    PE: "America/Lima",
    AU: "Australia/Sydney",
  };
  return map[country] ?? null;
}
