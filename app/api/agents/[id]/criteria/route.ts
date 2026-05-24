import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify agent ownership via RLS
  const { data: agent } = await supabase.from('agents').select('id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('qa_criteria')
    .select('*')
    .eq('agent_id', id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify agent ownership via RLS
  const { data: agent } = await supabase.from('agents').select('id, workspace_id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { name: string; description?: string; weight?: number };
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const a = agent as { id: string; workspace_id: string };
  const admin = createAdminClient();
  const { data, error } = await admin.from('qa_criteria').insert({
    agent_id: id,
    workspace_id: a.workspace_id,
    name: body.name,
    description: body.description ?? null,
    weight: body.weight ?? 10
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { criteria_id: string; name?: string; description?: string; weight?: number };
  if (!body.criteria_id) return NextResponse.json({ error: 'criteria_id required' }, { status: 400 });

  // Verify agent ownership via RLS
  const { data: agent } = await supabase.from('agents').select('id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('qa_criteria').update({
    name: body.name,
    description: body.description,
    weight: body.weight
  }).eq('id', body.criteria_id).eq('agent_id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const criteriaId = searchParams.get('criteria_id');
  if (!criteriaId) return NextResponse.json({ error: 'criteria_id required' }, { status: 400 });

  // Verify agent ownership via RLS
  const { data: agent } = await supabase.from('agents').select('id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = createAdminClient();
  const { error } = await admin.from('qa_criteria').delete().eq('id', criteriaId).eq('agent_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
