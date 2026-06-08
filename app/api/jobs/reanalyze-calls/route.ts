/**
 * POST /api/jobs/reanalyze-calls
 *
 * Re-scores calls that have a transcript but no qa_score yet.
 * Processes the first call synchronously so the caller sees a real error
 * if GROQ_API_KEY or other deps are missing, then fires the rest async.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // allow up to 60s for the synchronous first call

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Early env checks ────────────────────────────────────────────────────────
  const groqKey   = process.env['GROQ_API_KEY']          ?? '';
  const appUrl    = process.env['NEXT_PUBLIC_APP_URL']    ?? '';
  const secret    = process.env['INTERNAL_API_SECRET']    ?? '';

  if (!groqKey) {
    return NextResponse.json({
      error: 'GROQ_API_KEY is not configured. Add it in your environment variables (Render/Vercel → Settings → Environment Variables).',
      code:  'MISSING_GROQ_KEY',
    }, { status: 503 });
  }
  if (!appUrl || !secret) {
    return NextResponse.json({
      error: 'NEXT_PUBLIC_APP_URL or INTERNAL_API_SECRET is not configured.',
      code:  'MISSING_ENV',
    }, { status: 503 });
  }

  const admin = createAdminClient();

  const { data: ws } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Find calls with transcript but no qa_score
  const { data: calls } = await admin
    .from('calls')
    .select('id, retell_call_id, transcript')
    .eq('workspace_id', (ws as { id: string }).id)
    .is('qa_score', null)
    .not('transcript', 'is', null)
    .limit(50);

  const eligible = ((calls ?? []) as { id: string; retell_call_id: string; transcript: string | null }[])
    .filter(c => c.transcript && c.transcript.length >= 50);

  if (eligible.length === 0) {
    return NextResponse.json({
      queued: 0,
      message: 'No eligible calls found. Calls need a transcript (≥50 chars) and no qa_score yet.',
    });
  }

  // ── Process first call synchronously to catch errors early ─────────────────
  const first = eligible[0]!;
  const firstRes = await fetch(`${appUrl}/api/jobs/analyze-call`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
    body:    JSON.stringify({ room_name: first.retell_call_id }),
  });

  if (!firstRes.ok) {
    const body = await firstRes.json().catch(() => ({ error: `HTTP ${firstRes.status}` })) as Record<string, unknown>;
    const reason = (body.error as string) ?? `HTTP ${firstRes.status}`;

    // Map common errors to actionable messages
    let hint = '';
    if (firstRes.status === 401)        hint = ' — INTERNAL_API_SECRET mismatch';
    else if (reason.includes('Groq'))   hint = ' — GROQ_API_KEY invalid or quota exceeded';
    else if (reason.includes('short'))  hint = ' — transcript too short';

    return NextResponse.json({
      error: `Analysis failed for first call: ${reason}${hint}`,
      call_id: first.id,
    }, { status: 502 });
  }

  // ── Fire the rest asynchronously ────────────────────────────────────────────
  for (const call of eligible.slice(1)) {
    fetch(`${appUrl}/api/jobs/analyze-call`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body:    JSON.stringify({ room_name: call.retell_call_id }),
    }).catch(() => null);
  }

  return NextResponse.json({
    queued:  eligible.length,
    message: `Re-analysis triggered for ${eligible.length} call(s). Results appear in ~30s.`,
  });
}
