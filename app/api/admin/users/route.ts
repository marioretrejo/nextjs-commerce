/**
 * GET /api/admin/users — list all platform users for broadcast targeting.
 * Superadmin only.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from('users').select('is_superadmin').eq('id', user.id).single();
    if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: users, error } = await admin
      .from('users')
      .select('id, name, email')
      .order('email', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: users ?? [] });
  } catch (e) {
    console.error('[admin/users] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
