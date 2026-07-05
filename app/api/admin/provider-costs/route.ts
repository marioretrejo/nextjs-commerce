import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { data } = await admin
    .from("provider_costs")
    .select("*")
    .eq("label", "default")
    .single();
  return NextResponse.json(data ?? {});
}

export async function PUT(req: Request) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin, user } = gate;

  const body = (await req.json()) as Record<string, number>;
  const allowed = [
    "twilio_outbound_per_min",
    "twilio_inbound_per_min",
    "livekit_per_min",
    "stt_per_min",
    "llm_per_1k_tokens",
    "tts_per_1k_chars",
  ];
  const patch: Record<string, number | string> = {
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  for (const key of allowed) {
    if (typeof body[key] === "number") patch[key] = body[key];
  }

  const { error } = await admin
    .from("provider_costs")
    .upsert({ label: "default", ...patch }, { onConflict: "label" });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
