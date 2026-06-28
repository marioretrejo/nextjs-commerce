import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendTelegramTestMessage } from "@/lib/notifications/telegram";

async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: owned } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (owned) return (owned as { id: string }).id;

  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  return member ? (member as { workspace_id: string }).workspace_id : null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    bot_token?: string;
    chat_id?: string;
    use_saved?: boolean;
  };

  const admin = createAdminClient();

  let botToken: string;
  let chatId: string;

  if (body.use_saved) {
    // Load saved credentials from DB
    const workspaceId = await resolveWorkspaceId(user.id);
    if (!workspaceId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data } = await admin
      .from("integrations")
      .select("credentials, status")
      .eq("workspace_id", workspaceId)
      .eq("type", "telegram_qa")
      .eq("status", "connected")
      .maybeSingle();

    if (!data)
      return NextResponse.json(
        { error: "No hay integración Telegram activa" },
        { status: 400 },
      );

    const creds = (data as { credentials: Record<string, unknown> })
      .credentials;
    botToken = typeof creds?.bot_token === "string" ? creds.bot_token : "";
    chatId = typeof creds?.chat_id === "string" ? creds.chat_id : "";

    if (!botToken || !chatId)
      return NextResponse.json(
        { error: "Credenciales Telegram incompletas" },
        { status: 400 },
      );
  } else {
    if (!body.bot_token?.trim() || !body.chat_id?.trim())
      return NextResponse.json(
        { error: "bot_token and chat_id are required" },
        { status: 400 },
      );

    // Verify user has workspace access
    const workspaceId = await resolveWorkspaceId(user.id);
    if (!workspaceId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    botToken = body.bot_token.trim();
    chatId = body.chat_id.trim();
  }

  const result = await sendTelegramTestMessage(botToken, chatId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Telegram rechazó el mensaje" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
