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
    extension: string | null;
    agent_extension: string | null;
    agent_name: string | null;
    is_active: boolean;
  }>;
  qac_agents?: Array<{
    name: string;
    extension: string | null;
    is_active: boolean;
  }>;
  qac_scorecards?: Array<{ name: string; version: number; is_active: boolean }>;
}

export default async function QACDepartmentsPage() {
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const { data } = await admin
    .from("qac_departments")
    .select(
      `id, name, slug, description, qa_prompt, auto_analyze, is_active,
       qac_department_extensions(extension, agent_extension, agent_name, is_active),
       qac_agents(name, extension, is_active),
       qac_scorecards(name, version, is_active)`,
    )
    .eq("workspace_id", access.workspaceId)
    .order("name");

  const departments = (data as DepartmentRow[] | null) ?? [];

  return (
    <QACShell
      active="departments"
      title="Departments"
      description="Each department owns its QA prompt, extensions, agents and active scorecard."
    >
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
