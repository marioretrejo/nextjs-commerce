/**
 * GET /api/cron/data-retention
 *
 * GDPR/CCPA compliance cron job — runs monthly (or on demand).
 * Deletes audio recordings and obfuscates transcripts beyond the retention window.
 *
 * Configured in vercel.json:
 *   { "crons": [{ "path": "/api/cron/data-retention", "schedule": "0 2 1 * *" }] }
 *
 * Per-workspace retention period is stored in workspaces.transcript_retention_days
 * (already in the schema). Defaults: free=30d, pro=90d, scale=365d.
 *
 * What is deleted/obfuscated:
 *   - recording_url: set to null (file should be deleted from Supabase Storage separately)
 *   - transcript: replaced with "[Transcript removed for GDPR/CCPA compliance]"
 *   - extracted_name, extracted_email: nulled
 *   - summary, extracted_interest, extracted_objections: nulled
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — may process large batches

export async function GET(req: Request) {
  // Verify Vercel Cron secret
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch all workspaces with their retention policy
  const { data: workspaces } = await admin
    .from('workspaces')
    .select('id, plan, transcript_retention_days');

  if (!workspaces?.length) return NextResponse.json({ processed: 0 });

  let totalDeleted = 0;
  let totalObfuscated = 0;

  for (const ws of workspaces) {
    const w = ws as { id: string; plan: string; transcript_retention_days: number | null };

    // Default retention by plan if not explicitly set
    const retentionDays = w.transcript_retention_days
      ?? (w.plan === 'scale' ? 365 : w.plan === 'pro' ? 90 : 30);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    // Find calls beyond the retention window that still have sensitive data
    const { data: expiredCalls } = await admin
      .from('calls')
      .select('id, recording_url')
      .eq('workspace_id', w.id)
      .lt('created_at', cutoff.toISOString())
      .or('recording_url.not.is.null,transcript.not.is.null');

    if (!expiredCalls?.length) continue;

    const callIds = expiredCalls.map((c: { id: string }) => c.id);

    // Delete recordings from Supabase Storage (if stored there)
    for (const call of expiredCalls as { id: string; recording_url: string | null }[]) {
      if (!call.recording_url) continue;
      try {
        // Extract storage path from URL if it's a Supabase Storage URL
        const url = new URL(call.recording_url);
        const storagePath = url.pathname.replace(/^\/storage\/v1\/object\/public\/[^/]+\//, '');
        if (storagePath) {
          await admin.storage.from('recordings').remove([storagePath]);
          totalDeleted++;
        }
      } catch { /* non-Supabase URL — skip */ }
    }

    // Obfuscate transcript + PII fields in bulk
    const { count } = await admin
      .from('calls')
      .update({
        recording_url: null,
        transcript: '[Transcript removed for data retention compliance]',
        extracted_name: null,
        extracted_email: null,
        summary: null,
        extracted_interest: null,
        extracted_objections: null,
      })
      .in('id', callIds);

    totalObfuscated += count ?? callIds.length;
  }

  return NextResponse.json({
    ok: true,
    recordings_deleted: totalDeleted,
    transcripts_obfuscated: totalObfuscated,
    processed_at: new Date().toISOString(),
  });
}
