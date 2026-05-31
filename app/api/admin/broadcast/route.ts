import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { title?: string; message?: string };
  const { title, message } = body;
  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'title and message required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get all user IDs
  const { data: users, error: usersErr } = await admin.from('users').select('id');
  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });
  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 });

  const notifications = (users as { id: string }[]).map((u) => ({
    user_id: u.id,
    type: 'broadcast',
    title: title.trim(),
    message: message.trim(),
  }));

  const { error } = await admin.from('notifications').insert(notifications);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sent: notifications.length });
}
