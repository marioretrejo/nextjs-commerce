import { triggerQacAnalysisAction } from "./_actions";
import { QACShell, MetricTile, Panel } from "./_components/QACShell";
import { StatusBadge } from "./_components/StatusBadge";
import { formatDate, formatDuration, percent } from "./_components/format";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AlertTriangle,
  AudioLines,
  Calendar,
  Download,
  Headphones,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

interface TranscriptSegment {
  speaker?: string;
  start?: number;
  text?: string;
}

interface DashboardInteraction {
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
  qac_transcripts?: Array<{
    full_text: string;
    diarized_json: unknown;
    provider: string | null;
  }>;
  qac_analyses?: Array<{
    id: string;
    overall_score: number | null;
    sentiment: string | null;
    risk_level: string | null;
    call_disposition: string | null;
    summary: string | null;
    strengths_json: unknown;
    opportunities_json: unknown;
    recommendations_json: unknown;
    trackers_json: unknown;
    qac_criteria_results?: Array<{
      result: string;
      score: number | null;
      reason: string | null;
      qac_scorecard_criteria?: {
        name: string | null;
        category: string | null;
        weight: number | null;
      } | null;
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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function segments(value: unknown): TranscriptSegment[] {
  return Array.isArray(value)
    ? value.filter((item): item is TranscriptSegment =>
        Boolean(item && typeof item === "object"),
      )
    : [];
}

function selectedHref(
  params: Record<string, string | string[] | undefined>,
  selected: string,
): string {
  const search = new URLSearchParams();
  for (const key of [
    "q",
    "provider",
    "department",
    "agent",
    "status",
    "from",
    "to",
  ]) {
    const value = valueOf(params, key);
    if (value) search.set(key, value);
  }
  search.set("selected", selected);
  return `/qa-center?${search.toString()}`;
}

function riskClass(risk: string | null | undefined): string {
  if (risk === "critical" || risk === "high") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (risk === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function scoreColor(score: number | null | undefined): string {
  const value = Number(score ?? 0);
  if (value >= 85) return "#16a34a";
  if (value >= 70) return "#d99a0b";
  return "#dc2626";
}

function waveform(seed: string): number[] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }
  return Array.from({ length: 48 }, (_, index) => {
    hash = (hash * 37 + index * 17) % 997;
    return 18 + (hash % 42);
  });
}

export default async function QACenterDashboardPage({
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
      .eq("is_active", true)
      .order("name"),
    admin
      .from("qac_departments")
      .select("id, name")
      .eq("workspace_id", access.workspaceId)
      .eq("is_active", true)
      .order("name"),
    admin
      .from("qac_agents")
      .select("id, name, extension")
      .eq("workspace_id", access.workspaceId)
      .eq("is_active", true)
      .order("name"),
  ]);

  let query = admin
    .from("qac_interactions")
    .select(
      `id, external_call_id, caller_id, prospect_id, recording_url,
       internal_audio_url, duration_seconds, direction, disposition,
       call_started_at, created_at, status, review_status,
       qac_voip_providers(id, name),
       qac_agents(id, name, extension),
       qac_departments(id, name),
       qac_transcripts(full_text, diarized_json, provider),
       qac_analyses(
        id, overall_score, sentiment, risk_level, call_disposition, summary,
        strengths_json, opportunities_json, recommendations_json, trackers_json,
        qac_criteria_results(
          result, score, reason,
          qac_scorecard_criteria(name, category, weight)
        )
       )`,
    )
    .eq("workspace_id", access.workspaceId)
    .order("call_started_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(75);

  const provider = valueOf(params, "provider");
  const department = valueOf(params, "department");
  const agent = valueOf(params, "agent");
  const status = valueOf(params, "status");
  const from = valueOf(params, "from");
  const to = valueOf(params, "to");
  const search = valueOf(params, "q").toLowerCase();

  if (provider) query = query.eq("provider_id", provider);
  if (department) query = query.eq("department_id", department);
  if (agent) query = query.eq("agent_id", agent);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("call_started_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("call_started_at", `${to}T23:59:59.999Z`);

  const { data } = await query;
  let interactions = (data as DashboardInteraction[] | null) ?? [];

  if (search) {
    interactions = interactions.filter((interaction) =>
      [
        interaction.external_call_id,
        interaction.caller_id,
        interaction.prospect_id,
        interaction.qac_agents?.name,
        interaction.qac_agents?.extension,
        interaction.qac_departments?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }

  const selected =
    interactions.find(
      (interaction) => interaction.id === valueOf(params, "selected"),
    ) ?? interactions[0];
  const selectedAnalysis = selected?.qac_analyses?.[0];
  const selectedTranscript = selected?.qac_transcripts?.[0];
  const selectedSegments = segments(selectedTranscript?.diarized_json).slice(
    0,
    8,
  );
  const selectedAudioUrl =
    selected?.internal_audio_url ?? selected?.recording_url ?? null;
  const selectedScore = selectedAnalysis?.overall_score ?? null;
  const scores = interactions
    .map((interaction) => interaction.qac_analyses?.[0]?.overall_score)
    .filter((score): score is number => score !== null && score !== undefined);
  const averageScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, score) => sum + score, 0) / scores.length,
        )
      : null;
  const needsReview = interactions.filter(
    (interaction) =>
      interaction.status === "manual_review_required" ||
      interaction.status.startsWith("failed") ||
      interaction.review_status === "in_review",
  ).length;
  const analyzed = interactions.filter(
    (interaction) => interaction.status === "analyzed",
  ).length;

  return (
    <QACShell
      active="dashboard"
      title="Dashboard"
      description="Call monitoring with recordings, downloads, transcript and GROQ QA analysis."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Calls" value={interactions.length} />
        <MetricTile label="Analyzed" value={analyzed} />
        <MetricTile label="Average QA score" value={percent(averageScore)} />
        <MetricTile label="Needs review" value={needsReview} />
      </div>

      <Panel title="Segments">
        <form className="grid gap-3 lg:grid-cols-[1.5fr_repeat(6,minmax(0,1fr))_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#77756d]" />
            <input
              name="q"
              type="search"
              placeholder="Search calls, agents, clients..."
              defaultValue={valueOf(params, "q")}
              className="w-full rounded-md border border-[#d8d8d2] bg-white py-2 pl-9 pr-3 text-sm"
            />
          </label>
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
            <option value="">Status</option>
            {[
              "audio_ready",
              "transcribing",
              "analyzing",
              "analyzed",
              "manual_review_required",
              "failed_audio",
              "failed_transcription",
              "failed_analysis",
            ].map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <label className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#77756d]" />
            <input
              name="from"
              type="date"
              defaultValue={from}
              className="w-full rounded-md border border-[#d8d8d2] bg-white py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-md border border-[#d8d8d2] bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-[#181816] px-4 py-2 text-sm font-medium text-white">
            Apply
          </button>
        </form>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)_360px]">
        <Panel title={`Recent calls (${interactions.length})`}>
          <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
            {interactions.map((interaction) => {
              const analysis = interaction.qac_analyses?.[0];
              const isSelected = selected?.id === interaction.id;
              return (
                <Link
                  key={interaction.id}
                  href={selectedHref(params, interaction.id)}
                  className={`block rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-[#181816] bg-[#fbfbfa]"
                      : "border-[#eeeeea] bg-white hover:border-[#cfcfc8]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#181816] text-white">
                        <Headphones className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#181816]">
                          {interaction.qac_agents?.name ??
                            interaction.external_call_id ??
                            "Unassigned call"}
                        </p>
                        <p className="truncate text-xs text-[#77756d]">
                          {interaction.qac_departments?.name ?? "No department"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#d8d8d2] px-2 py-1 text-xs font-semibold text-[#181816]">
                      {percent(analysis?.overall_score)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#77756d]">
                    <span>{interaction.direction ?? "call"}</span>
                    <span>{formatDuration(interaction.duration_seconds)}</span>
                    <span>
                      {formatDate(
                        interaction.call_started_at ?? interaction.created_at,
                      )}
                    </span>
                  </div>
                  <div className="mt-2">
                    <StatusBadge value={interaction.status} />
                  </div>
                </Link>
              );
            })}
            {interactions.length === 0 && (
              <p className="py-10 text-center text-sm text-[#77756d]">
                No calls match these filters.
              </p>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title={
              selected
                ? (selected.qac_agents?.name ??
                  selected.external_call_id ??
                  "Call detail")
                : "Call detail"
            }
            action={
              selected ? (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/qa-center/interactions/${selected.id}`}
                    className="rounded-md border border-[#d8d8d2] px-3 py-1.5 text-sm font-medium text-[#181816]"
                  >
                    Detail
                  </Link>
                  <form action={triggerQacAnalysisAction}>
                    <input
                      type="hidden"
                      name="interaction_id"
                      value={selected.id}
                    />
                    <button className="rounded-md bg-[#181816] px-3 py-1.5 text-sm font-medium text-white">
                      Analyze
                    </button>
                  </form>
                </div>
              ) : null
            }
          >
            {selected ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex items-center gap-2 rounded-md bg-[#f7f7f5] p-3 text-sm">
                    <Users className="h-4 w-4 text-[#77756d]" />
                    <span>{selected.qac_departments?.name ?? "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-[#f7f7f5] p-3 text-sm">
                    <TrendingUp className="h-4 w-4 text-[#77756d]" />
                    <span>{selected.direction ?? "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-[#f7f7f5] p-3 text-sm">
                    <ShieldCheck className="h-4 w-4 text-[#77756d]" />
                    <span>{selected.disposition ?? "No disposition"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-[#eeeeea] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1f5bd8] text-white">
                      <AudioLines className="h-5 w-5" />
                    </span>
                    <div className="flex h-14 flex-1 items-center gap-1 overflow-hidden">
                      {waveform(selected.external_call_id ?? selected.id).map(
                        (height, index) => (
                          <span
                            key={`${selected.id}-${index}`}
                            className="w-1 rounded-full bg-[#1f5bd8]"
                            style={{ height }}
                          />
                        ),
                      )}
                    </div>
                    <span className="text-sm font-medium text-[#77756d]">
                      {formatDuration(selected.duration_seconds)}
                    </span>
                  </div>
                  {selectedAudioUrl ? (
                    <div className="mt-4 space-y-3">
                      <audio controls className="w-full" src={selectedAudioUrl}>
                        <track kind="captions" />
                      </audio>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={selectedAudioUrl}
                          download
                          className="inline-flex items-center gap-2 rounded-md border border-[#d8d8d2] px-3 py-2 text-sm font-medium text-[#181816]"
                        >
                          <Download className="h-4 w-4" />
                          Download recording
                        </a>
                        <span className="break-all text-xs text-[#77756d]">
                          {selected.external_call_id ?? selected.id}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[#77756d]">
                      No recording URL available.
                    </p>
                  )}
                </div>

                <section className="border-t border-[#eeeeea] pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[#181816]">
                      Transcript
                    </h2>
                    <StatusBadge value={selected.review_status} />
                  </div>
                  {selectedSegments.length > 0 ? (
                    <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                      {selectedSegments.map((segment, index) => (
                        <div key={`${segment.start ?? index}-${index}`}>
                          <div className="mb-1 flex items-center gap-2 text-xs text-[#77756d]">
                            <span className="font-semibold uppercase">
                              {segment.speaker ?? "Speaker"}
                            </span>
                            <span>
                              {formatDuration(Math.round(segment.start ?? 0))}
                            </span>
                          </div>
                          <p className="rounded-md bg-[#f7f7f5] p-3 text-sm leading-6 text-[#2f2e2a]">
                            {segment.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : selectedTranscript?.full_text ? (
                    <pre className="max-h-[420px] whitespace-pre-wrap rounded-md bg-[#f7f7f5] p-3 text-sm leading-6 text-[#2f2e2a]">
                      {selectedTranscript.full_text}
                    </pre>
                  ) : (
                    <p className="text-sm text-[#77756d]">
                      No transcript available yet.
                    </p>
                  )}
                </section>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-[#77756d]">
                Select a call to inspect.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="GROQ QA score"
            action={
              selectedAnalysis?.risk_level ? (
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClass(
                    selectedAnalysis.risk_level,
                  )}`}
                >
                  {selectedAnalysis.risk_level.replace(/_/g, " ")} risk
                </span>
              ) : null
            }
          >
            {selected ? (
              <div className="space-y-5">
                <div className="grid place-items-center">
                  <div
                    className="grid h-40 w-40 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(${scoreColor(
                        selectedScore,
                      )} ${Number(selectedScore ?? 0) * 3.6}deg, #ecece6 0deg)`,
                    }}
                  >
                    <div className="grid h-28 w-28 place-items-center rounded-full bg-white">
                      <div className="text-center">
                        <p className="text-4xl font-semibold text-[#181816]">
                          {selectedScore !== null
                            ? Math.round(Number(selectedScore))
                            : "-"}
                        </p>
                        <p className="text-sm text-[#77756d]">/100</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#77756d]">Sentiment</span>
                    <span className="font-medium text-[#181816]">
                      {selectedAnalysis?.sentiment ?? "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#77756d]">Outcome</span>
                    <span className="font-medium text-[#181816]">
                      {selectedAnalysis?.call_disposition ?? "-"}
                    </span>
                  </div>
                </div>

                {selectedAnalysis?.summary ? (
                  <div className="rounded-md bg-[#f7f7f5] p-3 text-sm leading-6 text-[#2f2e2a]">
                    {selectedAnalysis.summary}
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Pending analysis
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#77756d]">No selected call.</p>
            )}
          </Panel>

          <Panel title="Category breakdown">
            {selectedAnalysis?.qac_criteria_results?.length ? (
              <div className="space-y-3">
                {selectedAnalysis.qac_criteria_results
                  .slice(0, 7)
                  .map((result, index) => {
                    const score = Number(result.score ?? 0);
                    return (
                      <div
                        key={`${result.qac_scorecard_criteria?.name}-${index}`}
                      >
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="truncate text-[#2f2e2a]">
                            {result.qac_scorecard_criteria?.name ?? "Criterion"}
                          </span>
                          <span className="font-medium">
                            {result.result === "n/a"
                              ? "N/A"
                              : percent(result.score)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#ecece6]">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, score))}%`,
                              backgroundColor: scoreColor(score),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-[#77756d]">
                No scorecard criteria results yet.
              </p>
            )}
          </Panel>

          <Panel title="Coaching notes">
            {selectedAnalysis ? (
              <div className="space-y-4 text-sm">
                <div>
                  <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-700">
                    <Sparkles className="h-4 w-4" />
                    Strengths
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-[#2f2e2a]">
                    {asStringArray(selectedAnalysis.strengths_json)
                      .slice(0, 3)
                      .map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2 font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    Opportunities
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-[#2f2e2a]">
                    {asStringArray(selectedAnalysis.opportunities_json)
                      .slice(0, 3)
                      .map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                  </ul>
                </div>
                {asStringArray(selectedAnalysis.recommendations_json)[0] && (
                  <div className="rounded-md bg-[#f7f7f5] p-3 text-[#2f2e2a]">
                    {asStringArray(selectedAnalysis.recommendations_json)[0]}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#77756d]">No coaching notes yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </QACShell>
  );
}
