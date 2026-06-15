/**
 * QA Center — Department Detail API
 * GET    /api/qac/departments/[id]  — get department by id
 * PATCH  /api/qac/departments/[id]  — update department (owner/admin only)
 * DELETE /api/qac/departments/[id]  — soft-delete: set is_active=false (owner/admin only)
 *
 * Soft delete is used because qac_interactions.department_id is a FK to this table.
 * Physical DELETE would fail (RESTRICT) if any interactions reference the department.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// ─── Workspace + role resolver ────────────────────────────────────────────────

async function resolveWorkspace(
  userId: string,
): Promise<{ id: string; role: string } | null> {
  const admin = createAdminClient();

  const { data: owned } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (owned) return { id: (owned as { id: string }).id, role: "owner" };

  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (member) {
    return {
      id: (member as { workspace_id: string; role: string }).workspace_id,
      role: (member as { workspace_id: string; role: string }).role,
    };
  }

  return null;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RUBRIC_KEYS = ["compliance", "sales", "soft_skills", "conversation"] as const;
const VALID_CRITERIA = new Set(RUBRIC_KEYS);

function validateScoringRubric(
  rubric: unknown,
): { ok: true; value: Record<string, number> } | { ok: false; error: string } {
  if (typeof rubric !== "object" || rubric === null || Array.isArray(rubric)) {
    return { ok: false, error: "scoring_rubric must be an object" };
  }
  const r = rubric as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const key of RUBRIC_KEYS) {
    const v = r[key];
    if (v === undefined) {
      return { ok: false, error: `scoring_rubric.${key} is required` };
    }
    const n = Number(v);
    if (isNaN(n) || n < 0 || n > 100) {
      return {
        ok: false,
        error: `scoring_rubric.${key} must be a number between 0 and 100`,
      };
    }
    result[key] = n;
  }
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 1) {
    return {
      ok: false,
      error: `scoring_rubric values must sum to 100 (got ${total})`,
    };
  }
  return { ok: true, value: result };
}

function validateCriticalCriteria(
  criteria: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(criteria)) {
    return { ok: false, error: "critical_criteria must be an array" };
  }
  for (const item of criteria) {
    if (!VALID_CRITERIA.has(item as typeof RUBRIC_KEYS[number])) {
      return {
        ok: false,
        error: `critical_criteria contains invalid value "${item}". Must be one of: ${[...VALID_CRITERIA].join(", ")}`,
      };
    }
  }
  return { ok: true, value: criteria as string[] };
}

// ─── GET /api/qac/departments/[id] ───────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_departments")
    .select(
      "id, name, slug, description, qa_prompt, scoring_rubric, critical_criteria, is_active, created_at, updated_at",
    )
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .single();

  if (error || !data)
    return NextResponse.json(
      { error: "Department not found" },
      { status: 404 },
    );

  return NextResponse.json({ department: data });
}

// ─── PATCH /api/qac/departments/[id] ─────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (!["owner", "admin"].includes(ws.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can update departments" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body["name"] !== undefined) {
    const name = body["name"];
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "name must be 100 characters or fewer" }, { status: 400 });
    }
    updates["name"] = name.trim();
  }

  if (body["slug"] !== undefined) {
    const slug = body["slug"];
    if (typeof slug !== "string" || !SLUG_RE.test(slug) || slug.length > 50) {
      return NextResponse.json(
        { error: "slug must be lowercase alphanumeric with hyphens only, max 50 chars" },
        { status: 400 },
      );
    }
    updates["slug"] = slug;
  }

  if (body["description"] !== undefined) {
    updates["description"] =
      typeof body["description"] === "string" ? body["description"].trim() || null : null;
  }

  if (body["qa_prompt"] !== undefined) {
    updates["qa_prompt"] =
      typeof body["qa_prompt"] === "string" ? body["qa_prompt"].trim() || null : null;
  }

  if (body["scoring_rubric"] !== undefined) {
    const result = validateScoringRubric(body["scoring_rubric"]);
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 400 });
    updates["scoring_rubric"] = result.value;
  }

  if (body["critical_criteria"] !== undefined) {
    const result = validateCriticalCriteria(body["critical_criteria"]);
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 400 });
    updates["critical_criteria"] = result.value;
  }

  if (body["is_active"] !== undefined) {
    if (typeof body["is_active"] !== "boolean") {
      return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
    }
    updates["is_active"] = body["is_active"];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_departments")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select(
      "id, name, slug, description, qa_prompt, scoring_rubric, critical_criteria, is_active, updated_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `A department with that slug already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data)
    return NextResponse.json({ error: "Department not found" }, { status: 404 });

  return NextResponse.json({ department: data });
}

// ─── DELETE /api/qac/departments/[id] ────────────────────────────────────────
// Soft delete only: sets is_active = false.
// Physical DELETE is unsafe because qac_interactions.department_id FK is RESTRICT.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (!["owner", "admin"].includes(ws.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can delete departments" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_departments")
    .update({ is_active: false })
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select("id, name, is_active")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Department not found" }, { status: 404 });

  return NextResponse.json({ department: data, deactivated: true });
}
