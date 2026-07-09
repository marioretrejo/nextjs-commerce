import { triggerQacAnalysisAction } from "../../_actions";
import { QacAudioPlayer } from "../../_components/QacAudioPlayer";
import { QACShell, Panel, MetricTile } from "../../_components/QACShell";
import { StatusBadge } from "../../_components/StatusBadge";
import { pickQacAnalysis } from "../../_components/analysis";
import { formatDate, formatDuration, percent } from "../../_components/format";
import { qacLanguageOf, qacT } from "../../_components/i18n";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

interface TranscriptSegment {
  speaker?: string;
  start?: number;
  end?: number;
  text?: string;
}

interface CriteriaResult {
  id: string;
  applicable: boolean;
  result: string;
  score: number | null;
  reason: string | null;
  evidence_json: unknown;
  reviewer_comment: string | null;
  qac_scorecard_criteria?: {
    name: string | null;
    category: string | null;
    weight: number | null;
    is_critical: boolean | null;
  } | null;
}

interface InteractionDetail {
  id: string;
  external_call_id: string | null;
  caller_id: string | null;
  prospect_id: string | null;
  recording_url: string | null;
  internal_audio_url: string | null;
  duration_seconds: number | null;
  direction: string | null;
  disposition: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  status: string;
  review_status: string;
  raw_payload: unknown;
  created_at: string;
  qac_voip_providers?: { name: string | null; slug: string | null } | null;
  qac_agents?: { name: string | null; extension: string | null } | null;
  qac_departments?: { name: string | null } | null;
  qac_transcripts?: Array<{
    full_text: string;
    diarized_json: unknown;
    language: string | null;
    provider: string | null;
    created_at?: string | null;
  }>;
  qac_analyses?: Array<{
    id: string;
    created_at: string | null;
    overall_score: number | null;
    sentiment: string | null;
    risk_level: string | null;
    call_disposition: string | null;
    summary: string | null;
    strengths_json: unknown;
    opportunities_json: unknown;
    recommendations_json: unknown;
    trackers_json: unknown;
    qac_scorecards?: { name: string | null; version: number | null } | null;
    qac_criteria_results?: CriteriaResult[];
  }>;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function detectedTrackerLabels(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const results = (value as { tracker_results?: unknown }).tracker_results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((item): item is { detected?: unknown; name?: unknown } =>
      Boolean(item && typeof item === "object"),
    )
    .filter((item) => Boolean(item.detected))
    .map((item) => String(item.name ?? "Tracker"))
    .filter(Boolean);
}

function segments(value: unknown): TranscriptSegment[] {
  return Array.isArray(value)
    ? value.filter((item): item is TranscriptSegment =>
        Boolean(item && typeof item === "object"),
      )
    : [];
}

function pickTranscript(
  transcripts: InteractionDetail["qac_transcripts"] | undefined,
) {
  return [...(transcripts ?? [])].sort((a, b) => {
    const segmentDelta =
      segments(b.diarized_json).length - segments(a.diarized_json).length;
    if (segmentDelta !== 0) return segmentDelta;
    return (
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
    );
  })[0];
}

function evidence(
  value: unknown,
): Array<{ timestamp_seconds?: number; quote?: string }> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is { timestamp_seconds?: number; quote?: string } =>
          Boolean(item && typeof item === "object"),
      )
    : [];
}

function audioHref(interaction: InteractionDetail): string | null {
  if (!interaction.internal_audio_url && !interaction.recording_url)
    return null;
  return `/api/qa-center/interactions/${interaction.id}/audio`;
}

function customerLabel(interaction: InteractionDetail): string {
  return (
    interaction.prospect_id ??
    interaction.caller_id ??
    interaction.external_call_id ??
    interaction.id
  );
}

function speakerLabel(
  speaker: string | undefined,
  interaction: InteractionDetail,
): string {
  const raw = (speaker ?? "").toLowerCase();
  if (raw.includes("agent") || raw.includes("agente")) {
    return interaction.qac_agents?.name ?? "Agente";
  }
  if (raw.includes("customer") || raw.includes("cliente")) {
    return `Cliente (${customerLabel(interaction)})`;
  }
  return speaker ?? "Speaker";
}

function sentimentLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const raw = value.toLowerCase();
  if (
    raw.includes("molesto") ||
    raw.includes("angry") ||
    raw.includes("upset")
  ) {
    return "😠 Molesto";
  }
  if (
    raw.includes("negativo") ||
    raw.includes("negative") ||
    raw.includes("triste")
  ) {
    return "😟 Negativo";
  }
  if (raw.includes("feliz") || raw.includes("happy")) {
    return "😄 Feliz";
  }
  if (
    raw.includes("contento") ||
    raw.includes("positive") ||
    raw.includes("positivo")
  ) {
    return "😊 Contento";
  }
  if (raw.includes("neutral")) {
    return "😐 Neutral";
  }
  return `🙂 ${value}`;
}

export default async function QACInteractionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const lang = qacLanguageOf(query);
  const q = String(query["q"] ?? "").toLowerCase();
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const { data } = await admin
    .from("qac_interactions")
    .select(
      `id, external_call_id, caller_id, prospect_id, recording_url,
       internal_audio_url, duration_seconds, direction, disposition,
       call_started_at, call_ended_at, status, review_status, raw_payload,
       created_at,
       qac_voip_providers(name, slug),
       qac_agents(name, extension),
       qac_departments(name),
       qac_transcripts(full_text, diarized_json, language, provider, created_at),
       qac_analyses(
        id, created_at, overall_score, sentiment, risk_level, call_disposition, summary,
        strengths_json, opportunities_json, recommendations_json, trackers_json,
        qac_scorecards(name, version),
        qac_criteria_results(
          id, applicable, result, score, reason, evidence_json, reviewer_comment,
          qac_scorecard_criteria(name, category, weight, is_critical)
        )
       )`,
    )
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();

  const interaction = data as InteractionDetail | null;
  if (!interaction) notFound();

  const transcript = pickTranscript(interaction.qac_transcripts);
  const analysis = pickQacAnalysis(interaction.qac_analyses);
  const transcriptText = transcript?.full_text ?? "";
  const diarized = segments(transcript?.diarized_json);
  const filteredSegments = q
    ? diarized.filter((segment) =>
        String(segment.text ?? "")
          .toLowerCase()
          .includes(q),
      )
    : diarized;
  const audioUrl = audioHref(interaction);
  const trackers =
    typeof analysis?.trackers_json === "object" && analysis.trackers_json
      ? (analysis.trackers_json as {
          detected_objections?: unknown;
          follow_up_detected?: unknown;
        })
      : {};

  return (
    <QACShell
      active="interactions"
      title={qacT(lang, "Interaction Detail", "Detalle de interaccion")}
      description={qacT(
        lang,
        "CDR interaction detail with transcript, analysis and scorecard evidence.",
        "Detalle CDR con transcripcion, analisis y evidencia del scorecard.",
      )}
      isSuperadmin={access.isSuperadmin}
      lang={lang}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Score"
          value={percent(analysis?.overall_score)}
          hint={
            analysis?.qac_scorecards?.name ??
            qacT(lang, "No scorecard result yet", "Sin resultado de scorecard")
          }
        />
        <MetricTile
          label={qacT(lang, "Duration", "Duracion")}
          value={formatDuration(interaction.duration_seconds)}
        />
        <MetricTile
          label={qacT(lang, "Sentiment", "Sentimiento")}
          value={sentimentLabel(analysis?.sentiment)}
          hint={`${qacT(lang, "Risk", "Riesgo")}: ${analysis?.risk_level ?? "-"}`}
        />
        <MetricTile
          label={qacT(lang, "Review", "Revision")}
          value={interaction.review_status.replace(/_/g, " ")}
        />
      </div>

      <Panel
        title={customerLabel(interaction)}
        action={
          <form action={triggerQacAnalysisAction}>
            <input type="hidden" name="interaction_id" value={interaction.id} />
            <button className="rounded-md bg-[#181816] px-3 py-1.5 text-sm font-medium text-white">
              {qacT(lang, "Analyze", "Analizar")}
            </button>
          </form>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#77756d]">
              {qacT(lang, "Provider", "Proveedor")}
            </p>
            <p className="font-medium text-[#181816]">
              {interaction.qac_voip_providers?.name ?? "-"}
            </p>
            <StatusBadge value={interaction.status} />
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#77756d]">
              {qacT(lang, "Agent", "Agente")}
            </p>
            <p className="font-medium text-[#181816]">
              {interaction.qac_agents?.name ?? "-"}
            </p>
            <p className="text-[#77756d]">
              {qacT(lang, "Ext.", "Ext.")}{" "}
              {interaction.qac_agents?.extension ?? "-"}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#77756d]">
              {qacT(lang, "Department", "Departamento")}
            </p>
            <p className="font-medium text-[#181816]">
              {interaction.qac_departments?.name ?? "-"}
            </p>
            <StatusBadge value={interaction.review_status} />
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-[#77756d]">
              {qacT(lang, "Caller / Prospect", "Llamante / Prospecto")}
            </p>
            <p>{interaction.caller_id ?? interaction.prospect_id ?? "-"}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-[#77756d]">{qacT(lang, "Date", "Fecha")}</p>
            <p>
              {formatDate(
                interaction.call_started_at ?? interaction.created_at,
              )}
            </p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-[#77756d]">
              {qacT(lang, "Direction / Disposition", "Direccion / Disposicion")}
            </p>
            <p>
              {interaction.direction ?? "-"} / {interaction.disposition ?? "-"}
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title="Audio">
            {audioUrl ? (
              <QacAudioPlayer
                src={audioUrl}
                downloadHref={`${audioUrl}?download=1`}
                cdrDurationSeconds={interaction.duration_seconds}
              />
            ) : (
              <p className="text-sm text-[#77756d]">
                {qacT(
                  lang,
                  "No recording URL available.",
                  "No hay URL de grabacion disponible.",
                )}
              </p>
            )}
          </Panel>

          <Panel title={qacT(lang, "Summary", "Resumen")}>
            {analysis ? (
              <div className="space-y-4 text-sm">
                <p className="text-[#2f2e2a]">
                  {analysis.summary ??
                    qacT(
                      lang,
                      "No summary returned.",
                      "No se devolvio resumen.",
                    )}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#77756d]">
                      {qacT(lang, "Outcome", "Resultado")}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere]">
                      {analysis.call_disposition ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#77756d]">
                      {qacT(lang, "Follow-up", "Seguimiento")}
                    </p>
                    <p>
                      {trackers.follow_up_detected
                        ? qacT(lang, "Detected", "Detectado")
                        : qacT(lang, "Not detected", "No detectado")}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#77756d]">
                    {qacT(lang, "Detected objections", "Objeciones detectadas")}
                  </p>
                  <p>
                    {asStringArray(trackers.detected_objections).join(", ") ||
                      "-"}
                  </p>
                </div>
                {detectedTrackerLabels(analysis.trackers_json).length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#77756d]">
                      {qacT(lang, "Trackers detected", "Trackers detectados")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {detectedTrackerLabels(analysis.trackers_json).map(
                        (tracker) => (
                          <span
                            key={tracker}
                            className="rounded-full border border-[#d8d8d2] bg-white px-2.5 py-1 text-xs font-medium text-[#181816]"
                          >
                            {tracker}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#77756d]">
                    {qacT(lang, "Strengths", "Fortalezas")}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {asStringArray(analysis.strengths_json).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#77756d]">
                    {qacT(lang, "Opportunities", "Oportunidades")}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {asStringArray(analysis.opportunities_json).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#77756d]">
                {qacT(
                  lang,
                  "No analysis saved yet.",
                  "Todavia no hay analisis guardado.",
                )}
              </p>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title={qacT(lang, "Transcript", "Transcripcion")}>
            <form className="mb-3">
              <input type="hidden" name="lang" value={lang} />
              <input
                name="q"
                type="search"
                placeholder={qacT(
                  lang,
                  "Search transcript",
                  "Buscar en transcripcion",
                )}
                defaultValue={String(query["q"] ?? "")}
                className="w-full rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
              />
            </form>
            {filteredSegments.length > 0 ? (
              <div className="h-[360px] min-h-0 space-y-3 overflow-y-auto overscroll-contain rounded-md bg-[#f7f7f5] p-3 pr-2 sm:h-[520px]">
                {filteredSegments.map((segment, index) => (
                  <div key={`${segment.start ?? index}-${index}`}>
                    <div className="mb-1 flex items-center gap-2 text-xs text-[#77756d]">
                      <span className="rounded bg-[#ecece6] px-2 py-0.5 font-semibold uppercase text-[#181816]">
                        {speakerLabel(segment.speaker, interaction)}
                      </span>
                      <span>
                        {formatDuration(Math.round(segment.start ?? 0))}
                      </span>
                    </div>
                    <p className="break-words rounded-md bg-white p-3 text-sm leading-6 text-[#2f2e2a] [overflow-wrap:anywhere]">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : transcriptText ? (
              <div className="h-[360px] min-h-0 overflow-hidden rounded-md bg-[#f7f7f5] sm:h-[520px]">
                <pre className="block h-full overflow-y-auto whitespace-pre-wrap break-words p-3 font-sans text-sm leading-6 text-[#2f2e2a] overscroll-contain [overflow-wrap:anywhere]">
                  {q && !transcriptText.toLowerCase().includes(q)
                    ? qacT(
                        lang,
                        "No transcript matches this search.",
                        "No hay coincidencias en la transcripcion.",
                      )
                    : transcriptText}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-[#77756d]">
                {qacT(
                  lang,
                  "No transcript available.",
                  "No hay transcripcion disponible.",
                )}
              </p>
            )}
          </Panel>

          <Panel title="Scorecard">
            {analysis?.qac_criteria_results?.length ? (
              <div className="space-y-3">
                {analysis.qac_criteria_results.map((result) => (
                  <div
                    key={result.id}
                    className="rounded-md border border-black/15 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#181816]">
                          {result.qac_scorecard_criteria?.name ?? "Criterion"}
                        </p>
                        <p className="text-xs text-[#77756d]">
                          {result.qac_scorecard_criteria?.category ?? "-"} -
                          {qacT(lang, "Weight", "Peso")}{" "}
                          {result.qac_scorecard_criteria?.weight ?? 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge value={result.result} />
                        <span className="text-sm font-semibold">
                          {result.applicable ? percent(result.score) : "N/A"}
                        </span>
                      </div>
                    </div>
                    {result.reason && (
                      <p className="mt-2 text-sm text-[#2f2e2a]">
                        {result.reason}
                      </p>
                    )}
                    {evidence(result.evidence_json).length > 0 && (
                      <div className="mt-2 space-y-2">
                        {evidence(result.evidence_json).map((item, index) => (
                          <blockquote
                            key={`${item.timestamp_seconds ?? index}-${index}`}
                            className="border-l-2 border-[#d8d8d2] pl-3 text-sm text-[#5f5d56]"
                          >
                            {item.timestamp_seconds !== undefined && (
                              <span className="mr-2 text-xs font-medium text-[#77756d]">
                                {formatDuration(item.timestamp_seconds)}
                              </span>
                            )}
                            {item.quote ??
                              qacT(
                                lang,
                                "Evidence saved",
                                "Evidencia guardada",
                              )}
                          </blockquote>
                        ))}
                      </div>
                    )}
                    {result.reviewer_comment && (
                      <p className="mt-2 text-sm text-[#5f5d56]">
                        {qacT(lang, "Reviewer", "Revisor")}:{" "}
                        {result.reviewer_comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#77756d]">
                {qacT(
                  lang,
                  "No scorecard criteria results yet.",
                  "Todavia no hay resultados de criterios del scorecard.",
                )}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </QACShell>
  );
}
