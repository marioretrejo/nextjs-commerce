import {
  createCriterionAction,
  createScorecardAction,
  deleteCriterionAction,
  deleteScorecardAction,
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

export default async function QACScorecardsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const deleted = firstParam(params, "deleted");
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
        `id, name, version, is_active,
         qac_departments(name),
         qac_scorecard_criteria(
          id, category, name, description, weight, is_critical,
          applicability_rule, pass_definition, partial_definition,
          fail_definition, na_definition, sort_order
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
      title="Scorecards"
      description="Department-specific QA criteria with N/A-aware scoring."
    >
      {deleted && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {deleted === "criterion"
            ? "Criterion deleted."
            : "Scorecard deleted."}
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
                  className="rounded-lg border border-[#eeeeea]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeeea] p-4">
                    <div>
                      <h2 className="text-base font-semibold text-[#181816]">
                        {scorecard.name} v{scorecard.version}
                      </h2>
                      <p className="text-sm text-[#77756d]">
                        {scorecard.qac_departments?.name ?? "No department"} -
                        total weight {totalWeight}
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
                  <div className="divide-y divide-[#eeeeea]">
                    {criteria.map((criterion) => (
                      <div key={criterion.id} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-[#181816]">
                              {criterion.name}
                            </p>
                            <p className="text-xs text-[#77756d]">
                              {criterion.category} - weight {criterion.weight}
                              {criterion.is_critical ? " - critical" : ""}
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
                        {criterion.description && (
                          <p className="mt-2 text-sm text-[#2f2e2a]">
                            {criterion.description}
                          </p>
                        )}
                        <div className="mt-3 grid gap-2 text-xs text-[#5f5d56] md:grid-cols-2">
                          <p>
                            <span className="font-semibold">
                              Applicability:
                            </span>{" "}
                            {criterion.applicability_rule ?? "-"}
                          </p>
                          <p>
                            <span className="font-semibold">N/A:</span>{" "}
                            {criterion.na_definition ?? "-"}
                          </p>
                          <p>
                            <span className="font-semibold">Pass:</span>{" "}
                            {criterion.pass_definition ?? "-"}
                          </p>
                          <p>
                            <span className="font-semibold">Partial:</span>{" "}
                            {criterion.partial_definition ?? "-"}
                          </p>
                          <p>
                            <span className="font-semibold">Fail:</span>{" "}
                            {criterion.fail_definition ?? "-"}
                          </p>
                        </div>
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
