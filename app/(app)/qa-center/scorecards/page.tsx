import {
  createCriterionAction,
  createScorecardAction,
  deleteCriterionAction,
  deleteScorecardAction,
  installConversionSalesV1Action,
  updateCriterionAction,
  updateScorecardAction,
} from "../_actions";
import { QACShell, Panel } from "../_components/QACShell";
import { StatusBadge } from "../_components/StatusBadge";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";

interface DepartmentRow {
  id: string;
  name: string;
}

interface ScorecardRow {
  id: string;
  department_id: string | null;
  name: string;
  version: number;
  is_active: boolean;
  qac_departments?: { name: string | null } | null;
  qac_scorecard_criteria?: Array<{
    id: string;
    category: string;
    name: string;
    description: string | null;
    weight: number;
    is_critical: boolean;
    applicability_rule: string | null;
    pass_definition: string | null;
    partial_definition: string | null;
    fail_definition: string | null;
    na_definition: string | null;
    examples_json: unknown;
    sort_order: number;
  }>;
}

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function languageOf(params: Record<string, string | string[] | undefined>) {
  return firstParam(params, "lang") === "es" ? "es" : "en";
}

function ui(lang: "en" | "es", en: string, es: string): string {
  return lang === "es" ? es : en;
}

function i18n(value: unknown): Record<string, string | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const root = value as { i18n?: unknown };
  if (!root.i18n || typeof root.i18n !== "object" || Array.isArray(root.i18n)) {
    return {};
  }
  const es = (root.i18n as { es?: unknown }).es;
  return es && typeof es === "object" && !Array.isArray(es)
    ? (es as Record<string, string | undefined>)
    : {};
}

function examplesText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join("\n");
  }
  if (!value || typeof value !== "object") return "";
  const examples = (value as { examples?: unknown }).examples;
  return Array.isArray(examples)
    ? examples
        .filter((item): item is string => typeof item === "string")
        .join("\n")
    : "";
}

function localized(
  criterion: NonNullable<ScorecardRow["qac_scorecard_criteria"]>[number],
  key:
    | "category"
    | "name"
    | "description"
    | "applicability_rule"
    | "pass_definition"
    | "partial_definition"
    | "fail_definition"
    | "na_definition",
  lang: "en" | "es",
): string | null {
  const base = criterion[key];
  if (lang !== "es") return base;
  return i18n(criterion.examples_json)[key] ?? base;
}

export default async function QACScorecardsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const deleted = firstParam(params, "deleted");
  const installed = firstParam(params, "installed");
  const errorMessage = firstParam(params, "error");
  const updated = firstParam(params, "updated");
  const lang = languageOf(params);
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const [departmentsResult, scorecardsResult] = await Promise.all([
    admin
      .from("qac_departments")
      .select("id, name")
      .eq("workspace_id", access.workspaceId)
      .eq("is_active", true)
      .order("name"),
    admin
      .from("qac_scorecards")
      .select(
        `id, department_id, name, version, is_active,
         qac_departments(name),
         qac_scorecard_criteria(
          id, category, name, description, weight, is_critical,
          applicability_rule, pass_definition, partial_definition,
          fail_definition, na_definition, examples_json, sort_order
         )`,
      )
      .eq("workspace_id", access.workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  const departments = (departmentsResult.data as DepartmentRow[] | null) ?? [];
  const scorecards = (scorecardsResult.data as ScorecardRow[] | null) ?? [];

  return (
    <QACShell
      active="scorecards"
      title={ui(lang, "Scorecards", "Scorecards")}
      description={ui(
        lang,
        "Department-specific QA criteria with N/A-aware scoring.",
        "Criterios QA por departamento con scoring que respeta N/A.",
      )}
      isSuperadmin={access.isSuperadmin}
    >
      {(deleted || installed || updated || errorMessage) && (
        <div
          className={
            errorMessage
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {errorMessage ??
            (installed
              ? ui(
                  lang,
                  "Conversion Sales V1 installed.",
                  "Conversion Sales V1 instalado.",
                )
              : updated === "criterion"
                ? ui(lang, "Criterion updated.", "Criterio actualizado.")
                : updated === "scorecard"
                  ? ui(lang, "Scorecard updated.", "Scorecard actualizado.")
                  : deleted === "criterion"
                    ? ui(lang, "Criterion deleted.", "Criterio eliminado.")
                    : ui(lang, "Scorecard deleted.", "Scorecard eliminado."))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Panel title={`${scorecards.length} scorecards`}>
          <div className="space-y-4">
            {scorecards.map((scorecard) => {
              const criteria = [
                ...(scorecard.qac_scorecard_criteria ?? []),
              ].sort((a, b) => a.sort_order - b.sort_order);
              const totalWeight = criteria.reduce(
                (sum, criterion) => sum + Number(criterion.weight),
                0,
              );
              return (
                <article
                  key={scorecard.id}
                  className="rounded-lg border border-black/15"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/15 p-4">
                    <div>
                      <h2 className="text-base font-semibold text-[#181816]">
                        {scorecard.name} v{scorecard.version}
                      </h2>
                      <p className="text-sm text-[#77756d]">
                        {scorecard.qac_departments?.name ?? "No department"} -
                        {ui(lang, "total weight", "peso total")} {totalWeight}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        value={scorecard.is_active ? "active" : "inactive"}
                      />
                      {access.isAdmin && (
                        <form action={deleteScorecardAction}>
                          <input type="hidden" name="id" value={scorecard.id} />
                          <button className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  {access.isAdmin && (
                    <details className="border-b border-black/15 bg-[#fbfbfa] px-4 py-3">
                      <summary className="inline-flex cursor-pointer rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-xs font-medium text-[#181816] hover:bg-[#f7f7f5]">
                        Edit
                      </summary>
                      <form
                        action={updateScorecardAction}
                        className="mt-3 grid gap-3 md:grid-cols-2"
                      >
                        <input type="hidden" name="id" value={scorecard.id} />
                        <input type="hidden" name="lang" value={lang} />
                        <select
                          name="department_id"
                          required
                          defaultValue={scorecard.department_id ?? ""}
                          className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                        >
                          <option value="">Department</option>
                          {departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name="name"
                          required
                          defaultValue={scorecard.name}
                          placeholder="Scorecard name"
                          className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                        />
                        <input
                          name="version"
                          type="number"
                          min="1"
                          defaultValue={scorecard.version}
                          className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            name="is_active"
                            type="checkbox"
                            defaultChecked={scorecard.is_active}
                          />
                          Active scorecard for department
                        </label>
                        <button className="rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white md:col-span-2">
                          Save changes
                        </button>
                      </form>
                    </details>
                  )}
                  <div className="divide-y divide-black/15">
                    {criteria.map((criterion) => (
                      <div key={criterion.id} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-[#181816]">
                              {localized(criterion, "name", lang)}
                            </p>
                            <p className="text-xs text-[#77756d]">
                              {localized(criterion, "category", lang)} -{" "}
                              {ui(lang, "weight", "peso")} {criterion.weight}
                              {criterion.is_critical
                                ? ` - ${ui(lang, "critical", "critico")}`
                                : ""}
                            </p>
                          </div>
                          {access.isAdmin && (
                            <form action={deleteCriterionAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={criterion.id}
                              />
                              <button className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                                Delete
                              </button>
                            </form>
                          )}
                        </div>
                        {localized(criterion, "description", lang) && (
                          <p className="mt-2 text-sm text-[#2f2e2a]">
                            {localized(criterion, "description", lang)}
                          </p>
                        )}
                        <div className="mt-3 grid gap-2 text-xs text-[#5f5d56] md:grid-cols-2">
                          <p>
                            <span className="font-semibold">
                              {ui(lang, "Applicability:", "Aplicabilidad:")}
                            </span>{" "}
                            {localized(criterion, "applicability_rule", lang) ??
                              "-"}
                          </p>
                          <p>
                            <span className="font-semibold">N/A:</span>{" "}
                            {localized(criterion, "na_definition", lang) ?? "-"}
                          </p>
                          <p>
                            <span className="font-semibold">
                              {ui(lang, "Pass:", "Aprobado:")}
                            </span>{" "}
                            {localized(criterion, "pass_definition", lang) ??
                              "-"}
                          </p>
                          <p>
                            <span className="font-semibold">
                              {ui(lang, "Partial:", "Parcial:")}
                            </span>{" "}
                            {localized(criterion, "partial_definition", lang) ??
                              "-"}
                          </p>
                          <p>
                            <span className="font-semibold">
                              {ui(lang, "Fail:", "Fallo:")}
                            </span>{" "}
                            {localized(criterion, "fail_definition", lang) ??
                              "-"}
                          </p>
                        </div>
                        {access.isAdmin && (
                          <details className="mt-4 rounded-md border border-black/15 bg-[#fbfbfa] p-3">
                            <summary className="inline-flex cursor-pointer rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-xs font-medium text-[#181816] hover:bg-[#f7f7f5]">
                              Edit
                            </summary>
                            <form
                              action={updateCriterionAction}
                              className="mt-3 grid gap-3 md:grid-cols-2"
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={criterion.id}
                              />
                              <input type="hidden" name="lang" value={lang} />
                              <input
                                name="category"
                                defaultValue={criterion.category}
                                placeholder="Category"
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                              />
                              <input
                                name="weight"
                                type="number"
                                min="0"
                                step="0.1"
                                defaultValue={criterion.weight}
                                placeholder="Weight"
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                              />
                              <input
                                name="name"
                                required
                                defaultValue={criterion.name}
                                placeholder="Criterion name"
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm md:col-span-2"
                              />
                              <textarea
                                name="description"
                                defaultValue={criterion.description ?? ""}
                                placeholder="Description"
                                rows={2}
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm md:col-span-2"
                              />
                              <textarea
                                name="applicability_rule"
                                defaultValue={
                                  criterion.applicability_rule ?? ""
                                }
                                placeholder="Applicability rule"
                                rows={2}
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm md:col-span-2"
                              />
                              <textarea
                                name="pass_definition"
                                defaultValue={criterion.pass_definition ?? ""}
                                placeholder="Pass definition"
                                rows={2}
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                              />
                              <textarea
                                name="partial_definition"
                                defaultValue={
                                  criterion.partial_definition ?? ""
                                }
                                placeholder="Partial definition"
                                rows={2}
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                              />
                              <textarea
                                name="fail_definition"
                                defaultValue={criterion.fail_definition ?? ""}
                                placeholder="Fail definition"
                                rows={2}
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                              />
                              <textarea
                                name="na_definition"
                                defaultValue={criterion.na_definition ?? ""}
                                placeholder="N/A definition"
                                rows={2}
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                              />
                              <textarea
                                name="examples"
                                defaultValue={examplesText(
                                  criterion.examples_json,
                                )}
                                placeholder="Examples, one per line"
                                rows={2}
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm md:col-span-2"
                              />
                              <input
                                name="sort_order"
                                type="number"
                                defaultValue={criterion.sort_order}
                                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                              />
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  name="is_critical"
                                  type="checkbox"
                                  defaultChecked={criterion.is_critical}
                                />
                                Critical
                              </label>
                              <button className="rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white md:col-span-2">
                                Save changes
                              </button>
                            </form>
                          </details>
                        )}
                      </div>
                    ))}
                    {criteria.length === 0 && (
                      <p className="p-4 text-sm text-[#77756d]">
                        No criteria added yet.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
            {scorecards.length === 0 && (
              <p className="py-8 text-center text-sm text-[#77756d]">
                No scorecards configured yet.
              </p>
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          {access.isSuperadmin && (
            <Panel title="Conversion Sales V1">
              <div className="space-y-3 text-sm">
                <p className="text-[#5f5d56]">
                  {ui(
                    lang,
                    "Install the full 25-rule scorecard and default AI trackers for the Conversion department.",
                    "Instala el scorecard completo de 25 reglas y los AI Trackers por defecto para el departamento Conversion.",
                  )}
                </p>
                <form action={installConversionSalesV1Action}>
                  <button className="w-full rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
                    {ui(lang, "Install preset", "Instalar preset")}
                  </button>
                </form>
              </div>
            </Panel>
          )}

          <Panel title="Create scorecard">
            <form action={createScorecardAction} className="space-y-3">
              <select
                name="department_id"
                required
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              >
                <option value="">Department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <input
                name="name"
                required
                placeholder="Scorecard name"
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <input
                name="version"
                type="number"
                min="1"
                defaultValue="1"
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />
                Active scorecard for department
              </label>
              <button className="w-full rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
                Create scorecard
              </button>
            </form>
          </Panel>

          <Panel title="Add criterion">
            <form action={createCriterionAction} className="space-y-3">
              <select
                name="scorecard_id"
                required
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              >
                <option value="">Scorecard</option>
                {scorecards.map((scorecard) => (
                  <option key={scorecard.id} value={scorecard.id}>
                    {scorecard.name} v{scorecard.version}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="category"
                  placeholder="Category"
                  className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                />
                <input
                  name="weight"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Weight"
                  className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                />
              </div>
              <input
                name="name"
                required
                placeholder="Criterion name"
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <textarea
                name="description"
                placeholder="Description"
                rows={2}
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <textarea
                name="applicability_rule"
                placeholder="Applicability rule"
                rows={2}
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <textarea
                name="pass_definition"
                placeholder="Pass definition"
                rows={2}
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <textarea
                name="partial_definition"
                placeholder="Partial definition"
                rows={2}
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <textarea
                name="fail_definition"
                placeholder="Fail definition"
                rows={2}
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <textarea
                name="na_definition"
                placeholder="N/A definition"
                rows={2}
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <textarea
                name="examples"
                placeholder="Examples, one per line"
                rows={2}
                className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="sort_order"
                  type="number"
                  defaultValue="0"
                  className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="is_critical"
                    type="checkbox"
                    className="h-4 w-4"
                  />
                  Critical
                </label>
              </div>
              <button className="w-full rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
                Add criterion
              </button>
            </form>
          </Panel>
        </div>
      </div>
    </QACShell>
  );
}
