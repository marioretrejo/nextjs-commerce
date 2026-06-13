/**
 * QA Center — Enterprise Parallel Analysis Pipeline
 *
 * Runs 5 parallel Groq calls (compliance, sales, soft_skills, conversation,
 * summary+sentiment) then 1 sequential coaching call that synthesises all 5.
 *
 * Score weights: compliance 40 %, sales 25 %, soft_skills 20 %, conversation 15 %.
 * Risk level:  overall < 50 → critical | < 65 → high | < 80 → medium | else low.
 *
 * Accepts:
 *   - Authenticated requests (cookie session)
 *   - Internal requests (x-workspace-id + x-internal-secret headers)
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// ─── Diarized transcript type (mirrors webhooks/[token]/route.ts) ─────────────

interface DiarizedTranscript {
  provider: "deepgram";
  model: "nova-3";
  language: string;
  utterances: Array<{
    speaker: string;
    speaker_type: "unknown";
    text: string;
    start_ms: number;
    end_ms: number;
    confidence: number;
  }>;
}

// ─── Groq helper ──────────────────────────────────────────────────────────────

const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function groqJSON<T>(
  prompt: string,
  maxTokens = 1024,
  temperature = 0.1,
): Promise<T | null> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = data.choices[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clamp(n: unknown, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
}

// ─── Dimension types ──────────────────────────────────────────────────────────

interface ComplianceResult {
  violations: Array<{
    type:
      | "promise"
      | "misleading"
      | "unauthorized_claim"
      | "missing_disclosure"
      | "prohibited_word"
      | "risk_statement";
    severity: "low" | "medium" | "high" | "critical";
    speaker: "agent" | "customer" | "unknown" | null;
    timestamp_s: number | null;
    snippet: string;
    regulation: string | null;
    explanation: string;
    suggested_correction: string;
  }>;
  score: number; // 0-100 higher = better (few / no violations)
}

interface SalesResult {
  objection_handling: number;
  closing_ability: number;
  discovery_quality: number;
  overall: number;
  key_sales_moments: string[];
}

interface SoftSkillsResult {
  empathy: number;
  active_listening: number;
  professionalism: number;
  tone: "positive" | "neutral" | "negative";
  overall: number;
}

interface ConversationResult {
  engagement: number;
  flow: number;
  interruptions_count: number;
  dead_air_count: number;
  overall: number;
}

interface SummaryResult {
  summary: string;
  customer_intent: string;
  outcome: string;
  objections: string[];
  key_moments: string[];
  sentiment_timeline: Array<{
    at_percent: number;
    sentiment: "positive" | "neutral" | "negative";
    note: string;
  }>;
  overall_sentiment: "positive" | "neutral" | "negative";
}

interface CoachingResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommended_training: string[];
  coaching_plan: string;
  priority_score: number;
}

// ─── Formatted transcript builder ────────────────────────────────────────────

function buildFormattedTranscript(
  plainTranscript: string,
  diarized: DiarizedTranscript | null,
): string {
  if (!diarized || diarized.utterances.length === 0) return plainTranscript;
  return diarized.utterances
    .map((u) => `[Speaker ${u.speaker}]: ${u.text}`)
    .join("\n");
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildCompliancePrompt(transcript: string, rules: QACRule[]): string {
  const rulesSection =
    rules.length > 0
      ? rules
          .filter(
            (r) =>
              r.category === "compliance" ||
              r.category === "disclosure" ||
              r.category === "prohibited",
          )
          .map(
            (r, i) =>
              `${i + 1}. [${r.severity.toUpperCase()}] "${r.name}"${r.regulation ? ` — ${r.regulation}` : ""}: ${r.description}`,
          )
          .join("\n") || "Apply universal call-center compliance standards."
      : "Apply universal call-center compliance standards (FDCPA, TCPA, GDPR, FTC, HIPAA as relevant).";

  return `You are a compliance expert auditor for a call center. Analyze the transcript for regulatory violations.

COMPLIANCE RULES:
${rulesSection}

TRANSCRIPT:
${transcript.slice(0, 10000)}

Return ONLY a JSON object with EXACTLY these fields:
{
  "violations": [
    {
      "type": one of "promise"|"misleading"|"unauthorized_claim"|"missing_disclosure"|"prohibited_word"|"risk_statement",
      "severity": one of "low"|"medium"|"high"|"critical",
      "speaker": one of "agent"|"customer"|"unknown" (who made this statement — infer from context),
      "timestamp_s": integer seconds into the call (null if unknown),
      "snippet": exact quote ≤60 words from the transcript,
      "regulation": regulation reference string (e.g. "FDCPA §807(11)") or null,
      "explanation": one sentence explaining why this is a violation,
      "suggested_correction": one sentence concrete corrective action
    }
  ],
  "score": integer 0-100 where 100 = fully compliant (no violations), deduct points for each violation weighted by severity
}

If no violations found, return {"violations": [], "score": 100}.
Be precise — each violation must be evidenced by the transcript.
Respond with ONLY raw JSON.`;
}

function buildSalesPrompt(transcript: string): string {
  return `You are a sales effectiveness coach evaluating a call center agent's sales performance.

TRANSCRIPT:
${transcript.slice(0, 10000)}

Return ONLY a JSON object with EXACTLY these fields:
{
  "objection_handling": integer 0-100 (how well the agent handled customer objections and pushback),
  "closing_ability": integer 0-100 (effectiveness of closing attempts and securing commitment),
  "discovery_quality": integer 0-100 (quality of needs assessment and discovery questions),
  "overall": integer 0-100 (weighted average of all sales dimensions),
  "key_sales_moments": array of strings (up to 5 notable moments — positive or negative — that impacted sales outcome)
}

Score 0 if the dimension is not applicable to this interaction type.
Respond with ONLY raw JSON.`;
}

function buildSoftSkillsPrompt(transcript: string): string {
  return `You are an expert evaluator of agent soft skills and communication quality.

TRANSCRIPT:
${transcript.slice(0, 10000)}

Return ONLY a JSON object with EXACTLY these fields:
{
  "empathy": integer 0-100 (agent's ability to acknowledge and validate customer emotions),
  "active_listening": integer 0-100 (evidence of listening: paraphrasing, confirming, not interrupting),
  "professionalism": integer 0-100 (language, composure, appropriate boundaries throughout),
  "tone": one of "positive"|"neutral"|"negative" (agent's dominant tone throughout the call),
  "overall": integer 0-100 (weighted average of soft skill dimensions)
}

Respond with ONLY raw JSON.`;
}

function buildConversationPrompt(transcript: string): string {
  return `You are an expert at analyzing call structure and conversational dynamics.

TRANSCRIPT:
${transcript.slice(0, 10000)}

Return ONLY a JSON object with EXACTLY these fields:
{
  "engagement": integer 0-100 (how engaged and attentive the agent was throughout),
  "flow": integer 0-100 (how naturally and logically the conversation progressed),
  "interruptions_count": integer (number of times the agent interrupted the customer),
  "dead_air_count": integer (number of notable silence/dead air moments),
  "overall": integer 0-100 (weighted average of conversation quality dimensions)
}

Respond with ONLY raw JSON.`;
}

function buildSummaryPrompt(transcript: string): string {
  return `You are an expert call analyst. Provide a structured summary of this call center interaction.

TRANSCRIPT:
${transcript.slice(0, 10000)}

Return ONLY a JSON object with EXACTLY these fields:
{
  "summary": string (2-3 sentences describing what happened in this call),
  "customer_intent": string (what the customer was trying to accomplish),
  "outcome": string (how the call ended — resolved|escalated|abandoned|sold|declined|scheduled|other),
  "objections": array of strings (customer objections or concerns raised, up to 10),
  "key_moments": array of strings (up to 8 pivotal moments that changed the call trajectory),
  "sentiment_timeline": array of {
    "at_percent": integer 0-100 (% through the call when this sentiment shift occurred),
    "sentiment": one of "positive"|"neutral"|"negative",
    "note": string (brief description of what caused this sentiment state)
  },
  "overall_sentiment": one of "positive"|"neutral"|"negative" (customer's dominant sentiment)
}

Respond with ONLY raw JSON.`;
}

function buildCoachingPrompt(
  transcript: string,
  compliance: ComplianceResult,
  sales: SalesResult,
  softSkills: SoftSkillsResult,
  conversation: ConversationResult,
  summary: SummaryResult,
  overallScore: number,
): string {
  return `You are a senior call center coach synthesizing analysis results into an actionable coaching report.

INTERACTION SUMMARY:
${summary.summary}
Customer intent: ${summary.customer_intent}
Outcome: ${summary.outcome}
Overall score: ${overallScore}/100

DIMENSION SCORES:
- Compliance: ${compliance.score}/100 (${compliance.violations.length} violation(s))
- Sales: ${sales.overall}/100
- Soft Skills: ${softSkills.overall}/100
- Conversation: ${conversation.overall}/100

TOP COMPLIANCE VIOLATIONS:
${
  compliance.violations
    .slice(0, 3)
    .map((v) => `- [${v.severity}] ${v.type}: ${v.explanation}`)
    .join("\n") || "None"
}

KEY SALES MOMENTS:
${sales.key_sales_moments.slice(0, 3).join("\n") || "None identified"}

SOFT SKILL OBSERVATIONS:
- Empathy: ${softSkills.empathy}/100, Active Listening: ${softSkills.active_listening}/100, Professionalism: ${softSkills.professionalism}/100
- Tone: ${softSkills.tone}

CONVERSATION DYNAMICS:
- Interruptions: ${conversation.interruptions_count}, Dead air: ${conversation.dead_air_count}, Engagement: ${conversation.engagement}/100

TRANSCRIPT EXCERPT:
${transcript.slice(0, 4000)}

Based on all evidence above, return ONLY a JSON object with EXACTLY these fields:
{
  "strengths": array of strings (3-5 specific things the agent did well, grounded in evidence),
  "weaknesses": array of strings (3-5 specific areas needing improvement, grounded in evidence),
  "opportunities": array of strings (2-4 concrete opportunities the agent missed that could have improved the outcome),
  "recommended_training": array of strings (2-5 specific training modules or skills to develop, e.g. "FDCPA compliance refresher", "Objection handling — price pushback"),
  "coaching_plan": string (3-5 sentences: a concrete, prioritized coaching action plan for the agent's manager),
  "priority_score": integer 0-100 (urgency of coaching needed — 100 = immediate action required, 0 = no coaching needed)
}

Respond with ONLY raw JSON.`;
}

// ─── Rule type ────────────────────────────────────────────────────────────────

interface QACRule {
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string | null;
}

// ─── Defaults (used when a parallel call fails) ───────────────────────────────

const defaultCompliance = (): ComplianceResult => ({
  violations: [],
  score: 70,
});
const defaultSales = (): SalesResult => ({
  objection_handling: 70,
  closing_ability: 70,
  discovery_quality: 70,
  overall: 70,
  key_sales_moments: [],
});
const defaultSoftSkills = (): SoftSkillsResult => ({
  empathy: 70,
  active_listening: 70,
  professionalism: 70,
  tone: "neutral",
  overall: 70,
});
const defaultConversation = (): ConversationResult => ({
  engagement: 70,
  flow: 70,
  interruptions_count: 0,
  dead_air_count: 0,
  overall: 70,
});
const defaultSummary = (): SummaryResult => ({
  summary: "Analysis unavailable.",
  customer_intent: "Unknown",
  outcome: "other",
  objections: [],
  key_moments: [],
  sentiment_timeline: [],
  overall_sentiment: "neutral",
});
const defaultCoaching = (): CoachingResult => ({
  strengths: [],
  weaknesses: [],
  opportunities: [],
  recommended_training: [],
  coaching_plan: "Coaching unavailable.",
  priority_score: 0,
});

// ─── Score calculation ────────────────────────────────────────────────────────

function calcOverallScore(
  c: number,
  s: number,
  sk: number,
  cv: number,
): number {
  return Math.round(c * 0.4 + s * 0.25 + sk * 0.2 + cv * 0.15);
}

function calcRiskLevel(
  overall: number,
): "critical" | "high" | "medium" | "low" {
  if (overall < 50) return "critical";
  if (overall < 65) return "high";
  if (overall < 80) return "medium";
  return "low";
}

// ─── Workspace resolver ───────────────────────────────────────────────────────

async function resolveWorkspaceId(
  req: Request,
): Promise<{ workspaceId: string; userId: string | null } | null> {
  // Internal request path (webhooks, background jobs)
  const internalSecret = req.headers.get("x-internal-secret");
  const headerWsId = req.headers.get("x-workspace-id");

  if (internalSecret !== null && headerWsId) {
    const configuredSecret = process.env["INTERNAL_API_SECRET"];

    // Fail closed: if the secret is not configured or too short, deny all internal requests.
    // This prevents vacuous equality (empty === empty) and forces proper configuration.
    if (!configuredSecret || configuredSecret.trim().length < 16) {
      console.error(
        "[qac/analyze] INTERNAL_API_SECRET is not configured or too short — internal auth disabled",
      );
      return null;
    }

    // Reject empty/missing bearer tokens without leaking timing information
    if (!internalSecret || internalSecret.length === 0) {
      console.warn("[qac/analyze] Internal request with empty secret rejected");
      return null;
    }

    // Timing-safe comparison prevents secret enumeration via response-time analysis
    const { timingSafeEqual } = await import("node:crypto");
    const configBuf = Buffer.from(configuredSecret, "utf8");
    const providedBuf = Buffer.from(internalSecret, "utf8");

    // Length mismatch is fine to reveal (constant-time comparison is meaningless here)
    if (
      configBuf.length !== providedBuf.length ||
      !timingSafeEqual(configBuf, providedBuf)
    ) {
      console.warn("[qac/analyze] Invalid internal secret — access denied");
      return null;
    }

    return { workspaceId: headerWsId, userId: null };
  }

  // Authenticated user path
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    const { data } = await admin
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!data) return null;
    const ws = data as { id: string };
    return { workspaceId: ws.id, userId: user.id };
  } catch {
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await resolveWorkspaceId(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { workspaceId, userId } = auth;

  const admin = createAdminClient();

  // ── Verify interaction belongs to this workspace ───────────────────────────
  const { data: intRaw } = await admin
    .from("qac_interactions")
    .select("id, workspace_id, transcript, diarized_transcript, status, agent_id, agent_name")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  type InteractionRow = {
    id: string;
    workspace_id: string;
    transcript: string;
    diarized_transcript: unknown;
    status: string;
    agent_id: string | null;
    agent_name: string;
  };
  const interaction = intRaw as InteractionRow | null;

  if (!interaction) {
    return NextResponse.json(
      { error: "Interaction not found" },
      { status: 404 },
    );
  }
  // ── Atomic lock: only succeed if status is NOT already 'analyzing' ─────────
  const { data: lockData } = await admin
    .from("qac_interactions")
    .update({ status: "analyzing" })
    .eq("id", id)
    .neq("status", "analyzing")
    .select("id")
    .maybeSingle();

  if (!lockData) {
    return NextResponse.json(
      { error: "Analysis already in progress" },
      { status: 409 },
    );
  }

  // Write audit log entry (fire-and-forget)
  void (async () => {
    const { error: auditErr } = await admin.from("qac_audit_logs").insert({
      workspace_id: workspaceId,
      user_id: userId ?? null,
      action: "analyze",
      entity_type: "interaction",
      entity_id: id,
      details: { triggered_by: userId ? "user" : "internal" },
    });
    if (auditErr)
      console.error("[qac-analyze] Audit log insert failed:", auditErr.message);
  })();

  // ── Fetch active QA rules for this workspace ───────────────────────────────
  const { data: rulesData } = await admin
    .from("qac_rules")
    .select("name, description, category, severity, regulation")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  const rules = (rulesData ?? []) as QACRule[];
  const transcript = interaction.transcript;
  const diarized = interaction.diarized_transcript as DiarizedTranscript | null;
  const formattedTranscript = buildFormattedTranscript(transcript, diarized);

  // ── 5 parallel Groq calls ─────────────────────────────────────────────────
  const [complianceRaw, salesRaw, softSkillsRaw, conversationRaw, summaryRaw] =
    await Promise.all([
      groqJSON<ComplianceResult>(
        buildCompliancePrompt(formattedTranscript, rules),
        1500,
      ),
      groqJSON<SalesResult>(buildSalesPrompt(formattedTranscript), 1024),
      groqJSON<SoftSkillsResult>(buildSoftSkillsPrompt(formattedTranscript), 800),
      groqJSON<ConversationResult>(buildConversationPrompt(formattedTranscript), 800),
      groqJSON<SummaryResult>(buildSummaryPrompt(formattedTranscript), 1500),
    ]);

  // Apply defaults for any failed calls
  const compliance: ComplianceResult = complianceRaw ?? defaultCompliance();
  const sales: SalesResult = salesRaw ?? defaultSales();
  const softSkills: SoftSkillsResult = softSkillsRaw ?? defaultSoftSkills();
  const conversation: ConversationResult =
    conversationRaw ?? defaultConversation();
  const summary: SummaryResult = summaryRaw ?? defaultSummary();

  // Sanitize all numeric scores
  compliance.score = clamp(compliance.score);
  sales.overall = clamp(sales.overall);
  sales.objection_handling = clamp(sales.objection_handling);
  sales.closing_ability = clamp(sales.closing_ability);
  sales.discovery_quality = clamp(sales.discovery_quality);
  softSkills.overall = clamp(softSkills.overall);
  softSkills.empathy = clamp(softSkills.empathy);
  softSkills.active_listening = clamp(softSkills.active_listening);
  softSkills.professionalism = clamp(softSkills.professionalism);
  conversation.overall = clamp(conversation.overall);
  conversation.engagement = clamp(conversation.engagement);
  conversation.flow = clamp(conversation.flow);
  conversation.interruptions_count = Math.max(
    0,
    Math.round(Number(conversation.interruptions_count) || 0),
  );
  conversation.dead_air_count = Math.max(
    0,
    Math.round(Number(conversation.dead_air_count) || 0),
  );

  if (!Array.isArray(compliance.violations)) compliance.violations = [];
  if (!Array.isArray(sales.key_sales_moments)) sales.key_sales_moments = [];
  if (!["positive", "neutral", "negative"].includes(softSkills.tone))
    softSkills.tone = "neutral";
  if (!Array.isArray(summary.objections)) summary.objections = [];
  if (!Array.isArray(summary.key_moments)) summary.key_moments = [];
  if (!Array.isArray(summary.sentiment_timeline))
    summary.sentiment_timeline = [];
  if (!["positive", "neutral", "negative"].includes(summary.overall_sentiment))
    summary.overall_sentiment = "neutral";

  const overallScore = calcOverallScore(
    compliance.score,
    sales.overall,
    softSkills.overall,
    conversation.overall,
  );
  const riskLevel = calcRiskLevel(overallScore);

  // ── Sequential coaching call (uses all 5 results) ─────────────────────────
  const coachingRaw = await groqJSON<CoachingResult>(
    buildCoachingPrompt(
      formattedTranscript,
      compliance,
      sales,
      softSkills,
      conversation,
      summary,
      overallScore,
    ),
    1500,
  );
  const coaching: CoachingResult = coachingRaw ?? defaultCoaching();

  if (!Array.isArray(coaching.strengths)) coaching.strengths = [];
  if (!Array.isArray(coaching.weaknesses)) coaching.weaknesses = [];
  if (!Array.isArray(coaching.opportunities)) coaching.opportunities = [];
  if (!Array.isArray(coaching.recommended_training))
    coaching.recommended_training = [];
  coaching.priority_score = clamp(coaching.priority_score);

  // ── Persist evaluation ────────────────────────────────────────────────────
  // Build legacy criteria_scores for backward compat with existing queries
  const criteriaScores = {
    opening: Math.round(
      (conversation.engagement + softSkills.professionalism) / 2,
    ),
    compliance: compliance.score,
    objection_handling: sales.objection_handling,
    closing: sales.closing_ability,
    empathy: softSkills.empathy,
  };

  const { data: evalData, error: evalErr } = await admin
    .from("qac_evaluations")
    .insert({
      workspace_id: workspaceId,
      interaction_id: id,
      overall_score: overallScore,
      risk_score: 100 - overallScore, // inverse: higher risk_score = worse
      tone:
        softSkills.tone === "positive"
          ? "friendly"
          : softSkills.tone === "negative"
            ? "unprofessional"
            : "neutral",
      summary: summary.summary,
      criteria_scores: criteriaScores,
      rules_applied: rules.length,
      // new enterprise columns
      compliance_score: compliance.score,
      sales_score: sales.overall,
      soft_skills_score: softSkills.overall,
      conversation_score: conversation.overall,
      coaching_summary: coaching.coaching_plan,
      strengths: coaching.strengths,
      weaknesses: coaching.weaknesses,
      opportunities: coaching.opportunities,
      recommended_training: coaching.recommended_training,
      sentiment_timeline: summary.sentiment_timeline,
      key_moments: summary.key_moments,
      customer_intent: summary.customer_intent,
      call_outcome: summary.outcome,
      objections: summary.objections,
    })
    .select("id")
    .single();

  if (evalErr || !evalData) {
    await admin
      .from("qac_interactions")
      .update({ status: "failed" })
      .eq("id", id);
    return NextResponse.json(
      { error: "Failed to save evaluation" },
      { status: 500 },
    );
  }

  const evalId = (evalData as { id: string }).id;

  // ── Save compliance flags ─────────────────────────────────────────────────
  const VALID_VIOLATION_TYPES = new Set([
    "promise",
    "misleading",
    "unauthorized_claim",
    "missing_disclosure",
    "prohibited_word",
    "risk_statement",
  ]);
  const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
  const VALID_SPEAKERS = new Set(["agent", "customer", "unknown"]);

  if (compliance.violations.length > 0) {
    const { error: flagErr } = await admin.from("qac_flags").insert(
      compliance.violations.map((v) => ({
        evaluation_id: evalId,
        workspace_id: workspaceId,
        category: "compliance" as const,
        severity: VALID_SEVERITIES.has(v.severity) ? v.severity : "medium",
        speaker: VALID_SPEAKERS.has(v.speaker ?? "") ? v.speaker : null,
        label: v.explanation?.slice(0, 120) ?? "Compliance violation",
        transcript_fragment: v.snippet?.slice(0, 500) ?? null,
        regulation: v.regulation ?? null,
        coaching_note: v.suggested_correction ?? null,
        timestamp_s: v.timestamp_s ?? null,
        violation_type: VALID_VIOLATION_TYPES.has(v.type) ? v.type : null,
        suggested_correction: v.suggested_correction ?? null,
      })),
    );
    if (flagErr)
      console.error("[qac-analyze] Flag insert failed:", flagErr.message);
  }

  // ── Update interaction status + risk_level + overall_sentiment ────────────
  const { error: statusErr } = await admin
    .from("qac_interactions")
    .update({
      status: "analyzed",
      risk_level: riskLevel,
      overall_sentiment: summary.overall_sentiment,
      outcome: summary.outcome,
    })
    .eq("id", id);
  if (statusErr)
    console.error("[qac-analyze] Status update failed:", statusErr.message);

  // ── Save coaching report ──────────────────────────────────────────────────
  const { error: coachErr } = await admin.from("qac_coaching_reports").insert({
    workspace_id: workspaceId,
    interaction_id: id,
    agent_id: interaction.agent_id ?? null,
    strengths: coaching.strengths,
    weaknesses: coaching.weaknesses,
    opportunities: coaching.opportunities,
    recommended_training: coaching.recommended_training,
    coaching_plan: coaching.coaching_plan,
    priority_score: coaching.priority_score,
  });
  if (coachErr)
    console.error(
      "[qac-analyze] Coaching report insert failed:",
      coachErr.message,
    );

  return NextResponse.json({
    ok: true,
    evaluation_id: evalId,
    overall_score: overallScore,
    risk_level: riskLevel,
    compliance_score: compliance.score,
    sales_score: sales.overall,
    soft_skills_score: softSkills.overall,
    conversation_score: conversation.overall,
    violations: compliance.violations.length,
    sentiment: summary.overall_sentiment,
    coaching_priority: coaching.priority_score,
  });
}
