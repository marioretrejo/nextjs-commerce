/**
 * POST /api/campaigns/[id]/leads/batch
 *
 * Ingests an array of contacts (e.g. parsed from a CSV upload) into
 * campaign_contacts. Each phone number is normalised to E.164; rows with
 * invalid / un-normalizable numbers are skipped and reported back to the
 * caller rather than failing the entire batch.
 *
 * Auth: user session — campaign ownership verified via RLS before admin write.
 * Limit: 10,000 rows per request.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody } from "@/lib/api";

const E164_RE = /^\+[1-9]\d{6,14}$/;

function normalizeE164(raw: string): { normalized: string; valid: boolean } {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");

  // Already in +<digits> form
  if (trimmed.startsWith("+")) {
    const candidate = `+${digits}`;
    return { normalized: candidate, valid: E164_RE.test(candidate) };
  }

  // 11 digits starting with 1 → US/Canada with country code omitting +
  if (digits.length === 11 && digits.startsWith("1")) {
    const candidate = `+${digits}`;
    return { normalized: candidate, valid: E164_RE.test(candidate) };
  }

  // 10 digits → assume US/Canada (+1)
  if (digits.length === 10) {
    const candidate = `+1${digits}`;
    return { normalized: candidate, valid: E164_RE.test(candidate) };
  }

  return { normalized: trimmed, valid: false };
}

const LeadSchema = z.object({
  phone: z.string().min(1),
  name: z.string().max(200).optional().nullable(),
  email: z.string().email().max(500).optional().nullable(),
  variables: z.record(z.string()).optional(),
  campaign_lead_id: z.string().max(255).optional().nullable(),
});

const BatchLeadsSchema = z.object({
  leads: z.array(LeadSchema).min(1).max(10_000),
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
  const { leads } = parsed.data;

  const validRows: Record<string, unknown>[] = [];
  const invalidLeads: InvalidLead[] = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const { normalized, valid } = normalizeE164(lead.phone);

    if (!valid) {
      invalidLeads.push({
        index: i,
        phone: lead.phone,
        reason: `Cannot normalise "${lead.phone}" to E.164`,
      });
      continue;
    }

    validRows.push({
      campaign_id: id,
      phone: normalized,
      name: lead.name ?? null,
      email: lead.email ?? null,
      variables: lead.variables ?? {},
      campaign_lead_id: lead.campaign_lead_id ?? null,
      status: "pending",
    });
  }

  let inserted = 0;
  let dbError: string | null = null;

  if (validRows.length) {
    const admin = createAdminClient();
    const { error } = await admin.from("campaign_contacts").insert(validRows);

    if (error) {
      console.error("[campaigns/leads/batch] insert error:", error);
      dbError = error.message;
    } else {
      inserted = validRows.length;

      // Keep total_contacts in sync
      const { count } = await admin
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id);
      void admin
        .from("campaigns")
        .update({ total_contacts: count ?? 0 })
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
