import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { webhook_url: string; webhook_events: string[] };
  try {
    body = (await req.json()) as {
      webhook_url: string;
      webhook_events: string[];
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate the destination URL: must be parseable and HTTPS. Without this an
  // attacker (or mistake) could store an http:// or internal-network URL that we
  // later POST to (SSRF).
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.webhook_url);
  } catch {
    return NextResponse.json(
      { error: "webhook_url must be a valid URL" },
      { status: 400 },
    );
  }
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "webhook_url must use HTTPS" },
      { status: 400 },
    );
  }

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .upsert(
      {
        workspace_id: ws.id,
        type: "webhook",
        status: "connected",
        credentials: {},
        webhook_url: body.webhook_url,
        webhook_events: body.webhook_events ?? [],
      },
      { onConflict: "workspace_id,type" },
    )
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
