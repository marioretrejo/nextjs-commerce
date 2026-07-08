/**
 * POST /api/jobs/analyze-call
 *
 * Asynchronous post-call intelligence job. Two entry points:
 *   · { room_name }  — native LiveKit calls (worker writes the transcript first)
 *   · { call_id }    — imported external calls (transcribe here if needed)
 *
 * Extracts summary/disposition/structured data via Groq, scores QA against the
 * agent's criteria (or system prompt), persists to `calls`, tracks
 * analysis_status (processing → analyzed | error), and fires post-call
 * integration events.
 *
 * Security: protected by INTERNAL_API_SECRET header.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPostCallEvents } from "@/lib/integrations/dispatcher";
import { scoreCallQuality, type QACriterion } from "@/lib/call-analysis";
import { NextResponse } from "next/server";
import { runGroqAnalysis } from "./_lib/analysis";
import { transcribeFromRecording } from "./_lib/transcribe";

interface CallRow {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  direction: string;
  duration_seconds: number;
  transcript: string | null;
  recording_url: string | null;
  recording_storage_path: string | null;
  created_at: string;
}

interface AgentRow {
  system_prompt: string | null;
}

const CALL_SELECT =
  "id, workspace_id, agent_id, contact_name, contact_phone, direction, duration_seconds, transcript, recording_url, recording_storage_path, created_at";

function setStatus(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  status: "processing" | "analyzed" | "error",
  error: string | null = null,
) {
  return admin
    .from("calls")
    .update({ analysis_status: status, analysis_error: error })
    .eq("id", id)
    .then(({ error: e }) => {
      if (e) console.warn("[analyze-call] status update failed:", e.message);
    });
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env["INTERNAL_API_SECRET"]) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { room_name, call_id } = (await req.json()) as {
    room_name?: string;
    call_id?: string;
  };
  if (!room_name && !call_id) {
    return NextResponse.json(
      { error: "room_name or call_id required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // ── Resolve the call ────────────────────────────────────────────────────────
  let callRecord: CallRow | null = null;
  if (call_id) {
    const { data } = await admin
      .from("calls")
      .select(CALL_SELECT)
      .eq("id", call_id)
      .single();
    callRecord = data as unknown as CallRow | null;
  } else {
    // Native path: the worker may still be writing the transcript when we fire.
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
      const { data } = await admin
        .from("calls")
        .select(CALL_SELECT)
        .eq("retell_call_id", room_name)
        .single();
      const row = data as unknown as CallRow | null;
      callRecord = row;
      if (row?.transcript) break;
    }
  }

  if (!callRecord) {
    return NextResponse.json(
      { error: "Call record not found" },
      { status: 404 },
    );
  }

  await setStatus(admin, callRecord.id, "processing");

  // ── Ensure a transcript (transcribe imported/native audio if missing) ──────
  let transcript = callRecord.transcript;
  if (!transcript || transcript.length < 50) {
    const fresh = await transcribeFromRecording(admin, callRecord);
    if (fresh && fresh.trim().length >= 20) {
      transcript = fresh.trim();
      await admin.from("calls").update({ transcript }).eq("id", callRecord.id);
    }
  }

  if (!transcript || transcript.length < 50) {
    await setStatus(admin, callRecord.id, "error", "Transcript unavailable");
    return NextResponse.json({
      skipped: true,
      reason: "Transcript too short for analysis",
    });
  }

  // ── Analysis + QA scoring inputs ────────────────────────────────────────────
  const [analysis, agentData, criteriaRows] = await Promise.all([
    runGroqAnalysis(transcript),
    callRecord.agent_id
      ? admin
          .from("agents")
          .select("system_prompt")
          .eq("id", callRecord.agent_id)
          .single()
          .then((r) => r.data as unknown as AgentRow | null)
      : Promise.resolve(null),
    callRecord.agent_id
      ? admin
          .from("qa_criteria")
          .select("name, description, weight")
          .eq("agent_id", callRecord.agent_id)
          .order("created_at")
          .then((r) => (r.data as QACriterion[] | null) ?? [])
      : Promise.resolve([]),
  ]);

  if (!analysis) {
    await setStatus(admin, callRecord.id, "error", "Groq analysis unavailable");
    return NextResponse.json(
      { error: "Analysis failed — Groq unavailable" },
      { status: 502 },
    );
  }

  const summaryText = Array.isArray(analysis.summary)
    ? analysis.summary.join("\n• ").replace(/^/, "• ")
    : String(analysis.summary ?? "");

  // Step 1: core fields (migration 001)
  const { error } = await admin
    .from("calls")
    .update({
      summary: summaryText,
      sentiment: analysis.sentiment ?? null,
      extracted_name: analysis.extracted_name ?? null,
      extracted_email: analysis.extracted_email ?? null,
      extracted_interest: analysis.extracted_interest ?? null,
      extracted_objections: analysis.extracted_objections ?? null,
      task_completed:
        analysis.disposition === "meeting_booked" ||
        analysis.sentiment === "positive",
    })
    .eq("id", callRecord.id);

  if (error) {
    await setStatus(admin, callRecord.id, "error", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Step 2: extended columns (later migrations)
  await admin
    .from("calls")
    .update({
      disposition: analysis.disposition ?? "other",
      tokens_used: analysis._tokensUsed ?? null,
      extracted_data: analysis.extracted_data ?? null,
    })
    .eq("id", callRecord.id)
    .then(({ error: e }) => {
      if (e) console.warn("[analyze-call] extended update failed:", e.message);
    });

  // Step 3: QA scoring — criteria (preferred) or system prompt, with breakdown
  const systemPrompt = agentData?.system_prompt ?? null;
  const criteria = criteriaRows as QACriterion[];
  if (criteria.length > 0 || (systemPrompt && systemPrompt.length > 20)) {
    const qa = await scoreCallQuality(transcript, { systemPrompt, criteria });
    if (qa) {
      await admin
        .from("calls")
        .update({
          qa_score: qa.score,
          qa_feedback: qa.feedback || null,
          qa_details: {
            overall: qa.score,
            feedback: qa.feedback,
            scores: qa.breakdown,
            criteria_count: criteria.length,
          },
        })
        .eq("id", callRecord.id)
        .then(({ error: e }) => {
          if (e) console.warn("[analyze-call] qa update failed:", e.message);
        });
    }
  }

  await setStatus(admin, callRecord.id, "analyzed");

  // Step 4: post-call integration dispatch (non-blocking)
  dispatchPostCallEvents(callRecord.workspace_id, {
    call_id: callRecord.id,
    workspace_id: callRecord.workspace_id,
    agent_id: callRecord.agent_id,
    contact_name: callRecord.contact_name,
    contact_phone: callRecord.contact_phone,
    direction: callRecord.direction,
    duration_seconds: callRecord.duration_seconds,
    disposition: analysis.disposition,
    summary: summaryText,
    sentiment: analysis.sentiment,
    transcript,
    extracted_data: analysis.extracted_data ?? null,
    extracted_name: analysis.extracted_name ?? null,
    extracted_email: analysis.extracted_email ?? null,
    extracted_interest: analysis.extracted_interest ?? null,
    extracted_objections: analysis.extracted_objections ?? null,
    created_at: callRecord.created_at,
  }).catch(() => null);

  return NextResponse.json({
    analyzed: true,
    call_id: callRecord.id,
    sentiment: analysis.sentiment,
    disposition: analysis.disposition,
    intent: analysis.intent,
  });
}
