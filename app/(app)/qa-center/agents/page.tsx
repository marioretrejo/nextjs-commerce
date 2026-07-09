import { deleteAgentAction, updateAgentAction } from "../_actions";
import { QACShell, Panel } from "../_components/QACShell";
import { percent } from "../_components/format";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";

interface DepartmentRow {
  id: string;
  name: string;
}

interface AgentRow {
  id: string;
  name: string;
  extension: string | null;
  department_id: string | null;
  is_active: boolean;
  qac_departments?: { name: string | null } | null;
}

interface InteractionRow {
  id: string;
  agent_id: string | null;
  status: string;
  review_status: string;
  call_started_at: string | null;
  created_at: string;
  qac_analyses?: Array<{
    overall_score: number | null;
    qac_criteria_results?: Array<{
      result: string;
      score: number | null;
      qac_scorecard_criteria?: {
        name: string | null;
        category: string | null;
        weight: number | null;
      } | null;
    }>;
  }>;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function QACAgentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const deleted = firstParam(params, "deleted");
  const updated = firstParam(params, "updated");
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const [agentsResult, interactionsResult, departmentsResult] =
    await Promise.all([
      admin
        .from("qac_agents")
        .select(
          "id, name, extension, department_id, is_active, qac_departments(name)",
        )
        .eq("workspace_id", access.workspaceId)
        .order("name"),
      admin
        .from("qac_interactions")
        .select(
          `id, agent_id, status, review_status, call_started_at, created_at,
         qac_analyses(
          overall_score,
          qac_criteria_results(
            result, score,
            qac_scorecard_criteria(name, category, weight)
          )
         )`,
        )
        .eq("workspace_id", access.workspaceId)
        .not("agent_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1000),
      admin
        .from("qac_departments")
        .select("id, name")
        .eq("workspace_id", access.workspaceId)
        .eq("is_active", true)
        .order("name"),
    ]);

  const agents = (agentsResult.data as AgentRow[] | null) ?? [];
  const interactions =
    (interactionsResult.data as InteractionRow[] | null) ?? [];
  const departments = (departmentsResult.data as DepartmentRow[] | null) ?? [];

  const rows = agents.map((agent) => {
    const calls = interactions.filter((item) => item.agent_id === agent.id);
    const analyzed = calls.filter((item) => item.status === "analyzed");
    const scores = calls
      .map((item) => item.qac_analyses?.[0]?.overall_score)
      .filter(
        (score): score is number => score !== null && score !== undefined,
      );
    const categoryTotals = new Map<
      string,
      { earned: number; weight: number }
    >();
    const failed = new Map<string, number>();

    for (const call of calls) {
      for (const result of call.qac_analyses?.[0]?.qac_criteria_results ?? []) {
        const criterion = result.qac_scorecard_criteria;
        const category = criterion?.category ?? "Uncategorized";
        const weight = Number(criterion?.weight ?? 0);
        if (result.result !== "n/a") {
          const current = categoryTotals.get(category) ?? {
            earned: 0,
            weight: 0,
          };
          current.earned += Number(result.score ?? 0);
          current.weight += weight;
          categoryTotals.set(category, current);
        }
        if (result.result === "fail") {
          const name = criterion?.name ?? "Criterion";
          failed.set(name, (failed.get(name) ?? 0) + 1);
        }
      }
    }

    const categories = [...categoryTotals.entries()].map(([name, value]) => ({
      name,
      score:
        value.weight > 0
          ? Math.round((value.earned / value.weight) * 100)
          : null,
    }));

    const trend = calls
      .filter((item) => item.qac_analyses?.[0]?.overall_score !== null)
      .slice(0, 8)
      .reverse()
      .map((item) => Number(item.qac_analyses?.[0]?.overall_score ?? 0));

    return {
      agent,
      totalCalls: calls.length,
      analyzedCalls: analyzed.length,
      averageScore: average(scores),
      categories,
      failed: [...failed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      trend,
      requiringReview: calls.filter(
        (item) =>
          item.status === "manual_review_required" ||
          item.status.startsWith("failed") ||
          item.review_status === "in_review",
      ).length,
    };
  });

  return (
    <QACShell
      active="agents"
      title="Agents"
      description="Agent performance calculated only from imported CDR interactions."
      isSuperadmin={access.isSuperadmin}
    >
      {(deleted || updated) && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {updated ? "Agent updated." : "Agent deleted."}
        </div>
      )}
      <Panel title={`${rows.length} agents`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#77756d]">
              <tr className="border-b border-black/15">
                <th className="py-2 pr-3 font-medium">Agent</th>
                <th className="py-2 pr-3 font-medium">Department</th>
                <th className="py-2 pr-3 font-medium">Total calls</th>
                <th className="py-2 pr-3 font-medium">Analyzed</th>
                <th className="py-2 pr-3 font-medium">Average score</th>
                <th className="py-2 pr-3 font-medium">Score by category</th>
                <th className="py-2 pr-3 font-medium">Failed criteria</th>
                <th className="py-2 pr-3 font-medium">Trend</th>
                <th className="py-2 pr-3 font-medium">Needs review</th>
                {access.isAdmin && (
                  <th className="py-2 pr-3 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/15">
              {rows.map((row) => (
                <tr key={row.agent.id} className="align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-[#181816]">
                      {row.agent.name}
                    </p>
                    <p className="text-xs text-[#77756d]">
                      Extension {row.agent.extension ?? "-"}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {row.agent.qac_departments?.name ?? "-"}
                    {!row.agent.is_active && (
                      <p className="text-xs text-[#77756d]">Inactive</p>
                    )}
                  </td>
                  <td className="py-3 pr-3">{row.totalCalls}</td>
                  <td className="py-3 pr-3">{row.analyzedCalls}</td>
                  <td className="py-3 pr-3 font-semibold">
                    {percent(row.averageScore)}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="space-y-1">
                      {row.categories.map((category) => (
                        <div key={category.name} className="flex gap-2">
                          <span className="min-w-24 text-[#77756d]">
                            {category.name}
                          </span>
                          <span>{percent(category.score)}</span>
                        </div>
                      ))}
                      {row.categories.length === 0 && "-"}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    {row.failed.length > 0
                      ? row.failed
                          .map(([name, count]) => `${name} (${count})`)
                          .join(", ")
                      : "-"}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex h-10 items-end gap-1">
                      {row.trend.map((score, index) => (
                        <span
                          key={`${score}-${index}`}
                          className="w-2 rounded-sm bg-[#181816]"
                          style={{ height: `${Math.max(4, score * 0.36)}px` }}
                        />
                      ))}
                      {row.trend.length === 0 && (
                        <span className="text-[#77756d]">-</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3">{row.requiringReview}</td>
                  {access.isAdmin && (
                    <td className="py-3 pr-3">
                      <div className="flex flex-col gap-2">
                        <details>
                          <summary className="inline-flex cursor-pointer rounded-md border border-black/20 px-2.5 py-1.5 text-xs font-medium text-[#181816] hover:bg-[#f7f7f5]">
                            Edit
                          </summary>
                          <form
                            action={updateAgentAction}
                            className="mt-2 grid min-w-[260px] gap-2 rounded-md border border-black/15 bg-[#fbfbfa] p-3"
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={row.agent.id}
                            />
                            <input
                              name="name"
                              required
                              defaultValue={row.agent.name}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            />
                            <input
                              name="extension"
                              defaultValue={row.agent.extension ?? ""}
                              placeholder="Extension"
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            />
                            <select
                              name="department_id"
                              defaultValue={row.agent.department_id ?? ""}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            >
                              <option value="">No department</option>
                              {departments.map((department) => (
                                <option
                                  key={department.id}
                                  value={department.id}
                                >
                                  {department.name}
                                </option>
                              ))}
                            </select>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                name="is_active"
                                type="checkbox"
                                defaultChecked={row.agent.is_active}
                              />
                              Active
                            </label>
                            <button className="rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
                              Save changes
                            </button>
                          </form>
                        </details>
                        <form action={deleteAgentAction}>
                          <input type="hidden" name="id" value={row.agent.id} />
                          <button className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={access.isAdmin ? 10 : 9}
                    className="py-8 text-center text-[#77756d]"
                  >
                    No CDR agents have been matched yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </QACShell>
  );
}
