/**
 * lib/jobs/process-post-call-job.ts
 *
 * Processes a single post-call job fetched from post_call_jobs.
 * Each handler is responsible for:
 *   1. Fetching any data it needs from DB (never trusts payload for large data)
 *   2. Executing the task (external call, DB write, etc.)
 *   3. Returning a result or throwing with an error code
 *
 * Error codes:
 *   "400" | "401" | "403" — permanent, do not retry
 *   "500" | "timeout" | "network" — transient, retry
 *   "not_found" — permanent
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostCallJob, PostCallJobType } from "@/lib/jobs/post-call-jobs";
import { runPostCallQA } from "@/lib/qa/evaluator";
import { dispatchPostCallEvents } from "@/lib/integrations/dispatcher";
import * as crypto from "node:crypto";

// ── CRM extraction (standalone — mirrors worker_core logic) ──────────────────

interface CrmFields {
  Age: string | null;
  Name: string | null;
  Motivation: string | null;
  interested: boolean | null;
  occupation: string | null;
  Financial_goal: string | null;
  Call_transferred: boolean | null;
  monthly_expenses: string | null;
  time_in_occupation: string | null;
  "In Voicemail": boolean;
  "Call Success": boolean;
}

async function _llmChat(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 512,
        messages,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

function _parseCrmFields(raw: string | null, blank: CrmFields): CrmFields {
  if (!raw) return blank;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return blank;
  try {
    const p = JSON.parse(m[0]) as Partial<CrmFields>;
    return {
      Age: p.Age ?? null,
      Name: p.Name ?? null,
      Motivation: p.Motivation ?? null,
      interested: p.interested ?? null,
      occupation: p.occupation ?? null,
      Financial_goal: p.Financial_goal ?? null,
      Call_transferred: p.Call_transferred ?? null,
      monthly_expenses: p.monthly_expenses ?? null,
      time_in_occupation: p.time_in_occupation ?? null,
      "In Voicemail": blank["In Voicemail"],
      "Call Success": p["Call Success"] ?? blank["Call Success"],
    };
  } catch {
    return blank;
  }
}

async function runCrmExtraction(
  supabase: SupabaseClient,
  job: PostCallJob,
): Promise<Record<string, unknown>> {
  if (!job.call_id)
    throw Object.assign(new Error("call_id missing"), { code: "not_found" });

  const { data: callRow } = await supabase
    .from("calls")
    .select("transcript, business_outcome, technical_status")
    .eq("id", job.call_id)
    .maybeSingle();

  if (!callRow)
    throw Object.assign(new Error("call not found"), { code: "not_found" });

  const c = callRow as {
    transcript: string | null;
    business_outcome: string | null;
    technical_status: string | null;
  };
  const transcript = c.transcript ?? "";
  const payload = job.payload as {
    crm_fields?: {
      Funnel?: string;
      LeadId?: string;
      Country?: string;
      Campaign?: string;
    };
    transcript_available?: boolean;
  };

  const voicemailDetected = c.business_outcome === "voicemail";
  const blank: CrmFields = {
    Age: null,
    Name: null,
    Motivation: null,
    interested: null,
    occupation: null,
    Financial_goal: null,
    Call_transferred: null,
    monthly_expenses: null,
    time_in_occupation: null,
    "In Voicemail": voicemailDetected,
    "Call Success": !voicemailDetected,
  };

  if (!transcript.trim()) {
    await supabase
      .from("calls")
      .update({ extracted_data: blank })
      .eq("id", job.call_id);
    return { provider: "deterministic", reason: "empty_transcript" };
  }

  const f = payload.crm_fields ?? {};
  const systemContent =
    `You are a CRM data extractor. Extract the following fields from the call transcript and return ONLY a valid JSON object with exactly these keys. Use null for unknown fields.\n` +
    `Keys: Age, Name, Motivation, interested (boolean), occupation, Financial_goal, Call_transferred (boolean), monthly_expenses, time_in_occupation, "In Voicemail" (boolean, value: ${voicemailDetected}), "Call Success" (boolean)\n` +
    `CRM Context: Funnel=${f.Funnel ?? "N/A"}, LeadId=${f.LeadId ?? "N/A"}, Country=${f.Country ?? "N/A"}, Campaign=${f.Campaign ?? "N/A"}`;

  const messages = [
    { role: "system", content: systemContent },
    { role: "user", content: `Transcript:\n${transcript.slice(0, 4000)}` },
  ];

  let extracted: CrmFields = blank;
  let provider: "groq" | "openai" | "deterministic" = "deterministic";

  const groqKey = process.env["GROQ_API_KEY"] ?? "";
  const openaiKey = process.env["OPENAI_API_KEY"] ?? "";

  if (groqKey) {
    const raw = await _llmChat(
      groqKey,
      "https://api.groq.com/openai/v1",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      messages,
    );
    if (raw) {
      extracted = _parseCrmFields(raw, blank);
      provider = "groq";
    }
  }

  if (provider === "deterministic" && openaiKey) {
    const raw = await _llmChat(
      openaiKey,
      "https://api.openai.com/v1",
      "gpt-4o-mini",
      messages,
    );
    if (raw) {
      extracted = _parseCrmFields(raw, blank);
      provider = "openai";
    }
  }

  await supabase
    .from("calls")
    .update({ extracted_data: extracted })
    .eq("id", job.call_id);

  return { provider };
}

// ── QA analysis ───────────────────────────────────────────────────────────────

async function runQaAnalysis(
  supabase: SupabaseClient,
  job: PostCallJob,
): Promise<Record<string, unknown>> {
  if (!job.call_id)
    throw Object.assign(new Error("call_id missing"), { code: "not_found" });

  // Idempotency: skip if an evaluation already exists for this call
  const { data: existing } = await supabase
    .from("qa_evaluations")
    .select("id, risk_score")
    .eq("call_id", job.call_id)
    .maybeSingle();

  if (existing) {
    const e = existing as { id: string; risk_score: number };
    return {
      evaluation_id: e.id,
      risk_score: e.risk_score,
      skipped: true,
      reason: "already_evaluated",
    };
  }

  const { data: callRow } = await supabase
    .from("calls")
    .select("transcript")
    .eq("id", job.call_id)
    .maybeSingle();

  const transcript =
    (callRow as { transcript: string | null } | null)?.transcript ?? "";
  if (!transcript.trim()) return { skipped: true, reason: "empty_transcript" };

  const result = await runPostCallQA(job.call_id, transcript, job.workspace_id);
  return {
    evaluation_id: result.evaluationId,
    risk_score: result.riskScore,
    violations_count: result.violationsCount,
  };
}

// ── Outbound webhook ──────────────────────────────────────────────────────────

async function runOutboundWebhook(
  supabase: SupabaseClient,
  job: PostCallJob,
): Promise<Record<string, unknown>> {
  const p = job.payload as {
    event?: string;
    webhook_url?: string;
    webhook_url_source?: string;
    include_costs?: boolean;
    include_analysis?: boolean;
  };

  const webhookUrl = p.webhook_url;
  if (!webhookUrl)
    throw Object.assign(new Error("webhook_url missing from payload"), {
      code: "400",
    });

  // Fetch call data for payload enrichment
  let callData: Record<string, unknown> = {};
  if (job.call_id) {
    const { data: row } = await supabase
      .from("calls")
      .select(
        "technical_status, business_outcome, duration_seconds, cost_usd, cost_status, cost_breakdown, extracted_data",
      )
      .eq("id", job.call_id)
      .maybeSingle();
    if (row) callData = row as Record<string, unknown>;
  }

  const eventId = crypto.randomUUID();
  const ts = Math.floor(Date.now() / 1000).toString();

  const webhookPayload = {
    event: p.event ?? "call.completed",
    event_id: eventId,
    timestamp: ts,
    workspace_id: job.workspace_id,
    call_id: job.call_id,
    room_name: job.room_name,
    technical_status: callData.technical_status ?? null,
    business_outcome: callData.business_outcome ?? null,
    duration_seconds: callData.duration_seconds ?? null,
    ...(p.include_costs
      ? {
          cost_usd: callData.cost_usd ?? null,
          cost_status: callData.cost_status ?? null,
          cost_breakdown: callData.cost_breakdown ?? null,
        }
      : {}),
    ...(p.include_analysis
      ? { analysis: callData.extracted_data ?? null }
      : {}),
  };

  const body = JSON.stringify(webhookPayload);
  const signingSecret = process.env["VOICEOS_WEBHOOK_SIGNING_SECRET"];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-VoiceOS-Event-Id": eventId,
    "X-VoiceOS-Timestamp": ts,
    "X-VoiceOS-Workspace-Id": job.workspace_id,
  };

  if (signingSecret) {
    headers["X-VoiceOS-Signature"] = `sha256=${crypto
      .createHmac("sha256", signingSecret)
      .update(`${ts}.${body}`)
      .digest("hex")}`;
  } else {
    headers["X-VoiceOS-Signature"] = "unsigned";
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const code = String(res.status);
    // 4xx (except 429) are permanent failures
    const isPermanent =
      res.status >= 400 && res.status < 500 && res.status !== 429;
    throw Object.assign(new Error(`Webhook HTTP ${res.status}`), {
      code: isPermanent ? code : "500",
    });
  }

  return {
    status_code: res.status,
    event_id: eventId,
    signed: !!signingSecret,
  };
}

// ── Integration dispatch ──────────────────────────────────────────────────────

async function runIntegrationDispatch(
  supabase: SupabaseClient,
  job: PostCallJob,
): Promise<Record<string, unknown>> {
  if (!job.call_id) return { skipped: true, reason: "no_call_id" };

  const { data: callRow } = await supabase
    .from("calls")
    .select("*")
    .eq("id", job.call_id)
    .maybeSingle();

  if (!callRow)
    throw Object.assign(new Error("call not found"), { code: "not_found" });

  const c = callRow as Record<string, unknown>;

  await dispatchPostCallEvents(job.workspace_id, {
    call_id: job.call_id,
    workspace_id: job.workspace_id,
    agent_id: (c["agent_id"] as string | null) ?? job.agent_id,
    contact_name: (c["contact_name"] as string | null) ?? null,
    contact_phone: (c["contact_phone"] as string | null) ?? null,
    direction: (c["direction"] as string) ?? "outbound",
    duration_seconds: (c["duration_seconds"] as number) ?? 0,
    disposition: (c["disposition"] as string | null) ?? null,
    summary: (c["summary"] as string | null) ?? null,
    sentiment: (c["sentiment"] as string | null) ?? null,
    transcript: (c["transcript"] as string | null) ?? null,
    extracted_data:
      (c["extracted_data"] as Record<string, unknown> | null) ?? null,
    extracted_name: (c["extracted_name"] as string | null) ?? null,
    extracted_email: (c["extracted_email"] as string | null) ?? null,
    extracted_interest: (c["extracted_interest"] as string | null) ?? null,
    extracted_objections: (c["extracted_objections"] as string | null) ?? null,
    created_at: (c["created_at"] as string) ?? new Date().toISOString(),
  });

  return { dispatched: true };
}

// ── Cost finalization ─────────────────────────────────────────────────────────

async function runCostFinalization(
  supabase: SupabaseClient,
  job: PostCallJob,
): Promise<Record<string, unknown>> {
  if (!job.call_id) return { skipped: true };

  const { data: row } = await supabase
    .from("calls")
    .select("cost_usd, cost_status")
    .eq("id", job.call_id)
    .maybeSingle();

  const r = row as {
    cost_usd: number | null;
    cost_status: string | null;
  } | null;
  // If already finalized by BillingTracker in the close handler, this is a no-op
  if (r?.cost_status === "final")
    return { skipped: true, reason: "already_final" };

  // Billing did not finalize this call (tracker may have failed or been absent).
  // Mark as needs_review so the ops team can investigate and correct manually.
  await supabase
    .from("calls")
    .update({ cost_status: "needs_review" })
    .eq("id", job.call_id);

  return {
    reconciled: true,
    was_status: r?.cost_status ?? null,
    cost_usd: r?.cost_usd ?? null,
  };
}

// ── Call summary ──────────────────────────────────────────────────────────────

async function runCallSummary(
  supabase: SupabaseClient,
  job: PostCallJob,
): Promise<Record<string, unknown>> {
  if (!job.call_id) return { skipped: true };

  const { data: row } = await supabase
    .from("calls")
    .select("summary, transcript")
    .eq("id", job.call_id)
    .maybeSingle();

  const r = row as { summary: string | null; transcript: string | null } | null;
  if (r?.summary) return { skipped: true, reason: "already_has_summary" };

  const transcript = r?.transcript ?? "";
  if (!transcript.trim()) return { skipped: true, reason: "empty_transcript" };

  // Derive a plain-text summary without LLM (first 3 lines of transcript)
  const lines = transcript.split("\n").filter(Boolean).slice(0, 5).join(" ");
  const summary = lines.length > 300 ? lines.slice(0, 300) + "…" : lines;

  await supabase.from("calls").update({ summary }).eq("id", job.call_id);
  return { summary_length: summary.length };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function processPostCallJob(
  supabase: SupabaseClient,
  job: PostCallJob,
): Promise<Record<string, unknown>> {
  const handlers: Record<
    PostCallJobType,
    (s: SupabaseClient, j: PostCallJob) => Promise<Record<string, unknown>>
  > = {
    crm_extraction: runCrmExtraction,
    qa_analysis: runQaAnalysis,
    outbound_webhook: runOutboundWebhook,
    integration_dispatch: runIntegrationDispatch,
    cost_finalization: runCostFinalization,
    call_summary: runCallSummary,
    transcript_postprocess: async () => ({
      skipped: true,
      reason: "not_implemented",
    }),
    cleanup: async () => ({ skipped: true, reason: "not_implemented" }),
  };

  const handler = handlers[job.job_type];
  if (!handler)
    throw Object.assign(new Error(`Unknown job type: ${job.job_type}`), {
      code: "400",
    });

  return handler(supabase, job);
}
