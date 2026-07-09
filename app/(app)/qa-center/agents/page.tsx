import { deleteAgentAction, updateAgentAction } from "../_actions";
import { QACShell, Panel } from "../_components/QACShell";
import { pickQacAnalysis } from "../_components/analysis";
import { percent } from "../_components/format";
import { qacAnalysisText, qacLanguageOf, qacT } from "../_components/i18n";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

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
    created_at: string | null;
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

type TrendState = "up" | "down" | "stable" | "insufficient" | "empty";

function trendSummary(scores: number[]): {
  state: TrendState;
  delta: number | null;
  latest: number | null;
} {
  const latest = scores.at(-1) ?? null;
  if (scores.length === 0) return { state: "empty", delta: null, latest };
  if (scores.length === 1) {
    return { state: "insufficient", delta: null, latest };
  }

  const delta = Math.round((scores.at(-1) ?? 0) - (scores[0] ?? 0));
  if (delta >= 5) return { state: "up", delta, latest };
  if (delta <= -5) return { state: "down", delta, latest };
  return { state: "stable", delta, latest };
}

function trendClasses(state: TrendState): {
  badge: string;
  icon: string;
  bars: string;
} {
  if (state === "up") {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: "text-emerald-700",
      bars: "bg-emerald-600",
    };
  }
  if (state === "down") {
    return {
      badge: "border-red-200 bg-red-50 text-red-800",
      icon: "text-red-700",
      bars: "bg-red-600",
    };
  }
  return {
    badge: "border-[#d8d8d2] bg-[#f7f7f5] text-[#5f5d56]",
    icon: "text-[#77756d]",
    bars: "bg-[#77756d]",
  };
}

function TrendIcon({ state }: { state: TrendState }) {
  if (state === "up") return <TrendingUp className="h-3.5 w-3.5" />;
  if (state === "down") return <TrendingDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
}

export default async function QACAgentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const lang = qacLanguageOf(params);
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
          created_at, overall_score,
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
      .map((item) => pickQacAnalysis(item.qac_analyses)?.overall_score)
      .filter(
        (score): score is number => score !== null && score !== undefined,
      );
    const categoryTotals = new Map<
      string,
      { earned: number; weight: number }
    >();
    const failed = new Map<string, number>();

    for (const call of calls) {
      const analysis = pickQacAnalysis(call.qac_analyses);
      for (const result of analysis?.qac_criteria_results ?? []) {
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
      .filter(
        (item) => pickQacAnalysis(item.qac_analyses)?.overall_score !== null,
      )
      .slice(0, 8)
      .reverse()
      .map((item) =>
        Number(pickQacAnalysis(item.qac_analyses)?.overall_score ?? 0),
      );

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
      title={qacT(lang, "Agents", "Agentes")}
      description={qacT(
        lang,
        "Agent performance calculated only from imported CDR interactions.",
        "Rendimiento de agentes calculado solo desde interacciones CDR importadas.",
      )}
      isSuperadmin={access.isSuperadmin}
      lang={lang}
    >
      {(deleted || updated) && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {updated
            ? qacT(lang, "Agent updated.", "Agente actualizado.")
            : qacT(lang, "Agent deleted.", "Agente eliminado.")}
        </div>
      )}
      <Panel
        title={qacT(lang, `${rows.length} agents`, `${rows.length} agentes`)}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#77756d]">
              <tr className="border-b border-black/15">
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Agent", "Agente")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Department", "Departamento")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Total calls", "Total llamadas")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Analyzed", "Analizadas")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Average score", "Promedio")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Score by category", "Score por categoria")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Failed criteria", "Criterios fallidos")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Trend", "Tendencia")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Needs review", "Requiere revision")}
                </th>
                {access.isAdmin && (
                  <th className="py-2 pr-3 font-medium">
                    {qacT(lang, "Actions", "Acciones")}
                  </th>
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
                      {qacT(lang, "Extension", "Extension")}{" "}
                      {row.agent.extension ?? "-"}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {row.agent.qac_departments?.name ?? "-"}
                    {!row.agent.is_active && (
                      <p className="text-xs text-[#77756d]">
                        {qacT(lang, "Inactive", "Inactivo")}
                      </p>
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
                            {qacAnalysisText(lang, category.name)}
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
                          .map(
                            ([name, count]) =>
                              `${qacAnalysisText(lang, name)} (${count})`,
                          )
                          .join(", ")
                      : "-"}
                  </td>
                  <td className="py-3 pr-3">
                    {(() => {
                      const trend = trendSummary(row.trend);
                      const trendStyle = trendClasses(trend.state);
                      const trendLabel =
                        trend.state === "up"
                          ? qacT(lang, "Rising", "Subiendo")
                          : trend.state === "down"
                            ? qacT(lang, "Falling", "Bajando")
                            : trend.state === "stable"
                              ? qacT(lang, "Stable", "Estable")
                              : qacT(
                                  lang,
                                  "Not enough data",
                                  "Sin datos suficientes",
                                );
                      const scoreTrail = row.trend
                        .map((score) => Math.round(score))
                        .join(" -> ");

                      return (
                        <div className="min-w-[190px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${trendStyle.badge}`}
                            >
                              <span className={trendStyle.icon}>
                                <TrendIcon state={trend.state} />
                              </span>
                              {trendLabel}
                            </span>
                            {trend.latest !== null && (
                              <span className="text-xs font-medium text-[#181816]">
                                {qacT(lang, "Last", "Ultimo")}{" "}
                                {percent(trend.latest)}
                              </span>
                            )}
                            {trend.delta !== null && (
                              <span className="text-xs text-[#77756d]">
                                {trend.delta > 0 ? "+" : ""}
                                {trend.delta} pts
                              </span>
                            )}
                          </div>
                          {row.trend.length > 0 ? (
                            <div
                              className="mt-2 flex h-14 items-end gap-1 rounded-md border border-[#d8d8d2] bg-[#fbfbfa] px-2 py-1"
                              title={
                                scoreTrail
                                  ? qacT(
                                      lang,
                                      `Last QA scores: ${scoreTrail}`,
                                      `Ultimos scores QA: ${scoreTrail}`,
                                    )
                                  : undefined
                              }
                            >
                              {row.trend.map((score, index) => (
                                <span
                                  key={`${score}-${index}`}
                                  className={`w-3 rounded-sm ${trendStyle.bars}`}
                                  style={{
                                    height: `${Math.max(8, Math.min(46, 8 + score * 0.38))}px`,
                                    opacity:
                                      index === row.trend.length - 1 ? 1 : 0.62,
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 rounded-md border border-dashed border-[#d8d8d2] bg-[#fbfbfa] px-3 py-2 text-xs text-[#77756d]">
                              {qacT(
                                lang,
                                "No analyzed QA scores yet.",
                                "Todavia no hay scores QA analizados.",
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3 pr-3">{row.requiringReview}</td>
                  {access.isAdmin && (
                    <td className="py-3 pr-3">
                      <div className="flex flex-col gap-2">
                        <details>
                          <summary className="inline-flex cursor-pointer rounded-md border border-black/20 px-2.5 py-1.5 text-xs font-medium text-[#181816] hover:bg-[#f7f7f5]">
                            {qacT(lang, "Edit", "Editar")}
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
                              <option value="">
                                {qacT(
                                  lang,
                                  "No department",
                                  "Sin departamento",
                                )}
                              </option>
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
                              {qacT(lang, "Active", "Activo")}
                            </label>
                            <button className="rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
                              {qacT(lang, "Save changes", "Guardar cambios")}
                            </button>
                          </form>
                        </details>
                        <form action={deleteAgentAction}>
                          <input type="hidden" name="id" value={row.agent.id} />
                          <button className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                            {qacT(lang, "Delete", "Eliminar")}
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
                    {qacT(
                      lang,
                      "No CDR agents have been matched yet.",
                      "Todavia no se han detectado agentes CDR.",
                    )}
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
