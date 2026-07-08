"use server";

import { requireQacAccess } from "@/lib/qac/access";
import { processQacInteraction } from "@/lib/qac/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
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

function numberValue(formData: FormData, key: string, fallback = 0): number {
  const raw = text(formData, key);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function departmentsUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `/qa-center/departments?${search.toString()}`;
}

function departmentErrorMessage(message?: string): string {
  const raw = message ?? "";
  if (
    raw.includes("duplicate key") ||
    raw.includes("qac_departments_workspace_id_slug")
  ) {
    return "Ya existe un departamento con ese nombre o slug.";
  }
  if (
    raw.includes("auto_analyze") ||
    raw.includes("Could not find") ||
    raw.includes("schema cache")
  ) {
    return "El departamento se intento crear, pero la base de datos necesita la migracion 082 de QA Center.";
  }
  return raw || "No se pudo crear el departamento.";
}

function missingColumn(errorMessage?: string | null, column?: string): boolean {
  const message = errorMessage ?? "";
  return Boolean(
    column &&
      (message.includes(column) ||
        message.includes("Could not find") ||
        message.includes("schema cache")),
  );
}

export async function createDepartmentAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const name = text(formData, "name");
  if (!name) {
    redirect(departmentsUrl({ error: "Escribe el nombre del departamento." }));
  }

  const slug = text(formData, "slug") ?? slugify(name);
  const payload = {
    workspace_id: access.workspaceId,
    name,
    slug,
    description: text(formData, "description"),
    qa_prompt: text(formData, "qa_prompt"),
    auto_analyze: checkbox(formData, "auto_analyze"),
    is_active: checkbox(formData, "is_active"),
  };

  let result = await admin
    .from("qac_departments")
    .insert(payload)
    .select("id")
    .single();

  if (missingColumn(result.error?.message, "auto_analyze")) {
    const fallbackPayload = {
      workspace_id: access.workspaceId,
      name,
      slug,
      description: text(formData, "description"),
      qa_prompt: text(formData, "qa_prompt"),
      is_active: checkbox(formData, "is_active"),
    };
    result = await admin
      .from("qac_departments")
      .insert(fallbackPayload)
      .select("id")
      .single();
  }

  const { data: dept, error } = result;
  if (error || !dept) {
    redirect(
      departmentsUrl({
        error: departmentErrorMessage(error?.message),
      }),
    );
  }

  const extensions = (text(formData, "extensions") ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (extensions.length > 0) {
    const rows = extensions.map((extension) => ({
      workspace_id: access.workspaceId,
      department_id: (dept as { id: string }).id,
      extension,
      agent_extension: extension,
      is_active: true,
    }));
    const extResult = await admin
      .from("qac_department_extensions")
      .insert(rows);

    if (missingColumn(extResult.error?.message, "extension")) {
      await admin.from("qac_department_extensions").insert(
        extensions.map((extension) => ({
          workspace_id: access.workspaceId,
          department_id: (dept as { id: string }).id,
          agent_extension: extension,
        })),
      );
    } else if (missingColumn(extResult.error?.message, "is_active")) {
      await admin.from("qac_department_extensions").insert(
        extensions.map((extension) => ({
          workspace_id: access.workspaceId,
          department_id: (dept as { id: string }).id,
          extension,
          agent_extension: extension,
        })),
      );
    } else if (extResult.error) {
      console.error(
        "[qac-departments] extension insert failed:",
        extResult.error.message,
      );
    }
  }

  revalidatePath("/qa-center/departments");
  revalidatePath("/qa-center");
  redirect(
    departmentsUrl({
      created: "1",
    }),
  );
}

export async function createProviderAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const name = text(formData, "name");
  if (!name) return;

  const type = text(formData, "type") ?? "generic";
  const slug = text(formData, "slug") ?? slugify(name);
  const secret =
    text(formData, "webhook_secret") ??
    `qac_${randomBytes(24).toString("base64url")}`;

  const { error } = await admin.from("qac_voip_providers").insert({
    workspace_id: access.workspaceId,
    name,
    slug,
    type,
    webhook_secret: secret,
    config_json: {
      auto_analyze: checkbox(formData, "auto_analyze"),
    },
    is_active: checkbox(formData, "is_active"),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/providers");
  revalidatePath("/qa-center/settings");
}

export async function createScorecardAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const departmentId = text(formData, "department_id");
  const name = text(formData, "name");
  if (!departmentId || !name) return;

  const isActive = checkbox(formData, "is_active");
  if (isActive) {
    await admin
      .from("qac_scorecards")
      .update({ is_active: false })
      .eq("workspace_id", access.workspaceId)
      .eq("department_id", departmentId);
  }

  const { error } = await admin.from("qac_scorecards").insert({
    workspace_id: access.workspaceId,
    department_id: departmentId,
    name,
    version: numberValue(formData, "version", 1),
    is_active: isActive,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/scorecards");
  revalidatePath("/qa-center/departments");
}

export async function createCriterionAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const scorecardId = text(formData, "scorecard_id");
  const name = text(formData, "name");
  if (!scorecardId || !name) return;

  const { data: scorecard } = await admin
    .from("qac_scorecards")
    .select("id")
    .eq("id", scorecardId)
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();

  if (!scorecard) throw new Error("Scorecard not found");

  const examples = (text(formData, "examples") ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const { error } = await admin.from("qac_scorecard_criteria").insert({
    workspace_id: access.workspaceId,
    scorecard_id: scorecardId,
    category: text(formData, "category") ?? "Quality",
    name,
    description: text(formData, "description"),
    weight: numberValue(formData, "weight", 0),
    is_critical: checkbox(formData, "is_critical"),
    applicability_rule: text(formData, "applicability_rule"),
    pass_definition: text(formData, "pass_definition"),
    partial_definition: text(formData, "partial_definition"),
    fail_definition: text(formData, "fail_definition"),
    na_definition: text(formData, "na_definition"),
    examples_json: examples,
    sort_order: numberValue(formData, "sort_order", 0),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/scorecards");
}

export async function deleteAgentAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const id = text(formData, "id");
  if (!id) return;

  const { error } = await admin
    .from("qac_agents")
    .delete()
    .eq("id", id)
    .eq("workspace_id", access.workspaceId);

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/agents");
  revalidatePath("/qa-center");
  redirect("/qa-center/agents?deleted=agent");
}

export async function deleteDepartmentAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const id = text(formData, "id");
  if (!id) return;

  const { error } = await admin
    .from("qac_departments")
    .delete()
    .eq("id", id)
    .eq("workspace_id", access.workspaceId);

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/departments");
  revalidatePath("/qa-center/agents");
  revalidatePath("/qa-center/scorecards");
  revalidatePath("/qa-center");
  redirect("/qa-center/departments?deleted=department");
}

export async function deleteProviderAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const id = text(formData, "id");
  if (!id) return;

  const { error } = await admin
    .from("qac_voip_providers")
    .delete()
    .eq("id", id)
    .eq("workspace_id", access.workspaceId);

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/providers");
  revalidatePath("/qa-center");
  redirect("/qa-center/providers?deleted=provider");
}

export async function deleteScorecardAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const id = text(formData, "id");
  if (!id) return;

  const { error } = await admin
    .from("qac_scorecards")
    .delete()
    .eq("id", id)
    .eq("workspace_id", access.workspaceId);

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/scorecards");
  revalidatePath("/qa-center/departments");
  revalidatePath("/qa-center");
  redirect("/qa-center/scorecards?deleted=scorecard");
}

export async function deleteCriterionAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const id = text(formData, "id");
  if (!id) return;

  const { error } = await admin
    .from("qac_scorecard_criteria")
    .delete()
    .eq("id", id)
    .eq("workspace_id", access.workspaceId);

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/scorecards");
  revalidatePath("/qa-center");
  redirect("/qa-center/scorecards?deleted=criterion");
}

export async function triggerQacAnalysisAction(formData: FormData) {
  const access = await requireQacAccess();
  const admin = createAdminClient();
  const interactionId = text(formData, "interaction_id");
  if (!interactionId) return;

  const { data: interaction } = await admin
    .from("qac_interactions")
    .select("id")
    .eq("id", interactionId)
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();

  if (!interaction) throw new Error("Interaction not found");

  after(() => processQacInteraction(interactionId));
  revalidatePath(`/qa-center/interactions/${interactionId}`);
  revalidatePath("/qa-center/interactions");
}
