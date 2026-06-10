/**
 * POST /api/campaigns/[id]/leads/batch
 *
 * Ingests an array of contacts (e.g. parsed from a CSV upload) into
 * campaign_contacts. Each phone number is normalised to E.164 via
 * libphonenumber-js (supports LATAM and international numbers).
 * Rows with invalid / un-normalizable numbers are skipped and reported.
 *
 * Within-batch deduplication is applied on (phone, campaign_lead_id)
 * before the database upsert, which itself uses ON CONFLICT DO NOTHING
 * on the unique indexes (campaign_id, phone) and (campaign_id, campaign_lead_id).
 *
 * Auth: user session — campaign ownership verified via RLS before admin write.
 * Limit: 1,000 rows per request.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody } from "@/lib/api";
import { normalizePhone, sanitizeVariables } from "@/lib/campaigns/validation";
import type { CountryCode } from "libphonenumber-js";

const LeadSchema = z.object({
  phone: z.string().min(1),
  name: z.string().max(200).optional().nullable(),
  email: z.string().email().max(500).optional().nullable(),
  variables: z.record(z.string()).optional(),
  campaign_lead_id: z.string().max(255).optional().nullable(),
});

const BatchLeadsSchema = z.object({
  leads: z.array(LeadSchema).min(1).max(1_000),
  default_country: z.string().length(2).optional(),
});

interface InvalidLead {
  index: number;
  phone: string;
  reason: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify campaign ownership through RLS before admin write
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, workspace_id, status")
    .eq("id", id)
    .single();
  if (!campaign)
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const parsed = parseBody(BatchLeadsSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const { leads, default_country } = parsed.data;

  const defaultCountry = (default_country?.toUpperCase() ??
    "US") as CountryCode;

  const validRows: Record<string, unknown>[] = [];
  const invalidLeads: InvalidLead[] = [];

  // Within-batch deduplication sets
  const seenPhones = new Set<string>();
  const seenLeadIds = new Set<string>();

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const { normalized, valid } = normalizePhone(lead.phone, defaultCountry);

    if (!valid) {
      invalidLeads.push({
        index: i,
        phone: lead.phone,
        reason: `Cannot normalise "${lead.phone}" to E.164`,
      });
      continue;
    }

    // Within-batch phone dedup
    if (seenPhones.has(normalized)) {
      invalidLeads.push({
        index: i,
        phone: lead.phone,
        reason: `Duplicate phone in batch: ${normalized}`,
      });
      continue;
    }
    seenPhones.add(normalized);

    // Within-batch campaign_lead_id dedup
    if (lead.campaign_lead_id) {
      if (seenLeadIds.has(lead.campaign_lead_id)) {
        invalidLeads.push({
          index: i,
          phone: lead.phone,
          reason: `Duplicate campaign_lead_id in batch: ${lead.campaign_lead_id}`,
        });
        continue;
      }
      seenLeadIds.add(lead.campaign_lead_id);
    }

    // Sanitize variables: strip secret-like keys, enforce 4 KB limit
    const rawVars = lead.variables ?? {};
    const {
      sanitized: safeVars,
      removedKeys,
      oversized,
    } = sanitizeVariables(rawVars);
    if (oversized) {
      invalidLeads.push({
        index: i,
        phone: lead.phone,
        reason: "variables payload exceeds 4 KB limit",
      });
      continue;
    }
    if (removedKeys.length > 0) {
      console.warn(
        `[campaigns/leads/batch] Removed secret-like variable keys for lead ${i}: ${removedKeys.join(", ")}`,
      );
    }

    validRows.push({
      campaign_id: id,
      phone: normalized,
      name: lead.name ?? null,
      email: lead.email ?? null,
      variables: safeVars,
      campaign_lead_id: lead.campaign_lead_id ?? null,
      status: "pending",
    });
  }

  let inserted = 0;
  let dbError: string | null = null;

  if (validRows.length) {
    const admin = createAdminClient();
    // ignoreDuplicates: upsert with ON CONFLICT DO NOTHING — idempotent across retries
    const { error, count } = await admin
      .from("campaign_contacts")
      .upsert(validRows, {
        onConflict: "campaign_id,phone",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (error) {
      console.error("[campaigns/leads/batch] upsert error:", error);
      dbError = error.message;
    } else {
      inserted = count ?? validRows.length;

      // Keep total_contacts in sync
      const { count: total } = await admin
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id);
      void admin
        .from("campaigns")
        .update({ total_contacts: total ?? 0 })
        .eq("id", id)
        .then(
          () => null,
          () => null,
        );
    }
  }

  if (dbError) return apiError(dbError, 500);

  return NextResponse.json(
    {
      inserted,
      skipped: invalidLeads.length,
      invalid_phones: invalidLeads,
    },
    { status: 201 },
  );
}
