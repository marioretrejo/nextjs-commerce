import type {
  DiarizedTranscript,
  QACRule,
  ViolationRule,
  ComplianceResult,
  SalesResult,
  SoftSkillsResult,
  ConversationResult,
  SummaryResult,
} from "./types";

// ─── Formatted transcript builder ────────────────────────────────────────────

export function buildFormattedTranscript(
  plainTranscript: string,
  diarized: DiarizedTranscript | null,
): string {
  if (
    !diarized ||
    !Array.isArray(diarized.utterances) ||
    diarized.utterances.length === 0
  )
    return plainTranscript;
  return diarized.utterances
    .map((u) => `[Speaker ${u.speaker}]: ${u.text ?? ""}`)
    .join("\n");
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

export function buildCompliancePrompt(
  transcript: string,
  rules: QACRule[],
): string {
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

export function buildSalesPrompt(transcript: string): string {
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

export function buildSoftSkillsPrompt(transcript: string): string {
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

export function buildConversationPrompt(transcript: string): string {
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

export function buildSummaryPrompt(transcript: string): string {
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

export function buildCoachingPrompt(
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

export function buildCommitmentsPrompt(transcript: string): string {
  return `You are a compliance analyst extracting explicit follow-up commitments from a call transcript.

TRANSCRIPT:
${transcript.slice(0, 6000)}

A commitment is an explicit, verbal promise made by an agent OR customer to take a specific action after the call.
Examples: "I'll call you back on Tuesday", "I'll send you the contract today", "Let me think about it and I'll let you know".
Do NOT invent commitments. Only extract what is textually supported.

Return ONLY a JSON object with EXACTLY this structure:
{
  "items": [
    {
      "committed_by": "agent" or "customer",
      "text": "exact or paraphrased commitment text (1-200 chars)",
      "due_date": "YYYY-MM-DD" or null
    }
  ]
}

Rules:
- If no commitments exist, return { "items": [] }
- Maximum 5 items
- due_date must be a valid date string in YYYY-MM-DD format, or null
- Only include commitments with clear textual evidence

Respond with ONLY raw JSON.`;
}

export function buildViolationsPrompt(
  transcript: string,
  globalRules: ViolationRule[],
  deptRules: ViolationRule[],
  deptName: string | null,
): string {
  if (globalRules.length === 0 && deptRules.length === 0) return "";

  function formatRule(r: ViolationRule): string {
    const exArr = Array.isArray(r.examples) ? (r.examples as string[]) : [];
    const ctArr = Array.isArray(r.counter_examples)
      ? (r.counter_examples as string[])
      : [];
    const sev = (r.alert_severity ?? "warning").toUpperCase();
    let out = `[${sev}] ${r.name}: ${r.description}`;
    if (exArr.length > 0)
      out += `\n  Examples of violation: ${exArr.join("; ")}`;
    if (ctArr.length > 0) out += `\n  NOT a violation if: ${ctArr.join("; ")}`;
    return out;
  }

  const parts: string[] = [];
  if (globalRules.length > 0) {
    parts.push(
      `GLOBAL RULES (apply to all calls):\n${globalRules.map((r, i) => `${i + 1}. ${formatRule(r)}`).join("\n\n")}`,
    );
  }
  if (deptRules.length > 0) {
    parts.push(
      `DEPARTMENT RULES${deptName ? ` (${deptName})` : ""}:\n${deptRules.map((r, i) => `${i + 1}. ${formatRule(r)}`).join("\n\n")}`,
    );
  }

  return `You are a compliance rule checker for a call center. Check this transcript against the specific rules listed below.

${parts.join("\n\n")}

TRANSCRIPT:
${transcript.slice(0, 8000)}

For each rule that is VIOLATED, add one entry to the violations array. Only flag real violations evidenced by the transcript.

Return ONLY a JSON object:
{
  "violations": [
    {
      "rule_name": "exact rule name from the list above",
      "fragment": "exact quote from transcript (max 120 chars)",
      "timestamp_seconds": null or integer seconds into the call,
      "severity": "critical" or "warning",
      "confidence": 0.0 to 1.0,
      "explanation": "one sentence why this is a violation of the stated rule"
    }
  ]
}

If no rules are violated, return {"violations": []}.
Respond with ONLY raw JSON.`;
}
