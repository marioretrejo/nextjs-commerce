// Fire-and-forget trigger for the background call-analysis job. Posts { call_id }
// to /api/jobs/analyze-call with the internal secret header. Never throws.
export function triggerCallAnalysis(callId: string): void {
  const secret = process.env["INTERNAL_API_SECRET"];
  if (!secret || secret.trim().length < 16) {
    console.error(
      "[call-import] INTERNAL_API_SECRET not configured — analysis not triggered",
    );
    return;
  }

  const baseUrl =
    process.env["NEXT_PUBLIC_APP_URL"] ??
    process.env["NEXTAUTH_URL"] ??
    (process.env["VERCEL_URL"]
      ? `https://${process.env["VERCEL_URL"]}`
      : "http://localhost:3000");

  void fetch(`${baseUrl}/api/jobs/analyze-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({ call_id: callId }),
  }).catch((err) =>
    console.error("[call-import] analysis trigger failed:", err),
  );
}
