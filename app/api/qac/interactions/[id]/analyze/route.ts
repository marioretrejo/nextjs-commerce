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
 *
 * Groq helper + prompts + result types + defaults + persistence + the post-
 * response journey/commitments work all live in co-located _lib modules.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, after } from "next/server";
import { sendComplianceCriticalAlert } from "@/lib/notifications/telegram";
import { groqJSON, clamp } from "./_lib/groq";
import { resolveWorkspaceId } from "./_lib/auth";
import {
  buildFormattedTranscript,
  buildCompliancePrompt,
  buildSalesPrompt,
  buildSoftSkillsPrompt,
  buildConversationPrompt,
  buildSummaryPrompt,
  buildCoachingPrompt,
  buildViolationsPrompt,
} from "./_lib/prompts";
import {
  defaultCompliance,
  defaultSales,
  defaultSoftSkills,
  defaultConversation,
  defaultSummary,
  defaultCoaching,
  calcOverallScore,
  calcRiskLevel,
} from "./_lib/defaults";
import { persistAnalysis } from "./_lib/persist";
import { loadAnalysisContext } from "./_lib/context";
import { runCommitmentsAndJourney } from "./_lib/post-analysis";
import type {
  DiarizedTranscript,
  ComplianceResult,
  SalesResult,
  SoftSkillsResult,
  ConversationResult,
  SummaryResult,
  CoachingResult,
  ViolationResult,
  InteractionRow,
} from "./_lib/types";

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
    .select(
      "id, workspace_id, transcript, diarized_transcript, status, agent_id, agent_name, customer_id, department_id",
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  const interaction = intRaw as InteractionRow | null;

  if (!interaction) {
    return NextResponse.json(
      { error: "Interaction not found" },
      { status: 404 },
    );
  }
  // ── Atomic lock: only succeed if status is NOT already 'analyzing' ─────────
  const { data: lockData, error: lockErr } = await admin
    .from("qac_interactions")
    .update({ status: "analyzing" })
    .eq("id", id)
    .neq("status", "analyzing")
    .select("id")
    .maybeSingle();

  if (lockErr) {
    console.error(
      "[qac-analyze] Failed to acquire analysis lock:",
      lockErr.message,
    );
    return NextResponse.json(
      { error: "Failed to acquire analysis lock" },
      { status: 500 },
    );
  }
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

  // ── Load QA rules, scoped violation rules, and department profile ──────────
  const {
    rules,
    globalViolationRules,
    deptViolationRules,
    deptContext,
    deptRubric,
    deptName,
  } = await loadAnalysisContext(admin, workspaceId, interaction);

  const transcript = interaction.transcript;
  const diarized = interaction.diarized_transcript as DiarizedTranscript | null;
  const formattedTranscript = buildFormattedTranscript(transcript, diarized);

  // ── 6 parallel Groq calls ─────────────────────────────────────────────────
  // deptContext is prepended when a department profile exists; empty string
  // when not, so the prompts are identical to the pre-Phase-5 behavior.
  // The 6th call checks transcript against user-defined compliance rules.
  const violationsPrompt = buildViolationsPrompt(
    formattedTranscript,
    globalViolationRules,
    deptViolationRules,
    deptName,
  );

  const [
    complianceRaw,
    salesRaw,
    softSkillsRaw,
    conversationRaw,
    summaryRaw,
    violationsRaw,
  ] = await Promise.all([
    groqJSON<ComplianceResult>(
      deptContext + buildCompliancePrompt(formattedTranscript, rules),
      1500,
    ),
    groqJSON<SalesResult>(
      deptContext + buildSalesPrompt(formattedTranscript),
      1024,
    ),
    groqJSON<SoftSkillsResult>(
      deptContext + buildSoftSkillsPrompt(formattedTranscript),
      800,
    ),
    groqJSON<ConversationResult>(
      deptContext + buildConversationPrompt(formattedTranscript),
      800,
    ),
    groqJSON<SummaryResult>(
      deptContext + buildSummaryPrompt(formattedTranscript),
      1500,
    ),
    violationsPrompt
      ? groqJSON<ViolationResult>(violationsPrompt, 2000)
      : Promise.resolve(null),
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

  // Use department scoring_rubric weights when valid; fallback to global defaults.
  const overallScore = deptRubric
    ? Math.round(
        compliance.score * (deptRubric["compliance"]! / 100) +
          sales.overall * (deptRubric["sales"]! / 100) +
          softSkills.overall * (deptRubric["soft_skills"]! / 100) +
          conversation.overall * (deptRubric["conversation"]! / 100),
      )
    : calcOverallScore(
        compliance.score,
        sales.overall,
        softSkills.overall,
        conversation.overall,
      );

  // Validate and sanitize user-defined violations
  const rawViolations = (violationsRaw?.violations ?? []).filter(
    (v) =>
      typeof v.rule_name === "string" &&
      v.rule_name.trim().length > 0 &&
      typeof v.fragment === "string" &&
      v.fragment.trim().length > 0 &&
      ["critical", "warning"].includes(v.severity) &&
      typeof v.confidence === "number" &&
      v.confidence >= 0.3, // minimum confidence threshold
  );

  // If any user-defined critical violations detected, override risk level
  const hasCriticalViolations = rawViolations.some(
    (v) => v.severity === "critical",
  );
  const riskLevel = hasCriticalViolations
    ? "critical"
    : calcRiskLevel(overallScore);

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

  // ── Persist evaluation + flags + status + coaching + violations ───────────
  const evalId = await persistAnalysis({
    admin,
    workspaceId,
    interactionId: id,
    interaction,
    compliance,
    sales,
    softSkills,
    conversation,
    summary,
    coaching,
    overallScore,
    riskLevel,
    rules,
    rawViolations,
    globalViolationRules,
    deptViolationRules,
  });

  if (!evalId) {
    return NextResponse.json(
      { error: "Failed to save evaluation" },
      { status: 500 },
    );
  }

  // ── Telegram alerts for critical violations (fire-and-forget) ─────────────
  const criticalViolations = rawViolations.filter(
    (v) => v.severity === "critical",
  );
  if (criticalViolations.length > 0) {
    after(async () => {
      for (const violation of criticalViolations) {
        await sendComplianceCriticalAlert({
          workspaceId,
          interactionId: id,
          agentName: interaction.agent_name ?? "Unknown Agent",
          ruleName: violation.rule_name,
          departmentName: deptName,
        });
      }
    });
  }

  // ── Post-response: commitments + customer journey + insights (non-blocking) ──
  after(() =>
    runCommitmentsAndJourney({
      workspaceId,
      interactionId: id,
      formattedTranscript,
      summary,
      customerId: interaction.customer_id,
    }),
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
    compliance_violations: rawViolations.length,
    critical_violations: criticalViolations.length,
    sentiment: summary.overall_sentiment,
    coaching_priority: coaching.priority_score,
  });
}
