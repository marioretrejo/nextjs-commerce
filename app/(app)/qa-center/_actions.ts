"use server";

import { requireQacAccess } from "@/lib/qac/access";
import {
  CONVERSION_SALES_CRITERIA,
  CONVERSION_SALES_SCORECARD,
  CONVERSION_TRACKERS,
  criterionExamplesJson,
} from "@/lib/qac/conversion-sales-v1";
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

function providersUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `/qa-center/providers?${search.toString()}`;
}

function scorecardsUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `/qa-center/scorecards?${search.toString()}`;
}

function trackersUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `/qa-center/trackers?${search.toString()}`;
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

function providerErrorMessage(message?: string): string {
  const raw = message ?? "";
  if (
    raw.includes("qac_voip_providers") ||
    raw.includes("Could not find") ||
    raw.includes("schema cache")
  ) {
    return "Falta aplicar la migracion 082 de QA Center en Supabase. La tabla qac_voip_providers no existe todavia.";
  }
  if (raw.includes("duplicate key")) {
    return "Ya existe un provider con ese slug.";
  }
  return raw || "No se pudo crear el provider.";
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

function missingTable(errorMessage?: string | null, table?: string): boolean {
  const message = errorMessage ?? "";
  return Boolean(
    (table && message.includes(table)) ||
      message.includes("Could not find the table") ||
      message.includes("schema cache"),
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
  if (!access.isSuperadmin) redirect("/qa-center");

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

  if (error) {
    redirect(providersUrl({ error: providerErrorMessage(error.message) }));
  }

  revalidatePath("/qa-center/providers");
  revalidatePath("/qa-center/settings");
  redirect(providersUrl({ created: "1" }));
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

export async function installConversionSalesV1Action() {
  const access = await requireQacAccess(true);
  if (!access.isSuperadmin) {
    redirect(
      scorecardsUrl({
        error: "Solo un superadmin puede instalar Conversion Sales V1.",
      }),
    );
  }

  const admin = createAdminClient();
  const workspaceId = access.workspaceId;

  let { data: department } = await admin
    .from("qac_departments")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("slug", CONVERSION_SALES_SCORECARD.departmentSlug)
    .maybeSingle();

  if (!department) {
    const byName = await admin
      .from("qac_departments")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", CONVERSION_SALES_SCORECARD.departmentName)
      .maybeSingle();
    department = byName.data;
  }

  if (!department) {
    let created = await admin
      .from("qac_departments")
      .insert({
        workspace_id: workspaceId,
        name: CONVERSION_SALES_SCORECARD.departmentName,
        slug: CONVERSION_SALES_SCORECARD.departmentSlug,
        description: "Conversion sales QA department.",
        qa_prompt: `${CONVERSION_SALES_SCORECARD.qaPrompt}\n\n${CONVERSION_SALES_SCORECARD.qaPromptEs}`,
        auto_analyze: true,
        is_active: true,
      })
      .select("id")
      .single();

    if (missingColumn(created.error?.message, "auto_analyze")) {
      created = await admin
        .from("qac_departments")
        .insert({
          workspace_id: workspaceId,
          name: CONVERSION_SALES_SCORECARD.departmentName,
          slug: CONVERSION_SALES_SCORECARD.departmentSlug,
          description: "Conversion sales QA department.",
          qa_prompt: `${CONVERSION_SALES_SCORECARD.qaPrompt}\n\n${CONVERSION_SALES_SCORECARD.qaPromptEs}`,
          is_active: true,
        })
        .select("id")
        .single();
    }

    if (created.error || !created.data) {
      redirect(
        scorecardsUrl({ error: created.error?.message ?? "department" }),
      );
    }
    department = created.data;
  } else {
    await admin
      .from("qac_departments")
      .update({
        qa_prompt: `${CONVERSION_SALES_SCORECARD.qaPrompt}\n\n${CONVERSION_SALES_SCORECARD.qaPromptEs}`,
        is_active: true,
      })
      .eq("id", (department as { id: string }).id)
      .eq("workspace_id", workspaceId);
  }

  const departmentId = (department as { id: string }).id;
  await admin
    .from("qac_scorecards")
    .update({ is_active: false })
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId);

  const existingScorecard = await admin
    .from("qac_scorecards")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("name", CONVERSION_SALES_SCORECARD.name)
    .eq("version", CONVERSION_SALES_SCORECARD.version)
    .maybeSingle();

  let scorecardId = (existingScorecard.data as { id: string } | null)?.id;
  if (scorecardId) {
    await admin
      .from("qac_scorecards")
      .update({ is_active: true })
      .eq("id", scorecardId)
      .eq("workspace_id", workspaceId);
    await admin
      .from("qac_scorecard_criteria")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("scorecard_id", scorecardId);
  } else {
    const inserted = await admin
      .from("qac_scorecards")
      .insert({
        workspace_id: workspaceId,
        department_id: departmentId,
        name: CONVERSION_SALES_SCORECARD.name,
        version: CONVERSION_SALES_SCORECARD.version,
        is_active: true,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      redirect(
        scorecardsUrl({ error: inserted.error?.message ?? "scorecard" }),
      );
    }
    scorecardId = (inserted.data as { id: string }).id;
  }

  const criteriaRows = CONVERSION_SALES_CRITERIA.map((criterion) => ({
    workspace_id: workspaceId,
    scorecard_id: scorecardId,
    category: criterion.category,
    name: criterion.name,
    description: criterion.description,
    weight: criterion.weight,
    is_critical: Boolean(criterion.is_critical),
    applicability_rule: criterion.applicability_rule ?? null,
    pass_definition: criterion.pass_definition,
    partial_definition: criterion.partial_definition ?? null,
    fail_definition: criterion.fail_definition,
    na_definition: criterion.na_definition ?? null,
    examples_json: criterionExamplesJson(criterion),
    sort_order: criterion.sort_order,
  }));

  const criteriaResult = await admin
    .from("qac_scorecard_criteria")
    .insert(criteriaRows);
  if (criteriaResult.error) {
    redirect(scorecardsUrl({ error: criteriaResult.error.message }));
  }

  const trackerRows = CONVERSION_TRACKERS.map((tracker) => ({
    workspace_id: workspaceId,
    department_id: departmentId,
    name: tracker.name,
    name_es: tracker.name_es,
    description: tracker.description,
    description_es: tracker.description_es,
    positive_examples_json: tracker.positive_examples,
    action_config_json: {
      no_score_impact: true,
      mark_call: true,
      assign_review: Boolean(tracker.trigger_manual_review),
    },
    severity: tracker.severity,
    risk_level_override: tracker.risk_level_override ?? null,
    trigger_manual_review: Boolean(tracker.trigger_manual_review),
    is_active: true,
    is_system: true,
  }));

  const trackerResult = await admin.from("qac_trackers").upsert(trackerRows, {
    onConflict: "workspace_id,department_id,name",
  });
  if (
    trackerResult.error &&
    !missingTable(trackerResult.error.message, "qac_trackers")
  ) {
    redirect(scorecardsUrl({ error: trackerResult.error.message }));
  }

  revalidatePath("/qa-center/scorecards");
  revalidatePath("/qa-center/departments");
  revalidatePath("/qa-center/trackers");
  redirect(scorecardsUrl({ installed: "conversion-sales-v1", lang: "es" }));
}

export async function createTrackerAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const name = text(formData, "name");
  const description = text(formData, "description");
  if (!name || !description) return;

  const examples = (text(formData, "positive_examples") ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const { error } = await admin.from("qac_trackers").insert({
    workspace_id: access.workspaceId,
    department_id: text(formData, "department_id"),
    name,
    name_es: text(formData, "name_es"),
    description,
    description_es: text(formData, "description_es"),
    positive_examples_json: examples,
    action_config_json: {
      no_score_impact: true,
      mark_call: checkbox(formData, "mark_call"),
      assign_review: checkbox(formData, "trigger_manual_review"),
      send_alert: checkbox(formData, "send_alert"),
    },
    severity: text(formData, "severity") ?? "info",
    risk_level_override: text(formData, "risk_level_override"),
    trigger_manual_review: checkbox(formData, "trigger_manual_review"),
    is_active: checkbox(formData, "is_active"),
    is_system: false,
  });

  if (error) {
    redirect(trackersUrl({ error: error.message }));
  }

  revalidatePath("/qa-center/trackers");
  redirect(trackersUrl({ created: "1" }));
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
  if (!access.isSuperadmin) redirect("/qa-center");

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

export async function deleteTrackerAction(formData: FormData) {
  const access = await requireQacAccess(true);
  const admin = createAdminClient();
  const id = text(formData, "id");
  if (!id) return;

  const { error } = await admin
    .from("qac_trackers")
    .delete()
    .eq("id", id)
    .eq("workspace_id", access.workspaceId);

  if (error) throw new Error(error.message);

  revalidatePath("/qa-center/trackers");
  redirect("/qa-center/trackers?deleted=tracker");
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
