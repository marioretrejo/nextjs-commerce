import { QACShell, MetricTile, Panel } from "./_components/QACShell";
import { StatusBadge } from "./_components/StatusBadge";
import { formatDate, formatDuration, percent } from "./_components/format";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

interface OverviewInteraction {
  id: string;
  external_call_id: string | null;
  caller_id: string | null;
  duration_seconds: number | null;
  status: string;
  review_status: string;
  call_started_at: string | null;
  created_at: string;
  qac_agents?: { name: string | null } | null;
  qac_departments?: { name: string | null } | null;
  qac_voip_providers?: { name: string | null } | null;
  qac_analyses?: Array<{
    overall_score: number | null;
    risk_level: string | null;
    created_at: string;
  }>;
}

export default async function QACenterOverviewPage() {
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const [interactionsResult, providersResult, departmentsResult, logsResult] =
    await Promise.all([
      admin
        .from("qac_interactions")
        .select(
          `id, external_call_id, caller_id, duration_seconds, status, review_status,
           call_started_at, created_at,
           qac_agents(name),
           qac_departments(name),
           qac_voip_providers(name),
           qac_analyses(overall_score, risk_level, created_at)`,
        )
        .eq("workspace_id", access.workspaceId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("qac_voip_providers")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", access.workspaceId)
        .eq("is_active", true),
      admin
        .from("qac_departments")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", access.workspaceId)
        .eq("is_active", true),
      admin
        .from("qac_ingestion_logs")
        .select("id, external_call_id, status, error_message, created_at")
        .eq("workspace_id", access.workspaceId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const interactions =
    (interactionsResult.data as OverviewInteraction[] | null) ?? [];
  const latestAnalyses = interactions
    .map((interaction) => interaction.qac_analyses?.[0])
    .filter(Boolean) as Array<{ overall_score: number | null }>;
  const scored = latestAnalyses.filter(
    (analysis) => analysis.overall_score !== null,
  );
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce(
            (sum, analysis) => sum + Number(analysis.overall_score),
            0,
          ) / scored.length,
        )
      : null;

  const analyzedCount = interactions.filter(
    (interaction) => interaction.status === "analyzed",
  ).length;
  const reviewCount = interactions.filter(
    (interaction) => interaction.status === "manual_review_required",
  ).length;
  const failedCount = interactions.filter((interaction) =>
    interaction.status.startsWith("failed"),
  ).length;

  return (
    <QACShell
      active="overview"
      title="Overview"
      description="CDR-only quality monitoring for imported call center interactions."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Interactions" value={interactions.length} />
        <MetricTile label="Analyzed" value={analyzedCount} />
        <MetricTile label="Average score" value={percent(avgScore)} />
        <MetricTile label="Needs review" value={reviewCount + failedCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel
          title="Recent CDR interactions"
          action={
            <Link
              href="/qa-center/interactions"
              className="text-sm font-medium text-[#181816] underline-offset-4 hover:underline"
            >
              View all
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#77756d]">
                <tr className="border-b border-[#eeeeea]">
                  <th className="py-2 pr-3 font-medium">Interaction</th>
                  <th className="py-2 pr-3 font-medium">Provider</th>
                  <th className="py-2 pr-3 font-medium">Agent</th>
                  <th className="py-2 pr-3 font-medium">Department</th>
                  <th className="py-2 pr-3 font-medium">Duration</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eeeeea]">
                {interactions.slice(0, 10).map((interaction) => {
                  const analysis = interaction.qac_analyses?.[0];
                  return (
                    <tr key={interaction.id} className="align-top">
                      <td className="py-3 pr-3">
                        <Link
                          href={`/qa-center/interactions/${interaction.id}`}
                          className="font-medium text-[#181816] hover:underline"
                        >
                          {interaction.external_call_id ?? interaction.id}
                        </Link>
                        <p className="text-xs text-[#77756d]">
                          {formatDate(
                            interaction.call_started_at ??
                              interaction.created_at,
                          )}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        {interaction.qac_voip_providers?.name ?? "-"}
                      </td>
                      <td className="py-3 pr-3">
                        {interaction.qac_agents?.name ?? "-"}
                      </td>
                      <td className="py-3 pr-3">
                        {interaction.qac_departments?.name ?? "-"}
                      </td>
                      <td className="py-3 pr-3">
                        {formatDuration(interaction.duration_seconds)}
                      </td>
                      <td className="py-3 pr-3">
                        {percent(analysis?.overall_score)}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge value={interaction.status} />
                      </td>
                    </tr>
                  );
                })}
                {interactions.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-[#77756d]" colSpan={7}>
                      No CDR interactions have been imported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Configuration">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#77756d]">Active providers</span>
                <span className="font-semibold text-[#181816]">
                  {providersResult.count ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#77756d]">Active departments</span>
                <span className="font-semibold text-[#181816]">
                  {departmentsResult.count ?? 0}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Ingestion log">
            <div className="space-y-3">
              {(
                (logsResult.data as Array<{
                  id: string;
                  external_call_id: string | null;
                  status: string;
                  error_message: string | null;
                  created_at: string;
                }> | null) ?? []
              ).map((log) => (
                <div key={log.id} className="border-b border-[#eeeeea] pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[#181816]">
                      {log.external_call_id ?? "No external id"}
                    </p>
                    <StatusBadge value={log.status} />
                  </div>
                  <p className="mt-1 text-xs text-[#77756d]">
                    {formatDate(log.created_at)}
                  </p>
                  {log.error_message && (
                    <p className="mt-1 text-xs text-red-700">
                      {log.error_message}
                    </p>
                  )}
                </div>
              ))}
              {!logsResult.data?.length && (
                <p className="text-sm text-[#77756d]">
                  No ingestion events yet.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </QACShell>
  );
}
