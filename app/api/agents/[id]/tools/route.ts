/**
 * GET  /api/agents/[id]/tools  — list dynamic tools for this agent
 * POST /api/agents/[id]/tools  — create a new dynamic tool
 *
 * Dynamic tools are loaded by the LiveKit worker at call start and registered
 * with the LLM. Each tool is an HTTP endpoint the agent can call during a call.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface AgentTool {
  id: string;
  agent_id: string;
  workspace_id: string;
  name: string;
  description: string;
  parameter_schema: Record<string, unknown>;
  server_url: string;
  method: string;
  headers: Record<string, string>;
  created_at: string;
}

async function getWorkspaceForAgent(agentId: string, userId: string) {
  const admin = createAdminClient();
  const { data: agent } = await admin
    .from('agents')
    .select('id, workspace_id')
    .eq('id', agentId)
    .single();
  if (!agent) return null;
  const { data: ws } = await admin
    .from('workspaces')
    .select('id')
    .eq('id', agent.workspace_id)
    .eq('owner_id', userId)
    .single();
  return ws ? agent : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getWorkspaceForAgent(id, user.id);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data: tools } = await admin
    .from('agent_tools')
    .select('*')
    .eq('agent_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ tools: (tools as AgentTool[] | null) ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getWorkspaceForAgent(id, user.id);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const body = await req.json() as {
    name?: string;
    description?: string;
    parameter_schema?: Record<string, unknown>;
    server_url?: string;
    method?: string;
    headers?: Record<string, string>;
  };

  if (!body.name?.trim())       return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!body.server_url?.trim()) return NextResponse.json({ error: 'server_url is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: tool, error } = await admin
    .from('agent_tools')
    .insert({
      agent_id:         id,
      workspace_id:     (agent as { workspace_id: string }).workspace_id,
      name:             body.name.trim(),
      description:      body.description?.trim() ?? '',
      parameter_schema: body.parameter_schema ?? { type: 'object', properties: {}, required: [] },
      server_url:       body.server_url.trim(),
      method:           body.method ?? 'POST',
      headers:          body.headers ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tool });
}
