import { QACShell, MetricTile, Panel } from "../_components/QACShell";
import { StatusBadge } from "../_components/StatusBadge";
import { formatDate } from "../_components/format";
import { qacLanguageOf, qacT } from "../_components/i18n";
import { requireQacAccess } from "@/lib/qac/access";
import { QAC_ANALYSIS_STATUSES } from "@/lib/qac/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export default async function QACSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const lang = qacLanguageOf(params);
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
      title={qacT(lang, "Settings", "Configuracion")}
      description={qacT(
        lang,
        "Operational QA Center configuration for CDR ingestion and analysis.",
        "Configuracion operativa de QA Center para ingesta CDR y analisis.",
      )}
      isSuperadmin={access.isSuperadmin}
      lang={lang}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile
          label={qacT(lang, "Active providers", "Proveedores activos")}
          value={providers.count ?? 0}
        />
        <MetricTile
          label={qacT(lang, "Active departments", "Departamentos activos")}
          value={departments.count ?? 0}
        />
        <MetricTile
          label={qacT(lang, "Active scorecards", "Scorecards activos")}
          value={scorecards.count ?? 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel title={qacT(lang, "Analysis statuses", "Estados de analisis")}>
          <div className="flex flex-wrap gap-2">
            {QAC_ANALYSIS_STATUSES.map((status) => (
              <StatusBadge key={status} value={status} />
            ))}
          </div>
        </Panel>

        <Panel
          title={qacT(
            lang,
            "Recent ingestion events",
            "Eventos recientes de ingesta",
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#77756d]">
                <tr className="border-b border-black/15">
                  <th className="py-2 pr-3 font-medium">
                    {qacT(lang, "External call", "Llamada externa")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {qacT(lang, "Status", "Estado")}
                  </th>
                  <th className="py-2 pr-3 font-medium">Error</th>
                  <th className="py-2 pr-3 font-medium">
                    {qacT(lang, "Date", "Fecha")}
                  </th>
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
                      {log.external_call_id ??
                        qacT(lang, "No external id", "Sin ID externo")}
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
                      {qacT(
                        lang,
                        "No ingestion events yet.",
                        "Todavia no hay eventos de ingesta.",
                      )}
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
