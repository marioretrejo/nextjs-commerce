/**
 * POST /api/jobs/reanalyze-calls
 *
 * Re-triggers analyze-call for calls that have no qa_score yet.
 * Session-auth — only operates on the caller's own workspace calls.
 * Processes up to 50 calls per request (non-blocking, fire-and-forget).
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Get the workspace for this user
  const { data: ws } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Find calls with no qa_score but with a transcript (eligible for scoring)
  const { data: calls } = await admin
    .from('calls')
    .select('retell_call_id, transcript')
    .eq('workspace_id', (ws as { id: string }).id)
    .is('qa_score', null)
    .not('transcript', 'is', null)
    .limit(50);

  const eligible = ((calls ?? []) as { retell_call_id: string; transcript: string | null }[])
    .filter(c => c.transcript && c.transcript.length >= 50);

  if (eligible.length === 0) {
    return NextResponse.json({ queued: 0, message: 'No eligible calls found (need transcript + no qa_score yet).' });
  }

  const appUrl      = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const secret      = process.env['INTERNAL_API_SECRET'] ?? '';

  if (!appUrl || !secret) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL or INTERNAL_API_SECRET not configured.' }, { status: 503 });
  }

  // Fire analyze-call for each call (non-blocking)
  let queued = 0;
  for (const call of eligible) {
    fetch(`${appUrl}/api/jobs/analyze-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ room_name: call.retell_call_id }),
    }).catch(() => null);
    queued++;
  }

  return NextResponse.json({ queued, message: `Re-analysis triggered for ${queued} call(s).` });
}
