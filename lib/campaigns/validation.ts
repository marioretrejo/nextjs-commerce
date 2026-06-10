import type { CountryCode } from "libphonenumber-js";
import type { CampaignStatus } from "@/lib/supabase/types";

// libphonenumber-js is conditionally required to avoid build-time failures
// in environments that don't bundle native metadata.
function getPhoneLib(): {
  parsePhoneNumber: (
    phone: string,
    country?: CountryCode,
  ) => { number: string; isValid(): boolean };
} | null {
  try {
    return require("libphonenumber-js") as {
      parsePhoneNumber: (
        phone: string,
        country?: CountryCode,
      ) => { number: string; isValid(): boolean };
    };
  } catch {
    return null;
  }
}

const E164_RE = /^\+[1-9]\d{6,14}$/;

export interface NormalizeResult {
  normalized: string;
  valid: boolean;
}

/**
 * Normalize a raw phone string to E.164.
 * Uses libphonenumber-js when available (supports LATAM and international).
 * Falls back to a simple US-only heuristic if the library is unavailable.
 */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = "US",
): NormalizeResult {
  const trimmed = raw.trim();
  if (!trimmed) return { normalized: trimmed, valid: false };

  const lib = getPhoneLib();
  if (lib) {
    try {
      const parsed = lib.parsePhoneNumber(trimmed, defaultCountry);
      return { normalized: parsed.number, valid: parsed.isValid() };
    } catch {
      // fall through to heuristic
    }
  }

  // Heuristic fallback (US / Canada only)
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    const candidate = `+${digits}`;
    return { normalized: candidate, valid: E164_RE.test(candidate) };
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const candidate = `+${digits}`;
    return { normalized: candidate, valid: E164_RE.test(candidate) };
  }
  if (digits.length === 10) {
    const candidate = `+1${digits}`;
    return { normalized: candidate, valid: E164_RE.test(candidate) };
  }
  return { normalized: trimmed, valid: false };
}

// Keys whose presence in `variables` or `configuration` indicates a secret
const SECRET_KEY_RE = /key|secret|token|password|credential|auth|api[-_]?key/i;

const VARIABLES_MAX_BYTES = 4 * 1024; // 4 KB

export interface SanitizeVariablesResult {
  sanitized: Record<string, string>;
  removedKeys: string[];
  oversized: boolean;
}

export function sanitizeVariables(
  vars: Record<string, string>,
): SanitizeVariablesResult {
  const sanitized: Record<string, string> = {};
  const removedKeys: string[] = [];

  for (const [k, v] of Object.entries(vars)) {
    if (SECRET_KEY_RE.test(k)) {
      removedKeys.push(k);
      continue;
    }
    sanitized[k] = v;
  }

  const byteSize = Buffer.byteLength(JSON.stringify(sanitized), "utf8");
  if (byteSize > VARIABLES_MAX_BYTES) {
    return { sanitized: {}, removedKeys, oversized: true };
  }

  return { sanitized, removedKeys, oversized: false };
}

export interface SanitizeConfigResult {
  sanitized: Record<string, unknown>;
  removedKeys: string[];
  error: string | null;
}

export function sanitizeConfiguration(
  config: Record<string, unknown> | null | undefined,
): SanitizeConfigResult {
  if (!config) return { sanitized: {}, removedKeys: [], error: null };

  const sanitized: Record<string, unknown> = {};
  const removedKeys: string[] = [];

  for (const [k, v] of Object.entries(config)) {
    if (SECRET_KEY_RE.test(k)) {
      removedKeys.push(k);
      continue;
    }
    // Validate webhook_url must be https
    if (k === "webhook_url" && typeof v === "string" && v !== "") {
      try {
        const url = new URL(v);
        if (url.protocol !== "https:") {
          return {
            sanitized,
            removedKeys,
            error: "configuration.webhook_url must use https",
          };
        }
      } catch {
        return {
          sanitized,
          removedKeys,
          error: "configuration.webhook_url is not a valid URL",
        };
      }
    }
    sanitized[k] = v;
  }

  return { sanitized, removedKeys, error: null };
}

// Valid status transitions: maps from-status → allowed to-statuses
export const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active", "scheduled", "paused"],
  scheduled: ["active", "paused", "draft"],
  active: ["paused", "completed"],
  paused: ["active", "completed", "draft"],
  completed: [],
};

export function isTransitionAllowed(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}
