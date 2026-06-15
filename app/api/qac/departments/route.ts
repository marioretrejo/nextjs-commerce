/**
 * QA Center — Departments API
 * GET  /api/qac/departments  — list departments for the current workspace
 * POST /api/qac/departments  — create a new department (owner/admin only)
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// ─── Workspace + role resolver ────────────────────────────────────────────────

async function resolveWorkspace(
  userId: string,
): Promise<{ id: string; role: string } | null> {
  const admin = createAdminClient();

  // Owner path
  const { data: owned } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (owned) return { id: (owned as { id: string }).id, role: "owner" };

  // Member path
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

// ─── GET /api/qac/departments ─────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("include_inactive") === "true";

  const admin = createAdminClient();
  let query = admin
    .from("qac_departments")
    .select(
      "id, name, slug, description, qa_prompt, scoring_rubric, critical_criteria, is_active, created_at, updated_at",
    )
    .eq("workspace_id", ws.id)
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ departments: data ?? [] });
}

// ─── POST /api/qac/departments ────────────────────────────────────────────────

export async function POST(req: Request) {
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
      { error: "Only workspace owners and admins can create departments" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate name
  const name = body["name"];
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json(
      { error: "name must be 100 characters or fewer" },
      { status: 400 },
    );
  }

  // Validate slug (auto-generate if not provided)
  let slug = body["slug"];
  if (!slug) {
    slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  if (typeof slug !== "string" || !SLUG_RE.test(slug) || slug.length > 50) {
    return NextResponse.json(
      {
        error:
          "slug must be lowercase alphanumeric with hyphens only, max 50 chars",
      },
      { status: 400 },
    );
  }

  // Validate scoring_rubric (optional — defaults applied by DB)
  let scoringRubric: Record<string, number> | undefined;
  if (body["scoring_rubric"] !== undefined) {
    const result = validateScoringRubric(body["scoring_rubric"]);
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 400 });
    scoringRubric = result.value;
  }

  // Validate critical_criteria (optional — defaults applied by DB)
  let criticalCriteria: string[] | undefined;
  if (body["critical_criteria"] !== undefined) {
    const result = validateCriticalCriteria(body["critical_criteria"]);
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 400 });
    criticalCriteria = result.value;
  }

  // Optional fields
  const description =
    typeof body["description"] === "string" ? body["description"].trim() : null;
  const qaPrompt =
    typeof body["qa_prompt"] === "string" ? body["qa_prompt"].trim() : null;

  const admin = createAdminClient();
  const insert: Record<string, unknown> = {
    workspace_id: ws.id,
    name: name.trim(),
    slug,
    description: description || null,
    qa_prompt: qaPrompt || null,
  };
  if (scoringRubric !== undefined) insert["scoring_rubric"] = scoringRubric;
  if (criticalCriteria !== undefined)
    insert["critical_criteria"] = criticalCriteria;

  const { data, error } = await admin
    .from("qac_departments")
    .insert(insert)
    .select(
      "id, name, slug, description, qa_prompt, scoring_rubric, critical_criteria, is_active, created_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `A department with slug "${slug}" already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ department: data }, { status: 201 });
}
