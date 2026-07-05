/**
 * GET  /api/admin/copilot-config  — fetch global copilot config
 * PUT  /api/admin/copilot-config  — update global copilot config
 * Superadmin only.
 */
import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { data, error } = await admin
    .from("copilot_config")
    .select("*")
    .eq("id", "global")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

export async function PUT(req: Request) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = (await req.json()) as {
    system_prompt?: string;
    rag_documents?: { title: string; content: string }[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
    enabled?: boolean;
  };

  const { error } = await admin
    .from("copilot_config")
    .update({
      system_prompt: body.system_prompt ?? "",
      rag_documents: body.rag_documents ?? [],
      model: body.model ?? "llama-3.3-70b-versatile",
      temperature: body.temperature ?? 0.3,
      max_tokens: body.max_tokens ?? 1024,
      enabled: body.enabled ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "global");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
