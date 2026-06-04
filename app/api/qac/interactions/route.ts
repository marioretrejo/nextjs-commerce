/**
 * QA Center — Interactions API
 * Manages human call-center agent conversations for QA analysis.
 * Completely separate from the AI voice agent pipeline.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

async function getWorkspace(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('workspaces')
    .select('id, has_compliance_qa, owner_id')
    .eq('owner_id', userId)
    .single();
  return data as { id: string; has_compliance_qa: boolean; owner_id: string } | null;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await getWorkspace(user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const url = new URL(req.url);
  const limit  = Math.min(Number(url.searchParams.get('limit')  ?? 50), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const status = url.searchParams.get('status');
  const agent  = url.searchParams.get('agent');

  const admin = createAdminClient();

  let query = admin
    .from('qac_interactions')
    .select(`
      id, agent_name, agent_id, channel, duration_s, status, created_at,
      qac_evaluations (
        id, overall_score, risk_score, tone, summary, criteria_scores, evaluated_at,
        qac_flags ( id, category, severity, label, regulation )
      )
    `, { count: 'exact' })
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (agent)  query = query.ilike('agent_name', `%${agent}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ interactions: data ?? [], total: count ?? 0 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await getWorkspace(user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json() as {
    agent_name: string;
    agent_id?:  string;
    channel?:   string;
    transcript: string;
    duration_s?: number;
    audio_url?:  string;
    metadata?:   Record<string, unknown>;
  };

  if (!body.agent_name?.trim())
    return NextResponse.json({ error: 'agent_name is required' }, { status: 400 });
  if (!body.transcript?.trim() || body.transcript.trim().length < 20)
    return NextResponse.json({ error: 'Transcript must be at least 20 characters' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('qac_interactions')
    .insert({
      workspace_id: workspace.id,
      agent_name:   body.agent_name.trim(),
      agent_id:     body.agent_id?.trim() || null,
      channel:      body.channel ?? 'call',
      transcript:   body.transcript.trim(),
      duration_s:   body.duration_s ?? null,
      audio_url:    body.audio_url ?? null,
      metadata:     body.metadata ?? {},
      status:       'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
