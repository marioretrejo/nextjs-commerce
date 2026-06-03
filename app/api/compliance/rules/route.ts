/**
 * GET  /api/compliance/rules  — list rules for authenticated user's workspace
 * POST /api/compliance/rules  — create a new rule
 */
import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces } from '@/lib/workspace';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function getWorkspaceId(): Promise<{ workspaceId: string } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const workspaces = await getUserWorkspaces();
  const ws = workspaces[0];
  if (!ws) return { error: NextResponse.json({ error: 'No workspace' }, { status: 404 }) };
  return { workspaceId: ws.id };
}

export async function GET() {
  const result = await getWorkspaceId();
  if ('error' in result) return result.error;
  const { workspaceId } = result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('compliance_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const result = await getWorkspaceId();
  if ('error' in result) return result.error;
  const { workspaceId } = result;

  let body: { rule_name?: string; description?: string; category?: string; severity?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.rule_name?.trim() || !body.description?.trim()) {
    return NextResponse.json({ error: 'rule_name and description are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('compliance_rules')
    .insert({
      workspace_id: workspaceId,
      rule_name:    body.rule_name.trim(),
      description:  body.description.trim(),
      category:     body.category ?? 'general',
      severity:     body.severity ?? 'medium',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
