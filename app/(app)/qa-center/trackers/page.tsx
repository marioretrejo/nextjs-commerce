import {
  createTrackerAction,
  deleteTrackerAction,
  updateTrackerAction,
} from "../_actions";
import { QACShell, Panel } from "../_components/QACShell";
import { StatusBadge } from "../_components/StatusBadge";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";

interface DepartmentRow {
  id: string;
  name: string;
}

interface TrackerRow {
  id: string;
  department_id: string | null;
  name: string;
  name_es: string | null;
  description: string;
  description_es: string | null;
  positive_examples_json: unknown;
  action_config_json: unknown;
  severity: string;
  risk_level_override: string | null;
  trigger_manual_review: boolean;
  is_active: boolean;
  is_system: boolean;
  qac_departments?: { name: string | null } | null;
}

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function languageOf(params: Record<string, string | string[] | undefined>) {
  return firstParam(params, "lang") === "es" ? "es" : "en";
}

function ui(lang: "en" | "es", en: string, es: string): string {
  return lang === "es" ? es : en;
}

function examples(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function actionFlag(value: unknown, key: string, fallback = false): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  return Boolean((value as Record<string, unknown>)[key]);
}

function trackerName(tracker: TrackerRow, lang: "en" | "es"): string {
  return lang === "es" ? (tracker.name_es ?? tracker.name) : tracker.name;
}

function trackerDescription(tracker: TrackerRow, lang: "en" | "es"): string {
  return lang === "es"
    ? (tracker.description_es ?? tracker.description)
    : tracker.description;
}

export default async function QACTrackersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const lang = languageOf(params);
  const created = firstParam(params, "created");
  const deleted = firstParam(params, "deleted");
  const updated = firstParam(params, "updated");
  const errorMessage = firstParam(params, "error");
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const [departmentsResult, trackersResult] = await Promise.all([
    admin
      .from("qac_departments")
      .select("id, name")
      .eq("workspace_id", access.workspaceId)
      .eq("is_active", true)
      .order("name"),
    admin
      .from("qac_trackers")
      .select(
        `id, department_id, name, name_es, description, description_es,
         positive_examples_json, action_config_json, severity, risk_level_override,
         trigger_manual_review, is_active, is_system,
         qac_departments(name)`,
      )
      .eq("workspace_id", access.workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  const migrationMissing =
    trackersResult.error?.message.includes("qac_trackers") ||
    trackersResult.error?.message.includes("schema cache");
  const departments = (departmentsResult.data as DepartmentRow[] | null) ?? [];
  const trackers = migrationMissing
    ? []
    : ((trackersResult.data as TrackerRow[] | null) ?? []);

  return (
    <QACShell
      active="trackers"
      title="AI Trackers"
      description={ui(
        lang,
        "No-code detectors for objections, risk, intent and operational signals. Trackers do not directly change score.",
        "Detectores sin codigo para objeciones, riesgo, intencion y señales operativas. Los trackers no cambian directamente el score.",
      )}
      isSuperadmin={access.isSuperadmin}
      lang={lang}
    >
      {(created || deleted || updated || errorMessage || migrationMissing) && (
        <div
          className={
            errorMessage || migrationMissing
              ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {migrationMissing
            ? ui(
                lang,
                "Apply Supabase migration 084_qac_trackers.sql to enable tracker storage.",
                "Aplica la migracion de Supabase 084_qac_trackers.sql para activar el almacenamiento de trackers.",
              )
            : (errorMessage ??
              (deleted
                ? ui(lang, "Tracker deleted.", "Tracker eliminado.")
                : updated
                  ? ui(lang, "Tracker updated.", "Tracker actualizado.")
                  : ui(lang, "Tracker created.", "Tracker creado.")))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Panel title={`${trackers.length} trackers`}>
          <div className="grid gap-3">
            {trackers.map((tracker) => (
              <article
                key={tracker.id}
                className="rounded-lg border border-black/15 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#181816]">
                      {trackerName(tracker, lang)}
                    </h2>
                    <p className="text-sm text-[#77756d]">
                      {tracker.qac_departments?.name ??
                        ui(lang, "All departments", "Todos los departamentos")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge lang={lang} value={tracker.severity} />
                    <StatusBadge
                      lang={lang}
                      value={tracker.is_active ? "active" : "inactive"}
                    />
                    {tracker.trigger_manual_review && (
                      <StatusBadge lang={lang} value="manual review" />
                    )}
                    {access.isAdmin && (
                      <div className="flex flex-wrap gap-2">
                        <details>
                          <summary className="inline-flex cursor-pointer rounded-md border border-black/20 px-2.5 py-1 text-xs font-medium text-[#181816] hover:bg-[#f7f7f5]">
                            {ui(lang, "Edit", "Editar")}
                          </summary>
                          <form
                            action={updateTrackerAction}
                            className="mt-3 grid min-w-[340px] gap-3 rounded-md border border-black/15 bg-[#fbfbfa] p-3 md:grid-cols-2"
                          >
                            <input type="hidden" name="id" value={tracker.id} />
                            <input type="hidden" name="lang" value={lang} />
                            <select
                              name="department_id"
                              defaultValue={tracker.department_id ?? ""}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm md:col-span-2"
                            >
                              <option value="">
                                {ui(
                                  lang,
                                  "All departments",
                                  "Todos los departamentos",
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
                            <input
                              name="name"
                              required
                              defaultValue={tracker.name}
                              placeholder={ui(lang, "Name", "Nombre")}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            />
                            <input
                              name="name_es"
                              defaultValue={tracker.name_es ?? ""}
                              placeholder="Nombre en español"
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            />
                            <textarea
                              name="description"
                              required
                              defaultValue={tracker.description}
                              placeholder={ui(
                                lang,
                                "Description",
                                "Descripcion",
                              )}
                              rows={3}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            />
                            <textarea
                              name="description_es"
                              defaultValue={tracker.description_es ?? ""}
                              placeholder="Descripcion en español"
                              rows={3}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            />
                            <textarea
                              name="positive_examples"
                              defaultValue={examples(
                                tracker.positive_examples_json,
                              ).join("\n")}
                              placeholder={ui(
                                lang,
                                "Positive examples, one per line",
                                "Ejemplos positivos, uno por linea",
                              )}
                              rows={3}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm md:col-span-2"
                            />
                            <select
                              name="severity"
                              defaultValue={tracker.severity}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            >
                              {[
                                "info",
                                "low",
                                "medium",
                                "high",
                                "critical",
                              ].map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                            <select
                              name="risk_level_override"
                              defaultValue={tracker.risk_level_override ?? ""}
                              className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
                            >
                              <option value="">No risk override</option>
                              {["low", "medium", "high", "critical"].map(
                                (item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ),
                              )}
                            </select>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                name="mark_call"
                                type="checkbox"
                                defaultChecked={actionFlag(
                                  tracker.action_config_json,
                                  "mark_call",
                                  true,
                                )}
                              />
                              {ui(lang, "Mark call", "Marcar llamada")}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                name="trigger_manual_review"
                                type="checkbox"
                                defaultChecked={tracker.trigger_manual_review}
                              />
                              {ui(
                                lang,
                                "Require manual review",
                                "Requiere revision manual",
                              )}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                name="send_alert"
                                type="checkbox"
                                defaultChecked={actionFlag(
                                  tracker.action_config_json,
                                  "send_alert",
                                )}
                              />
                              {ui(lang, "Send alert", "Enviar alerta")}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                name="is_active"
                                type="checkbox"
                                defaultChecked={tracker.is_active}
                              />
                              {ui(lang, "Active", "Activo")}
                            </label>
                            <button className="rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white md:col-span-2">
                              {ui(lang, "Save changes", "Guardar cambios")}
                            </button>
                          </form>
                        </details>
                        <form action={deleteTrackerAction}>
                          <input type="hidden" name="id" value={tracker.id} />
                          <button className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                            {ui(lang, "Delete", "Eliminar")}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#2f2e2a]">
                  {trackerDescription(tracker, lang)}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-[#5f5d56] md:grid-cols-2">
                  <p>
                    <span className="font-semibold">
                      {ui(lang, "Risk override:", "Override de riesgo:")}
                    </span>{" "}
                    {tracker.risk_level_override ?? "-"}
                  </p>
                  <p>
                    <span className="font-semibold">
                      {ui(lang, "Examples:", "Ejemplos:")}
                    </span>{" "}
                    {examples(tracker.positive_examples_json).join(" / ") ||
                      "-"}
                  </p>
                </div>
              </article>
            ))}
            {trackers.length === 0 && !migrationMissing && (
              <p className="py-8 text-center text-sm text-[#77756d]">
                {ui(
                  lang,
                  "No trackers configured yet.",
                  "No hay trackers configurados.",
                )}
              </p>
            )}
          </div>
        </Panel>

        <Panel title={ui(lang, "Create tracker", "Crear tracker")}>
          <form action={createTrackerAction} className="space-y-3">
            <select
              name="department_id"
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            >
              <option value="">
                {ui(lang, "All departments", "Todos los departamentos")}
              </option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <input
              name="name"
              required
              placeholder={ui(lang, "Name", "Nombre")}
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <input
              name="name_es"
              placeholder="Nombre en español"
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <textarea
              name="description"
              required
              placeholder={ui(lang, "Description", "Descripcion")}
              rows={3}
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <textarea
              name="description_es"
              placeholder="Descripcion en español"
              rows={3}
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <textarea
              name="positive_examples"
              placeholder={ui(
                lang,
                "Positive examples, one per line",
                "Ejemplos positivos, uno por linea",
              )}
              rows={3}
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                name="severity"
                defaultValue="info"
                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              >
                {["info", "low", "medium", "high", "critical"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                name="risk_level_override"
                className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
              >
                <option value="">No risk override</option>
                {["low", "medium", "high", "critical"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="mark_call" type="checkbox" defaultChecked />
              {ui(lang, "Mark call", "Marcar llamada")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="trigger_manual_review" type="checkbox" />
              {ui(lang, "Require manual review", "Requiere revision manual")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="send_alert" type="checkbox" />
              {ui(lang, "Send alert", "Enviar alerta")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked
                className="h-4 w-4"
              />
              {ui(lang, "Active", "Activo")}
            </label>
            <button className="w-full rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
              {ui(lang, "Create tracker", "Crear tracker")}
            </button>
          </form>
        </Panel>
      </div>
    </QACShell>
  );
}
