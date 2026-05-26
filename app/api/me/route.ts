import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, parseBody } from '@/lib/api';

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  company: z.string().max(100).optional(),
  onboarding_completed: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ user: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = parseBody(UpdateProfileSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const admin = createAdminClient();

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update['name'] = body.name;
  if (body.company !== undefined) update['company'] = body.company;
  if (body.onboarding_completed !== undefined) update['onboarding_completed'] = body.onboarding_completed;

  const { data, error } = await admin
    .from('users')
    .update(update)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('[me] PATCH error:', error);
    return apiError('Internal server error', 500);
  }
  return apiOk({ user: data });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  // Delete user data — RLS cascades will clean up workspaces, agents, etc.
  await admin.from('users').delete().eq('id', user.id);
  // Delete the Supabase Auth user
  await admin.auth.admin.deleteUser(user.id);
  return NextResponse.json({ ok: true });
}
