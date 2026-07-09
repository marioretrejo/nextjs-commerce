import type { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedCdrCall } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

interface DepartmentRow {
  id: string;
  name: string;
  slug: string;
  qa_prompt: string | null;
}

interface AgentRow {
  id: string;
  name: string;
  extension: string | null;
  department_id: string | null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function findQacDepartment(
  admin: Admin,
  workspaceId: string,
  cdr: Pick<
    NormalizedCdrCall,
    "department_name" | "agent_extension" | "agent_name" | "external_agent_id"
  >,
): Promise<DepartmentRow | null> {
  const departmentCandidates = cdr.department_name
    ? [
        cdr.department_name,
        ...cdr.department_name
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .reverse(),
      ]
    : [];

  for (const departmentName of [...new Set(departmentCandidates)]) {
    const slug = slugify(departmentName);
    const { data: bySlug } = await admin
      .from("qac_departments")
      .select("id, name, slug, qa_prompt")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .eq("slug", slug)
      .maybeSingle();
    if (bySlug) return bySlug as DepartmentRow;

    const { data: byName } = await admin
      .from("qac_departments")
      .select("id, name, slug, qa_prompt")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .ilike("name", departmentName)
      .maybeSingle();
    if (byName) return byName as DepartmentRow;
  }

  if (cdr.agent_extension) {
    const { data: ext } = await admin
      .from("qac_department_extensions")
      .select("qac_departments(id, name, slug, qa_prompt)")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .or(
        `extension.eq.${cdr.agent_extension},agent_extension.eq.${cdr.agent_extension}`,
      )
      .limit(1)
      .maybeSingle();
    const nested = (ext as { qac_departments?: DepartmentRow | null } | null)
      ?.qac_departments;
    if (nested) return nested;
  }

  const agent = await findQacAgent(admin, workspaceId, cdr);
  if (agent?.department_id) {
    const { data } = await admin
      .from("qac_departments")
      .select("id, name, slug, qa_prompt")
      .eq("workspace_id", workspaceId)
      .eq("id", agent.department_id)
      .eq("is_active", true)
      .maybeSingle();
    return (data as DepartmentRow | null) ?? null;
  }

  return null;
}

export async function findQacAgent(
  admin: Admin,
  workspaceId: string,
  cdr: Pick<
    NormalizedCdrCall,
    "agent_extension" | "agent_name" | "external_agent_id"
  >,
): Promise<AgentRow | null> {
  if (cdr.external_agent_id) {
    const { data } = await admin
      .from("qac_agents")
      .select("id, name, extension, department_id")
      .eq("workspace_id", workspaceId)
      .eq("external_agent_id", cdr.external_agent_id)
      .maybeSingle();
    if (data) return data as AgentRow;
  }

  if (cdr.agent_extension) {
    const { data } = await admin
      .from("qac_agents")
      .select("id, name, extension, department_id")
      .eq("workspace_id", workspaceId)
      .eq("extension", cdr.agent_extension)
      .maybeSingle();
    if (data) return data as AgentRow;
  }

  if (cdr.agent_name) {
    const { data } = await admin
      .from("qac_agents")
      .select("id, name, extension, department_id")
      .eq("workspace_id", workspaceId)
      .ilike("name", cdr.agent_name)
      .maybeSingle();
    if (data) return data as AgentRow;
  }

  return null;
}

export async function findOrCreateQacAgent(
  admin: Admin,
  workspaceId: string,
  cdr: Pick<
    NormalizedCdrCall,
    "agent_extension" | "agent_name" | "external_agent_id" | "agent_email"
  >,
  departmentId: string | null,
): Promise<AgentRow | null> {
  const existing = await findQacAgent(admin, workspaceId, cdr);
  if (existing) {
    if (departmentId && !existing.department_id) {
      await admin
        .from("qac_agents")
        .update({ department_id: departmentId })
        .eq("id", existing.id);
      return { ...existing, department_id: departmentId };
    }
    return existing;
  }

  if (!cdr.agent_name && !cdr.agent_extension && !cdr.external_agent_id) {
    return null;
  }

  const displayName =
    cdr.agent_name ??
    (cdr.agent_extension
      ? `Extension ${cdr.agent_extension}`
      : "Unknown Agent");

  const { data } = await admin
    .from("qac_agents")
    .insert({
      workspace_id: workspaceId,
      name: displayName,
      email: cdr.agent_email,
      extension: cdr.agent_extension,
      external_agent_id: cdr.external_agent_id,
      department_id: departmentId,
      is_active: true,
    })
    .select("id, name, extension, department_id")
    .single();

  return (data as AgentRow | null) ?? null;
}
