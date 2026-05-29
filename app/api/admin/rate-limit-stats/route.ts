/**
 * GET /api/admin/rate-limit-stats?workspaceIds=uuid1,uuid2,...
 *
 * Returns the number of 429 rejections (from Redis) for each workspace
 * in the last hour. Superadmin-only.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getBulkRejectionCounts } from '@/lib/ratelimit';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const ids = url.searchParams.get('workspaceIds')?.split(',').filter(Boolean) ?? [];

  const counts = await getBulkRejectionCounts(ids);
  return NextResponse.json({ counts });
}
