import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function storagePathFrom(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("http")) return value;
  if (value.includes("call_recordings/")) {
    return value.split("call_recordings/")[1] ?? null;
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("qac_interactions")
    .select(
      "id, workspace_id, external_call_id, recording_url, internal_audio_url",
    )
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const interaction = data as {
    external_call_id: string | null;
    recording_url: string | null;
    internal_audio_url: string | null;
  };
  const storagePath = storagePathFrom(interaction.internal_audio_url);
  const download = new URL(req.url).searchParams.has("download");

  if (storagePath) {
    const { data: signed } = await admin.storage
      .from("call_recordings")
      .createSignedUrl(
        storagePath,
        3600,
        download
          ? { download: `${interaction.external_call_id ?? id}.mp3` }
          : undefined,
      );
    if (signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl);
    }
  }

  if (interaction.recording_url?.startsWith("http")) {
    return NextResponse.redirect(interaction.recording_url);
  }

  return NextResponse.json({ error: "No recording" }, { status: 404 });
}
