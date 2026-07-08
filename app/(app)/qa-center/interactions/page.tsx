import { QACShell, Panel } from "../_components/QACShell";
import { StatusBadge } from "../_components/StatusBadge";
import { formatDate, formatDuration, percent } from "../_components/format";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

interface InteractionRow {
  id: string;
  channel: string | null;
  external_call_id: string | null;
  caller_id: string | null;
  prospect_id: string | null;
  duration_seconds: number | null;
  call_started_at: string | null;
  created_at: string;
  status: string;
  review_status: string;
  qac_voip_providers?: { id: string; name: string | null } | null;
  qac_agents?: {
    id: string;
    name: string | null;
    extension: string | null;
  } | null;
  qac_departments?: { id: string; name: string | null } | null;
  qac_analyses?: Array<{
    overall_score: number | null;
    qac_criteria_results?: Array<{
      result: string;
      qac_scorecard_criteria?: { name: string | null } | null;
    }>;
  }>;
}

function valueOf(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function QACInteractionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const [providersResult, departmentsResult, agentsResult] = await Promise.all([
    admin
      .from("qac_voip_providers")
      .select("id, name")
      .eq("workspace_id", access.workspaceId)
      .order("name"),
    admin
      .from("qac_departments")
      .select("id, name")
      .eq("workspace_id", access.workspaceId)
      .order("name"),
    admin
      .from("qac_agents")
      .select("id, name, extension")
      .eq("workspace_id", access.workspaceId)
      .order("name"),
  ]);

  let query = admin
    .from("qac_interactions")
    .select(
      `id, channel, external_call_id, caller_id, prospect_id, duration_seconds,
       call_started_at, created_at, status, review_status,
       qac_voip_providers(id, name),
       qac_agents(id, name, extension),
       qac_departments(id, name),
       qac_analyses(
        overall_score,
        qac_criteria_results(result, qac_scorecard_criteria(name))
       )`,
    )
    .eq("workspace_id", access.workspaceId)
    .order("created_at", { ascending: false })
    .limit(150);

  const provider = valueOf(params, "provider");
  const department = valueOf(params, "department");
  const agent = valueOf(params, "agent");
  const status = valueOf(params, "status");
  const review = valueOf(params, "review_status");
  const from = valueOf(params, "from");
  const to = valueOf(params, "to");
  const minScore = Number(valueOf(params, "min_score"));
  const maxScore = Number(valueOf(params, "max_score"));
  const failedCriteria = valueOf(params, "failed_criteria").toLowerCase();

  if (provider) query = query.eq("provider_id", provider);
  if (department) query = query.eq("department_id", department);
  if (agent) query = query.eq("agent_id", agent);
  if (status) query = query.eq("status", status);
  if (review) query = query.eq("review_status", review);
  if (from) query = query.gte("call_started_at", from);
  if (to) query = query.lte("call_started_at", to);

  const { data } = await query;
  let interactions = (data as InteractionRow[] | null) ?? [];

  if (Number.isFinite(minScore)) {
    interactions = interactions.filter(
      (row) => Number(row.qac_analyses?.[0]?.overall_score ?? -1) >= minScore,
    );
  }
  if (Number.isFinite(maxScore)) {
    interactions = interactions.filter(
      (row) => Number(row.qac_analyses?.[0]?.overall_score ?? 101) <= maxScore,
    );
  }
  if (failedCriteria) {
    interactions = interactions.filter((row) =>
      (row.qac_analyses?.[0]?.qac_criteria_results ?? []).some(
        (result) =>
          result.result === "fail" &&
          (result.qac_scorecard_criteria?.name ?? "")
            .toLowerCase()
            .includes(failedCriteria),
      ),
    );
  }

  return (
    <QACShell
      active="interactions"
      title="Interactions"
      description="Every row here is a call center interaction imported from a provider CDR."
    >
      <Panel title="Filters">
        <form className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
          <select
            name="provider"
            defaultValue={provider}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Provider</option>
            {(
              (providersResult.data as Array<{
                id: string;
                name: string;
              }> | null) ?? []
            ).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            name="department"
            defaultValue={department}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Department</option>
            {(
              (departmentsResult.data as Array<{
                id: string;
                name: string;
              }> | null) ?? []
            ).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            name="agent"
            defaultValue={agent}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Agent</option>
            {(
              (agentsResult.data as Array<{
                id: string;
                name: string;
                extension: string | null;
              }> | null) ?? []
            ).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.extension ? ` (${item.extension})` : ""}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Analysis status</option>
            {[
              "pending_cdr",
              "pending_audio",
              "audio_ready",
              "transcribing",
              "transcribed",
              "analyzing",
              "analyzed",
              "not_evaluable",
              "failed_audio",
              "failed_transcription",
              "failed_analysis",
              "manual_review_required",
            ].map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            name="review_status"
            defaultValue={review}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Review status</option>
            {[
              "pending_review",
              "in_review",
              "reviewed",
              "approved",
              "disputed",
            ].map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          />
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
            Apply
          </button>
          <input
            name="min_score"
            inputMode="numeric"
            placeholder="Min score"
            defaultValue={valueOf(params, "min_score")}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          />
          <input
            name="max_score"
            inputMode="numeric"
            placeholder="Max score"
            defaultValue={valueOf(params, "max_score")}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          />
          <input
            name="failed_criteria"
            placeholder="Failed criteria"
            defaultValue={valueOf(params, "failed_criteria")}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm md:col-span-2"
          />
        </form>
      </Panel>

      <Panel title={`${interactions.length} interactions`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#77756d]">
              <tr className="border-b border-[#eeeeea]">
                <th className="py-2 pr-3 font-medium">Channel</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Agent</th>
                <th className="py-2 pr-3 font-medium">Department</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Duration</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 pr-3 font-medium">Failed criteria</th>
                <th className="py-2 pr-3 font-medium">Prospect / Caller</th>
                <th className="py-2 pr-3 font-medium">Interaction ID</th>
                <th className="py-2 pr-3 font-medium">Review</th>
                <th className="py-2 pr-3 font-medium">Analysis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eeeeea]">
              {interactions.map((interaction) => {
                const analysis = interaction.qac_analyses?.[0];
                const failed = (analysis?.qac_criteria_results ?? []).filter(
                  (result) => result.result === "fail",
                );
                return (
                  <tr key={interaction.id} className="align-top">
                    <td className="py-3 pr-3 capitalize">
                      {interaction.channel ?? "call"}
                    </td>
                    <td className="py-3 pr-3">
                      {interaction.qac_voip_providers?.name ?? "-"}
                    </td>
                    <td className="py-3 pr-3">
                      {interaction.qac_agents?.name ?? "-"}
                      {interaction.qac_agents?.extension && (
                        <p className="text-xs text-[#77756d]">
                          Ext. {interaction.qac_agents.extension}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {interaction.qac_departments?.name ?? "-"}
                    </td>
                    <td className="py-3 pr-3">
                      {formatDate(
                        interaction.call_started_at ?? interaction.created_at,
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {formatDuration(interaction.duration_seconds)}
                    </td>
                    <td className="py-3 pr-3">
                      {percent(analysis?.overall_score)}
                    </td>
                    <td className="py-3 pr-3">
                      {failed.length > 0
                        ? failed
                            .map(
                              (result) =>
                                result.qac_scorecard_criteria?.name ??
                                "Criterion",
                            )
                            .join(", ")
                        : "-"}
                    </td>
                    <td className="py-3 pr-3">
                      {interaction.prospect_id ?? interaction.caller_id ?? "-"}
                    </td>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/qa-center/interactions/${interaction.id}`}
                        className="font-medium text-[#181816] hover:underline"
                      >
                        {interaction.external_call_id ?? interaction.id}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge value={interaction.review_status} />
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge value={interaction.status} />
                    </td>
                  </tr>
                );
              })}
              {interactions.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-[#77756d]">
                    No interactions match these filters.
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
