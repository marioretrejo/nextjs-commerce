/**
 * QA Center — Customer Memory helpers
 *
 * All operations use the admin client and never throw — callers must handle
 * null returns rather than catching exceptions. Enrichment must never block
 * the webhook or analysis pipeline.
 */
import { createAdminClient } from "@/lib/supabase/admin";

/** Normalize a phone number to E.164 format (+digits only).
 *  Returns null if the input cannot produce a plausible E.164 number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Lowercase + trim an email address. Returns null if empty. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export interface UpsertCustomerInput {
  workspace_id: string;
  canonical_phone?: string | null;
  canonical_email?: string | null;
  display_name?: string | null;
}

export interface CustomerRow {
  id: string;
  workspace_id: string;
  canonical_phone: string | null;
  canonical_email: string | null;
  display_name: string;
  first_seen_at: string;
  last_seen_at: string;
  total_calls: number;
  lifetime_sentiment: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Upsert a customer by phone or email within a workspace.
 * Increments total_calls and updates last_seen_at on each call.
 * Returns the customer row, or null on failure — never throws.
 */
export async function upsertCustomer(
  input: UpsertCustomerInput,
): Promise<CustomerRow | null> {
  const { workspace_id, canonical_phone, canonical_email, display_name } = input;
  if (!canonical_phone && !canonical_email) return null;

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Look up existing customer — phone takes precedence over email
    let existing: CustomerRow | null = null;

    if (canonical_phone) {
      const { data } = await admin
        .from("qac_customers")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("canonical_phone", canonical_phone)
        .maybeSingle();
      existing = (data as CustomerRow | null) ?? null;
    }

    if (!existing && canonical_email) {
      const { data } = await admin
        .from("qac_customers")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("canonical_email", canonical_email)
        .maybeSingle();
      existing = (data as CustomerRow | null) ?? null;
    }

    if (existing) {
      const patch: Record<string, unknown> = {
        last_seen_at: now,
        total_calls: (existing.total_calls ?? 0) + 1,
        updated_at: now,
      };
      // Backfill missing identifiers
      if (canonical_phone && !existing.canonical_phone) patch["canonical_phone"] = canonical_phone;
      if (canonical_email && !existing.canonical_email) patch["canonical_email"] = canonical_email;
      // Only update display_name if we now have a real one and existing is still the default
      if (display_name && existing.display_name === "Unknown") patch["display_name"] = display_name;

      const { data: updated, error } = await admin
        .from("qac_customers")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) {
        console.error("[qac-customer] update failed:", error.message);
        return existing;
      }
      return updated as CustomerRow;
    }

    // New customer
    const { data: inserted, error: insertErr } = await admin
      .from("qac_customers")
      .insert({
        workspace_id,
        canonical_phone: canonical_phone ?? null,
        canonical_email: canonical_email ?? null,
        display_name: display_name ?? "Unknown",
        first_seen_at: now,
        last_seen_at: now,
        total_calls: 1,
      })
      .select("*")
      .single();
    if (insertErr) {
      console.error("[qac-customer] insert failed:", insertErr.message);
      return null;
    }
    return inserted as CustomerRow;
  } catch (err) {
    console.error("[qac-customer] upsertCustomer unexpected error:", err);
    return null;
  }
}

/** Fetch a single customer by ID, scoped to workspace. Returns null on failure. */
export async function getCustomerById(
  workspace_id: string,
  customer_id: string,
): Promise<CustomerRow | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("qac_customers")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("id", customer_id)
      .single();
    if (error || !data) return null;
    return data as CustomerRow;
  } catch {
    return null;
  }
}

export interface ListCustomersOptions {
  workspace_id: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListCustomersResult {
  data: CustomerRow[];
  total: number;
}

/** List customers for a workspace with optional full-text search. Never throws. */
export async function listCustomers(
  opts: ListCustomersOptions,
): Promise<ListCustomersResult> {
  const { workspace_id, search, limit = 20, offset = 0 } = opts;
  try {
    const admin = createAdminClient();
    let query = admin
      .from("qac_customers")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspace_id)
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,canonical_phone.ilike.%${search}%,canonical_email.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("[qac-customer] listCustomers failed:", error.message);
      return { data: [], total: 0 };
    }
    return { data: (data ?? []) as CustomerRow[], total: count ?? 0 };
  } catch (err) {
    console.error("[qac-customer] listCustomers unexpected error:", err);
    return { data: [], total: 0 };
  }
}
