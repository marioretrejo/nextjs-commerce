import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

async function assertSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  return (data as { is_superadmin: boolean } | null)?.is_superadmin ? user : null;
}

export async function GET() {
  const user = await assertSuperadmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin.from('provider_costs').select('*').eq('label', 'default').single();
  return NextResponse.json(data ?? {});
}

export async function PUT(req: Request) {
  const user = await assertSuperadmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as Record<string, number>;
  const allowed = ['twilio_outbound_per_min', 'twilio_inbound_per_min', 'livekit_per_min', 'stt_per_min', 'llm_per_1k_tokens', 'tts_per_1k_chars'];
  const patch: Record<string, number | string> = { updated_at: new Date().toISOString(), updated_by: user.id };
  for (const key of allowed) {
    if (typeof body[key] === 'number') patch[key] = body[key];
  }

  const admin = createAdminClient();
  const { error } = await admin.from('provider_costs').update(patch).eq('label', 'default');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
