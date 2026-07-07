import type {
  Admin,
  ComplianceResult,
  SalesResult,
  SoftSkillsResult,
  ConversationResult,
  SummaryResult,
  CoachingResult,
  QACRule,
  ViolationRule,
  ViolationResultItem,
  InteractionRow,
} from "./types";

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

// Persist the evaluation and all derived rows (flags, status, coaching report,
// user-defined violations). Returns the new evaluation id, or null if the
// evaluation insert failed (in which case the interaction is marked "failed").
export async function persistAnalysis(params: {
  admin: Admin;
  workspaceId: string;
  interactionId: string;
  interaction: InteractionRow;
  compliance: ComplianceResult;
  sales: SalesResult;
  softSkills: SoftSkillsResult;
  conversation: ConversationResult;
  summary: SummaryResult;
  coaching: CoachingResult;
  overallScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  rules: QACRule[];
  rawViolations: ViolationResultItem[];
  globalViolationRules: ViolationRule[];
  deptViolationRules: ViolationRule[];
}): Promise<string | null> {
  const {
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
  } = params;

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
    return null;
  }

  const evalId = (evalData as { id: string }).id;

  // ── Save compliance flags ─────────────────────────────────────────────────
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

  // ── Save user-defined compliance violations ───────────────────────────────
  if (rawViolations.length > 0) {
    const ruleNameToId = new Map(
      [...globalViolationRules, ...deptViolationRules].map((r) => [
        r.name,
        r.id,
      ]),
    );
    const { error: violErr } = await admin
      .from("qac_compliance_violations")
      .insert(
        rawViolations.map((v) => ({
          interaction_id: id,
          workspace_id: workspaceId,
          department_id: interaction.department_id ?? null,
          rule_id: ruleNameToId.get(v.rule_name) ?? null,
          rule_name: v.rule_name.slice(0, 200),
          fragment: v.fragment.slice(0, 500),
          timestamp_seconds:
            typeof v.timestamp_seconds === "number"
              ? v.timestamp_seconds
              : null,
          severity: v.severity,
          confidence: Math.max(0, Math.min(1, v.confidence)),
          explanation:
            typeof v.explanation === "string"
              ? v.explanation.slice(0, 500)
              : null,
        })),
      );
    if (violErr)
      console.error(
        "[qac-analyze] Compliance violations insert failed:",
        violErr.message,
      );
  }

  return evalId;
}
