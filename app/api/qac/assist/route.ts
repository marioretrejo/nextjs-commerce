/**
 * QA Center — Real-Time Agent Assist
 *
 * Analyzes a live transcript chunk and returns instant guidance:
 * alerts, suggested response, next best action, compliance risk, sentiment.
 *
 * Designed to be called from the agent's browser during a live call.
 * No session cookie authentication — callers pass a workspace token in the
 * Authorization header or body. Rate limiting should be enforced at the
 * edge/CDN layer (e.g. Vercel Edge Middleware or Cloudflare).
 *
 * Target latency: < 500 ms (kept minimal: single fast Groq call, short prompt).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// ─── Groq config ──────────────────────────────────────────────────────────────

const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssistRequest {
  transcript_chunk: string;
  full_transcript_so_far?: string;
  call_id?: string;
}

interface AssistAlert {
  type: "warning" | "danger" | "info" | "opportunity";
  message: string;
  action?: string;
}

interface AssistResponse {
  alerts: AssistAlert[];
  suggested_response?: string;
  next_best_action?: string;
  compliance_risk: "none" | "low" | "medium" | "high";
  sentiment: "positive" | "neutral" | "negative";
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const SAFE_DEFAULT: AssistResponse = {
  alerts: [],
  compliance_risk: "none",
  sentiment: "neutral",
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildAssistPrompt(chunk: string, context: string): string {
  const contextSection = context.trim()
    ? `PRIOR TRANSCRIPT (last 500 chars for context):\n${context.slice(-500)}\n\n`
    : "";

  return `You are a real-time call center compliance and quality coach monitoring a live agent call.
Respond ONLY with actionable JSON. Be fast and concise.

${contextSection}LATEST TRANSCRIPT CHUNK (just spoken):
${chunk.slice(0, 800)}

Analyze the latest chunk in context and return ONLY this JSON:
{
  "alerts": array (0-3 items max) of {
    "type": one of "warning"|"danger"|"info"|"opportunity",
    "message": string ≤15 words — direct, specific, actionable,
    "action": optional string ≤12 words — what agent should do RIGHT NOW
  },
  "suggested_response": optional string ≤25 words — exact words agent can say next (only if helpful),
  "next_best_action": optional string ≤15 words — strategic next step for the agent,
  "compliance_risk": one of "none"|"low"|"medium"|"high" based on what was just said,
  "sentiment": one of "positive"|"neutral"|"negative" — customer's current mood
}

Rules:
- "danger" alerts: regulatory violations, prohibited phrases, aggressive tone, unauthorized promises
- "warning" alerts: missing required disclosures, weak objection handling, compliance grey areas
- "opportunity" alerts: upsell/close openings, positive customer signals worth acting on
- "info" alerts: general quality coaching (over-talking, ask open-ended questions, etc.)
- Only generate alerts for clear, immediate issues — do not over-alert
- If nothing noteworthy: return {"alerts":[],"compliance_risk":"none","sentiment":"neutral"}
Respond with ONLY raw JSON.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: AssistRequest;
  try {
    body = (await req.json()) as AssistRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { transcript_chunk, full_transcript_so_far = "", call_id } = body;

  if (!transcript_chunk?.trim()) {
    return NextResponse.json(
      { error: "transcript_chunk is required" },
      { status: 400 },
    );
  }

  // ── Optional workspace token validation ───────────────────────────────────
  // The client passes Authorization: Bearer <workspace_token> where the token
  // is the webhook_token from qac_integrations. This is a lightweight check to
  // prevent unauthenticated open use, not a full auth system.
  const authHeader = req.headers.get("authorization") ?? "";
  const workspaceToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (workspaceToken) {
    try {
      const admin = createAdminClient();
      const { data: integration } = await admin
        .from("qac_integrations")
        .select("workspace_id, is_active")
        .eq("webhook_token", workspaceToken)
        .single();

      if (!integration || !(integration as { is_active: boolean }).is_active) {
        return NextResponse.json(
          { error: "Invalid or inactive workspace token" },
          { status: 401 },
        );
      }
    } catch {
      // If admin client fails (e.g. missing env), fall through — don't block the agent
    }
  }

  // ── Groq call ─────────────────────────────────────────────────────────────
  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) {
    // Return safe default rather than failing the agent mid-call
    return NextResponse.json(SAFE_DEFAULT);
  }

  const prompt = buildAssistPrompt(
    transcript_chunk.trim(),
    full_transcript_so_far,
  );

  let result: AssistResponse;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
      // Hard timeout for real-time use case — if Groq is slow, return safe default
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) {
      return NextResponse.json(SAFE_DEFAULT);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as AssistResponse;

    // ── Sanitize / validate output ─────────────────────────────────────────
    const VALID_ALERT_TYPES = new Set([
      "warning",
      "danger",
      "info",
      "opportunity",
    ]);
    const VALID_RISK_LEVELS = new Set(["none", "low", "medium", "high"]);
    const VALID_SENTIMENTS = new Set(["positive", "neutral", "negative"]);

    result = {
      alerts: (Array.isArray(parsed.alerts) ? parsed.alerts : [])
        .slice(0, 3)
        .filter((a): a is AssistAlert => typeof a?.message === "string")
        .map((a) => ({
          type: VALID_ALERT_TYPES.has(a.type) ? a.type : "info",
          message: String(a.message).slice(0, 120),
          ...(a.action ? { action: String(a.action).slice(0, 100) } : {}),
        })),
      ...(parsed.suggested_response
        ? {
            suggested_response: String(parsed.suggested_response).slice(0, 200),
          }
        : {}),
      ...(parsed.next_best_action
        ? { next_best_action: String(parsed.next_best_action).slice(0, 150) }
        : {}),
      compliance_risk: VALID_RISK_LEVELS.has(parsed.compliance_risk)
        ? parsed.compliance_risk
        : "none",
      sentiment: VALID_SENTIMENTS.has(parsed.sentiment)
        ? parsed.sentiment
        : "neutral",
    };
  } catch {
    // AbortError (timeout) or parse error — return safe default to avoid blocking agent
    result = SAFE_DEFAULT;
  }

  // Surface call_id in response for client-side correlation (do not persist here
  // to avoid adding latency; the full analyze endpoint handles persistence).
  return NextResponse.json({
    ...result,
    ...(call_id ? { call_id } : {}),
  });
}
