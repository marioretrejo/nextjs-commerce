import type { Admin, QACRule, ViolationRule, InteractionRow } from "./types";

export interface AnalysisContext {
  rules: QACRule[];
  globalViolationRules: ViolationRule[];
  deptViolationRules: ViolationRule[];
  deptContext: string;
  deptRubric: Record<string, number> | null;
  deptName: string | null;
}

// Load the QA rules, scoped violation rules, and (optional) department profile
// that shape the analysis prompts + scoring. If the interaction has no
// department (or it is inactive/not found), deptContext/deptRubric/deptName stay
// at their defaults → behavior identical to pre-Phase-5.
export async function loadAnalysisContext(
  admin: Admin,
  workspaceId: string,
  interaction: InteractionRow,
): Promise<AnalysisContext> {
  // ── Fetch active QA rules for this workspace ───────────────────────────────
  const { data: rulesData } = await admin
    .from("qac_rules")
    .select("name, description, category, severity, regulation")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  const rules = (rulesData ?? []) as QACRule[];

  // Load scoped violation rules (global + department) for the violations prompt
  const [{ data: globalViolationRulesData }, deptViolationRulesResult] =
    await Promise.all([
      admin
        .from("qac_rules")
        .select(
          "id, name, description, alert_severity, examples, counter_examples",
        )
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .eq("scope", "global")
        .order("sort_order", { ascending: true }),
      interaction.department_id
        ? admin
            .from("qac_rules")
            .select(
              "id, name, description, alert_severity, examples, counter_examples",
            )
            .eq("workspace_id", workspaceId)
            .eq("is_active", true)
            .eq("scope", "department")
            .eq("department_id", interaction.department_id)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [] as ViolationRule[] }),
    ]);

  const globalViolationRules = (globalViolationRulesData ??
    []) as ViolationRule[];
  const deptViolationRules = ((
    deptViolationRulesResult as { data: ViolationRule[] | null }
  ).data ?? []) as ViolationRule[];

  // ── Fetch department profile (optional — null falls back to global defaults) ─
  type DeptRow = {
    qa_prompt: string | null;
    scoring_rubric: unknown;
    name: string | null;
  };
  let deptContext = "";
  let deptRubric: Record<string, number> | null = null;
  let deptName: string | null = null;

  if (interaction.department_id) {
    const { data: deptData } = await admin
      .from("qac_departments")
      .select("qa_prompt, scoring_rubric, name")
      .eq("id", interaction.department_id)
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    const dept = deptData as DeptRow | null;
    if (dept) {
      deptName = dept.name ?? null;

      if (dept.qa_prompt) {
        deptContext = `DEPARTMENT CONTEXT:\n${dept.qa_prompt.trim()}\n\n`;
      }

      // Validate rubric: object with the 4 expected numeric keys summing ~100
      const r = dept.scoring_rubric as Record<string, unknown> | null;
      if (r && typeof r === "object") {
        const c = Number(r["compliance"]);
        const s = Number(r["sales"]);
        const sk = Number(r["soft_skills"]);
        const cv = Number(r["conversation"]);
        if (!isNaN(c) && !isNaN(s) && !isNaN(sk) && !isNaN(cv)) {
          const total = c + s + sk + cv;
          if (Math.abs(total - 100) <= 2) {
            deptRubric = {
              compliance: c,
              sales: s,
              soft_skills: sk,
              conversation: cv,
            };
          }
        }
      }
    }
  }

  return {
    rules,
    globalViolationRules,
    deptViolationRules,
    deptContext,
    deptRubric,
    deptName,
  };
}
