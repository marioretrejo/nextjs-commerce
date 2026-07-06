import type { Department, FormData, ScoringRubric } from "./types";

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function rubricTotal(form: FormData): number {
  return form.compliance + form.sales + form.soft_skills + form.conversation;
}

export function getRubric(dept: Department): ScoringRubric {
  const r = dept.scoring_rubric;
  if (r && typeof r === "object" && "compliance" in r) return r;
  return { compliance: 40, sales: 25, soft_skills: 20, conversation: 15 };
}
