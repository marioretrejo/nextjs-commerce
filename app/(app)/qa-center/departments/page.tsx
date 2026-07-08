import { createDepartmentAction } from "../_actions";
import { QACShell, Panel } from "../_components/QACShell";
import { StatusBadge } from "../_components/StatusBadge";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";

interface DepartmentRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  qa_prompt: string | null;
  auto_analyze: boolean;
  is_active: boolean;
  qac_department_extensions?: Array<{
    department_id?: string;
    extension: string | null;
    agent_extension: string | null;
    agent_name: string | null;
    is_active?: boolean;
  }>;
  qac_agents?: Array<{
    department_id?: string;
    name: string;
    extension: string | null;
    is_active?: boolean;
  }>;
  qac_scorecards?: Array<{
    department_id?: string;
    name: string;
    version: number;
    is_active: boolean;
  }>;
}

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function QACDepartmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const errorMessage = firstParam(params, "error");
  const created = firstParam(params, "created");
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const { data: baseRows } = await admin
    .from("qac_departments")
    .select("id, name, slug, description, qa_prompt, is_active")
    .eq("workspace_id", access.workspaceId)
    .order("name");

  const baseDepartments =
    (baseRows as Array<Omit<DepartmentRow, "auto_analyze">> | null) ?? [];
  const departmentIds = baseDepartments.map((department) => department.id);

  let autoAnalyze = new Map<string, boolean>();
  let extensions: NonNullable<DepartmentRow["qac_department_extensions"]> = [];
  let agents: NonNullable<DepartmentRow["qac_agents"]> = [];
  let scorecards: NonNullable<DepartmentRow["qac_scorecards"]> = [];

  if (departmentIds.length > 0) {
    const autoResult = await admin
      .from("qac_departments")
      .select("id, auto_analyze")
      .eq("workspace_id", access.workspaceId)
      .in("id", departmentIds);
    autoAnalyze = new Map(
      (
        (autoResult.data as Array<{
          id: string;
          auto_analyze?: boolean;
        }> | null) ?? []
      ).map((row) => [row.id, Boolean(row.auto_analyze)]),
    );

    const extResult = await admin
      .from("qac_department_extensions")
      .select(
        "department_id, extension, agent_extension, agent_name, is_active",
      )
      .eq("workspace_id", access.workspaceId)
      .in("department_id", departmentIds);

    if (extResult.error) {
      const fallbackExtResult = await admin
        .from("qac_department_extensions")
        .select("department_id, agent_extension, agent_name")
        .eq("workspace_id", access.workspaceId)
        .in("department_id", departmentIds);
      extensions =
        (fallbackExtResult.data as NonNullable<
          DepartmentRow["qac_department_extensions"]
        > | null) ?? [];
    } else {
      extensions =
        (extResult.data as NonNullable<
          DepartmentRow["qac_department_extensions"]
        > | null) ?? [];
    }

    const agentsResult = await admin
      .from("qac_agents")
      .select("department_id, name, extension, is_active")
      .eq("workspace_id", access.workspaceId)
      .in("department_id", departmentIds);
    agents =
      (agentsResult.data as NonNullable<DepartmentRow["qac_agents"]> | null) ??
      [];

    const scorecardsResult = await admin
      .from("qac_scorecards")
      .select("department_id, name, version, is_active")
      .eq("workspace_id", access.workspaceId)
      .in("department_id", departmentIds);
    scorecards =
      (scorecardsResult.data as NonNullable<
        DepartmentRow["qac_scorecards"]
      > | null) ?? [];
  }

  const departments: DepartmentRow[] = baseDepartments.map((department) => ({
    ...department,
    auto_analyze: autoAnalyze.get(department.id) ?? false,
    qac_department_extensions: extensions.filter(
      (item) => item.department_id === department.id,
    ),
    qac_agents: agents.filter((agent) => agent.department_id === department.id),
    qac_scorecards: scorecards.filter(
      (scorecard) => scorecard.department_id === department.id,
    ),
  }));

  return (
    <QACShell
      active="departments"
      title="Departments"
      description="Each department owns its QA prompt, extensions, agents and active scorecard."
    >
      {(errorMessage || created) && (
        <div
          className={
            errorMessage
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {errorMessage ?? "Departamento creado correctamente."}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel title={`${departments.length} departments`}>
          <div className="grid gap-3">
            {departments.map((department) => {
              const activeScorecard = department.qac_scorecards?.find(
                (scorecard) => scorecard.is_active,
              );
              const extensions = (department.qac_department_extensions ?? [])
                .filter((item) => item.is_active)
                .map((item) => item.extension ?? item.agent_extension)
                .filter(Boolean);
              const agents = (department.qac_agents ?? []).filter(
                (item) => item.is_active,
              );

              return (
                <article
                  key={department.id}
                  className="rounded-lg border border-[#eeeeea] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[#181816]">
                        {department.name}
                      </h2>
                      <p className="text-sm text-[#77756d]">
                        {department.slug}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge
                        value={department.is_active ? "active" : "inactive"}
                      />
                      <StatusBadge
                        value={
                          department.auto_analyze
                            ? "auto analyze"
                            : "manual analysis"
                        }
                      />
                    </div>
                  </div>
                  {department.description && (
                    <p className="mt-3 text-sm text-[#2f2e2a]">
                      {department.description}
                    </p>
                  )}
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#77756d]">
                        Extensions
                      </p>
                      <p className="mt-1 text-sm">
                        {extensions.join(", ") || "None"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#77756d]">
                        Agents
                      </p>
                      <p className="mt-1 text-sm">
                        {agents.map((agent) => agent.name).join(", ") || "None"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#77756d]">
                        Active scorecard
                      </p>
                      <p className="mt-1 text-sm">
                        {activeScorecard
                          ? `${activeScorecard.name} v${activeScorecard.version}`
                          : "None"}
                      </p>
                    </div>
                  </div>
                  {department.qa_prompt && (
                    <div className="mt-4 rounded-md bg-[#f7f7f5] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#77756d]">
                        QA prompt
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#2f2e2a]">
                        {department.qa_prompt}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
            {departments.length === 0 && (
              <p className="py-8 text-center text-sm text-[#77756d]">
                No departments configured yet.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Create department">
          <form action={createDepartmentAction} className="space-y-3">
            <input
              name="name"
              required
              placeholder="Name"
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <input
              name="slug"
              placeholder="Slug"
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <textarea
              name="description"
              placeholder="Description"
              rows={3}
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <textarea
              name="extensions"
              placeholder="Assigned extensions, one per line"
              rows={3}
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <textarea
              name="qa_prompt"
              placeholder="Department QA prompt"
              rows={5}
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input name="auto_analyze" type="checkbox" className="h-4 w-4" />
              Auto analyze imported calls
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked
                className="h-4 w-4"
              />
              Active
            </label>
            <button className="w-full rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
              Create department
            </button>
          </form>
        </Panel>
      </div>
    </QACShell>
  );
}
