import { QACShell, Panel } from "../_components/QACShell";
import { StatusBadge } from "../_components/StatusBadge";
import { pickQacAnalysis } from "../_components/analysis";
import { formatDate, formatDuration, percent } from "../_components/format";
import {
  qacAnalysisText,
  qacLanguageOf,
  qacStatusLabel,
  qacT,
} from "../_components/i18n";
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
    created_at: string | null;
    overall_score: number | null;
    qac_criteria_results?: Array<{
      result: string;
      qac_scorecard_criteria?: { name: string | null } | null;
    }>;
  }>;
}

const INTERACTIONS_TABLE_LIMIT = 1000;

function valueOf(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function customerLabel(interaction: InteractionRow): string {
  return (
    interaction.prospect_id ??
    interaction.caller_id ??
    interaction.external_call_id ??
    interaction.id
  );
}

export default async function QACInteractionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const lang = qacLanguageOf(params);
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
        created_at, overall_score,
        qac_criteria_results(result, qac_scorecard_criteria(name))
       )`,
      { count: "exact" },
    )
    .eq("workspace_id", access.workspaceId)
    .order("created_at", { ascending: false })
    .limit(INTERACTIONS_TABLE_LIMIT);

  const provider = valueOf(params, "provider");
  const department = valueOf(params, "department");
  const agent = valueOf(params, "agent");
  const status = valueOf(params, "status");
  const review = valueOf(params, "review_status");
  const channel = valueOf(params, "channel");
  const search = valueOf(params, "q").toLowerCase();
  const sort = valueOf(params, "sort") || "newest";
  const from = valueOf(params, "from");
  const to = valueOf(params, "to");
  const minScoreValue = valueOf(params, "min_score");
  const maxScoreValue = valueOf(params, "max_score");
  const minScore = minScoreValue ? Number(minScoreValue) : null;
  const maxScore = maxScoreValue ? Number(maxScoreValue) : null;
  const failedCriteria = valueOf(params, "failed_criteria").toLowerCase();

  if (provider) query = query.eq("provider_id", provider);
  if (department) query = query.eq("department_id", department);
  if (agent) query = query.eq("agent_id", agent);
  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);
  if (review) query = query.eq("review_status", review);
  if (from) query = query.gte("call_started_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("call_started_at", `${to}T23:59:59.999Z`);

  const { data, count } = await query;
  let interactions = (data as InteractionRow[] | null) ?? [];

  if (search) {
    interactions = interactions.filter((interaction) =>
      [
        interaction.channel,
        interaction.external_call_id,
        interaction.caller_id,
        interaction.prospect_id,
        interaction.qac_agents?.name,
        interaction.qac_agents?.extension,
        interaction.qac_departments?.name,
        interaction.qac_voip_providers?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }

  if (minScore !== null && Number.isFinite(minScore)) {
    interactions = interactions.filter(
      (row) =>
        Number(pickQacAnalysis(row.qac_analyses)?.overall_score ?? -1) >=
        minScore,
    );
  }
  if (maxScore !== null && Number.isFinite(maxScore)) {
    interactions = interactions.filter(
      (row) =>
        Number(pickQacAnalysis(row.qac_analyses)?.overall_score ?? 101) <=
        maxScore,
    );
  }
  if (failedCriteria) {
    interactions = interactions.filter((row) =>
      (pickQacAnalysis(row.qac_analyses)?.qac_criteria_results ?? []).some(
        (result) =>
          result.result === "fail" &&
          (result.qac_scorecard_criteria?.name ?? "")
            .toLowerCase()
            .includes(failedCriteria),
      ),
    );
  }

  interactions = [...interactions].sort((a, b) => {
    const scoreA = Number(pickQacAnalysis(a.qac_analyses)?.overall_score ?? -1);
    const scoreB = Number(pickQacAnalysis(b.qac_analyses)?.overall_score ?? -1);
    const dateA = new Date(a.call_started_at ?? a.created_at).getTime();
    const dateB = new Date(b.call_started_at ?? b.created_at).getTime();
    const durationA = Number(a.duration_seconds ?? 0);
    const durationB = Number(b.duration_seconds ?? 0);
    if (sort === "oldest") return dateA - dateB;
    if (sort === "score_desc") return scoreB - scoreA;
    if (sort === "score_asc") return scoreA - scoreB;
    if (sort === "duration_desc") return durationB - durationA;
    if (sort === "duration_asc") return durationA - durationB;
    return dateB - dateA;
  });
  const usesClientSideFilters = Boolean(
    search ||
      failedCriteria ||
      (minScore !== null && Number.isFinite(minScore)) ||
      (maxScore !== null && Number.isFinite(maxScore)),
  );
  const totalInteractions = usesClientSideFilters
    ? interactions.length
    : (count ?? interactions.length);
  const isTableTruncated =
    !usesClientSideFilters && totalInteractions > interactions.length;

  return (
    <QACShell
      active="interactions"
      title={qacT(lang, "Interactions", "Interacciones")}
      description={qacT(
        lang,
        "Every row here is a call center interaction imported from a provider CDR.",
        "Cada fila es una interaccion de call center importada desde un CDR del proveedor.",
      )}
      isSuperadmin={access.isSuperadmin}
      lang={lang}
    >
      <Panel title={qacT(lang, "Filters", "Filtros")}>
        <form className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
          <input type="hidden" name="lang" value={lang} />
          <input
            name="q"
            type="search"
            placeholder={qacT(
              lang,
              "Search phone, agent, ID",
              "Buscar telefono, agente, ID",
            )}
            defaultValue={valueOf(params, "q")}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <select
            name="channel"
            defaultValue={channel}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="">{qacT(lang, "Channel", "Canal")}</option>
            <option value="call">{qacT(lang, "Call", "Llamada")}</option>
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="newest">
              {qacT(lang, "Newest first", "Mas recientes")}
            </option>
            <option value="oldest">
              {qacT(lang, "Oldest first", "Mas antiguas")}
            </option>
            <option value="score_desc">
              {qacT(lang, "Highest score", "Mayor score")}
            </option>
            <option value="score_asc">
              {qacT(lang, "Lowest score", "Menor score")}
            </option>
            <option value="duration_desc">
              {qacT(lang, "Longest duration", "Mayor duracion")}
            </option>
            <option value="duration_asc">
              {qacT(lang, "Shortest duration", "Menor duracion")}
            </option>
          </select>
          <select
            name="provider"
            defaultValue={provider}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="">{qacT(lang, "Provider", "Proveedor")}</option>
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
            <option value="">{qacT(lang, "Department", "Departamento")}</option>
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
            <option value="">{qacT(lang, "Agent", "Agente")}</option>
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
            <option value="">
              {qacT(lang, "Analysis status", "Estado de analisis")}
            </option>
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
                {qacStatusLabel(lang, item)}
              </option>
            ))}
          </select>
          <select
            name="review_status"
            defaultValue={review}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          >
            <option value="">
              {qacT(lang, "Review status", "Estado de revision")}
            </option>
            {[
              "pending_review",
              "in_review",
              "reviewed",
              "approved",
              "disputed",
            ].map((item) => (
              <option key={item} value={item}>
                {qacStatusLabel(lang, item)}
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
            {qacT(lang, "Apply", "Aplicar")}
          </button>
          <input
            name="min_score"
            inputMode="numeric"
            placeholder={qacT(lang, "Min score", "Score minimo")}
            defaultValue={valueOf(params, "min_score")}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          />
          <input
            name="max_score"
            inputMode="numeric"
            placeholder={qacT(lang, "Max score", "Score maximo")}
            defaultValue={valueOf(params, "max_score")}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          />
          <input
            name="failed_criteria"
            placeholder={qacT(lang, "Failed criteria", "Criterios fallidos")}
            defaultValue={valueOf(params, "failed_criteria")}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm md:col-span-2"
          />
        </form>
      </Panel>

      <Panel
        title={qacT(
          lang,
          isTableTruncated
            ? `${interactions.length} of ${totalInteractions} interactions`
            : `${interactions.length} interactions`,
          isTableTruncated
            ? `${interactions.length} de ${totalInteractions} interacciones`
            : `${interactions.length} interacciones`,
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-[#fbfbfa] text-xs uppercase tracking-wide text-[#77756d]">
              <tr className="border-b border-[#d8d8d2]">
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Channel", "Canal")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Provider", "Proveedor")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Agent", "Agente")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Department", "Departamento")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Date", "Fecha")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Duration", "Duracion")}
                </th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Failed criteria", "Criterios fallidos")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Prospect / Caller", "Prospecto / Llamante")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Interaction ID", "ID interaccion")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Review", "Revision")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {qacT(lang, "Analysis", "Analisis")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e2dc]">
              {interactions.map((interaction) => {
                const analysis = pickQacAnalysis(interaction.qac_analyses);
                const failed = (analysis?.qac_criteria_results ?? []).filter(
                  (result) => result.result === "fail",
                );
                return (
                  <tr
                    key={interaction.id}
                    className="align-top transition-colors hover:bg-[#fbfbfa]"
                  >
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
                            .map((result) =>
                              qacAnalysisText(
                                lang,
                                result.qac_scorecard_criteria?.name ??
                                  "Criterion",
                              ),
                            )
                            .join(", ")
                        : "-"}
                    </td>
                    <td className="py-3 pr-3">
                      {interaction.prospect_id ?? interaction.caller_id ?? "-"}
                    </td>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/qa-center/interactions/${interaction.id}${
                          lang === "es" ? "?lang=es" : ""
                        }`}
                        className="font-medium text-[#181816] hover:underline"
                      >
                        {customerLabel(interaction)}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge
                        lang={lang}
                        value={interaction.review_status}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge lang={lang} value={interaction.status} />
                    </td>
                  </tr>
                );
              })}
              {interactions.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-[#77756d]">
                    {qacT(
                      lang,
                      "No interactions match these filters.",
                      "No hay interacciones con estos filtros.",
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
