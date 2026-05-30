import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify key belongs to user's workspace
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data: key } = await admin.from('api_keys').select('id').eq('id', id).eq('workspace_id', ws.id).single();
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Soft-revoke: set is_active=false so the key stops working immediately
  // but the audit record (created_at, last_used_at, prefix) is preserved.
  await admin.from('api_keys').update({ is_active: false }).eq('id', id);
  return new NextResponse(null, { status: 204 });
}
