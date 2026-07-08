import type { createAdminClient } from "@/lib/supabase/admin";
import { transcribeAudio } from "@/lib/deepgram";
import { isSafeUrl } from "@/lib/qac/ssrf";

type Admin = ReturnType<typeof createAdminClient>;

function contentTypeFor(url: string): string {
  if (/\.wav(\?|$)/i.test(url)) return "audio/wav";
  if (/\.(ogg|oga)(\?|$)/i.test(url)) return "audio/ogg";
  if (/\.(m4a|mp4)(\?|$)/i.test(url)) return "audio/mp4";
  return "audio/mpeg";
}

/**
 * Transcribe a call from its stored recording. Prefers the private Storage
 * object (via a short-lived signed URL) and falls back to the raw recording_url
 * (SSRF-guarded). Returns "" when no audio is available or transcription fails.
 */
export async function transcribeFromRecording(
  admin: Admin,
  call: {
    recording_storage_path: string | null;
    recording_url: string | null;
  },
  language = "es",
): Promise<string> {
  let audioUrl: string | null = null;

  if (call.recording_storage_path) {
    const { data } = await admin.storage
      .from("call_recordings")
      .createSignedUrl(call.recording_storage_path, 600);
    audioUrl = data?.signedUrl ?? null;
  }

  // Fall back to the external URL only if it passes the SSRF allowlist.
  if (!audioUrl && call.recording_url && isSafeUrl(call.recording_url)) {
    audioUrl = call.recording_url;
  }

  if (!audioUrl) return "";

  try {
    const res = await fetch(audioUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return "";
    const contentType =
      res.headers.get("content-type") ?? contentTypeFor(audioUrl);
    return await transcribeAudio(buf, language, contentType);
  } catch (err) {
    console.error("[analyze-call] transcription failed:", err);
    return "";
  }
}
