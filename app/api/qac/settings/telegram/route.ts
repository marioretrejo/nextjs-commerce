import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function resolveWorkspaceAndRole(userId: string) {
  const admin = createAdminClient();
  const { data: owned } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (owned) return { ws: owned as { id: string }, isOwner: true };

  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .single();

  if (member) {
    const m = member as { workspace_id: string; role: string };
    return { ws: { id: m.workspace_id }, isOwner: false };
  }
  return null;
}

export async function GET(_req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveWorkspaceAndRole(user.id);
  if (!resolved)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("status, credentials")
    .eq("workspace_id", resolved.ws.id)
    .eq("type", "telegram_qa")
    .maybeSingle();

  if (!data || (data as { status: string }).status !== "connected") {
    return NextResponse.json({ connected: false });
  }

  const creds = (data as { credentials: Record<string, unknown> }).credentials;
  const token = typeof creds?.bot_token === "string" ? creds.bot_token : "";
  const chatId = typeof creds?.chat_id === "string" ? creds.chat_id : "";

  return NextResponse.json({
    connected: true,
    bot_token_hint: token.length > 4 ? `...${token.slice(-4)}` : "****",
    chat_id: chatId,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveWorkspaceAndRole(user.id);
  if (!resolved)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    bot_token?: string;
    chat_id?: string;
  };

  if (!body.bot_token?.trim() || !body.chat_id?.trim())
    return NextResponse.json(
      { error: "bot_token and chat_id are required" },
      { status: 400 },
    );

  const admin = createAdminClient();
  const { error } = await admin.from("integrations").upsert(
    {
      workspace_id: resolved.ws.id,
      type: "telegram_qa",
      status: "connected",
      credentials: {
        bot_token: body.bot_token.trim(),
        chat_id: body.chat_id.trim(),
      },
      settings: {},
    },
    { onConflict: "workspace_id,type" },
  );

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveWorkspaceAndRole(user.id);
  if (!resolved)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  await admin
    .from("integrations")
    .update({ status: "disconnected", credentials: {} })
    .eq("workspace_id", resolved.ws.id)
    .eq("type", "telegram_qa");

  return NextResponse.json({ ok: true });
}
