import { QACShell, MetricTile, Panel } from "../_components/QACShell";
import { StatusBadge } from "../_components/StatusBadge";
import { formatDate } from "../_components/format";
import { requireQacAccess } from "@/lib/qac/access";
import { QAC_ANALYSIS_STATUSES } from "@/lib/qac/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export default async function QACSettingsPage() {
  const access = await requireQacAccess();
  if (!access.isSuperadmin) redirect("/qa-center");

  const admin = createAdminClient();

  const [providers, departments, scorecards, logs] = await Promise.all([
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
      .from("qac_scorecards")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", access.workspaceId)
      .eq("is_active", true),
    admin
      .from("qac_ingestion_logs")
      .select("id, external_call_id, status, error_message, created_at")
      .eq("workspace_id", access.workspaceId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <QACShell
      active="settings"
      title="Settings"
      description="Operational QA Center configuration for CDR ingestion and analysis."
      isSuperadmin={access.isSuperadmin}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Active providers" value={providers.count ?? 0} />
        <MetricTile label="Active departments" value={departments.count ?? 0} />
        <MetricTile label="Active scorecards" value={scorecards.count ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel title="Analysis statuses">
          <div className="flex flex-wrap gap-2">
            {QAC_ANALYSIS_STATUSES.map((status) => (
              <StatusBadge key={status} value={status} />
            ))}
          </div>
        </Panel>

        <Panel title="Recent ingestion events">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#77756d]">
                <tr className="border-b border-black/15">
                  <th className="py-2 pr-3 font-medium">External call</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Error</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/15">
                {(
                  (logs.data as Array<{
                    id: string;
                    external_call_id: string | null;
                    status: string;
                    error_message: string | null;
                    created_at: string;
                  }> | null) ?? []
                ).map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 pr-3">
                      {log.external_call_id ?? "No external id"}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge value={log.status} />
                    </td>
                    <td className="py-3 pr-3 text-[#77756d]">
                      {log.error_message ?? "-"}
                    </td>
                    <td className="py-3 pr-3">{formatDate(log.created_at)}</td>
                  </tr>
                ))}
                {!logs.data?.length && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#77756d]">
                      No ingestion events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </QACShell>
  );
}
