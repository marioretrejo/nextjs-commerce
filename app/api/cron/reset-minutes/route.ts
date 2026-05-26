import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// Called by Vercel Cron on the 1st of each month (see vercel.json)
// Resets workspace minutes — replaces the commented pg_cron in migration 015
export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();

  // Reset all workspaces that have a minute limit
  const { error } = await admin
    .from('workspaces')
    .update({
      minutes_used: 0,
      overage_blocked: false,
      minutes_reset_at: new Date().toISOString()
    })
    .gt('minutes_limit', 0);

  if (error) {
    console.error('Minute reset failed:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reset_at: new Date().toISOString() });
}
