import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Agent } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces } from '@/lib/workspace';
import { Bot, Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const workspaces = await getUserWorkspaces();
  const workspace = workspaces[0];
  if (!workspace) redirect('/login');

  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  const agentList = (agents ?? []) as Agent[];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-[#6b6b6b]">{agentList.length} agent{agentList.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/agents/new">
          <Button><Plus className="mr-2 h-4 w-4" />New Agent</Button>
        </Link>
      </div>

      {agentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#e0e0e0] py-20 text-center">
          <Bot className="mb-4 h-12 w-12 text-[#e0e0e0]" />
          <h3 className="mb-1 font-semibold">No agents yet</h3>
          <p className="mb-4 text-sm text-[#6b6b6b]">Create your first AI voice agent to start making calls.</p>
          <Link href="/agents/new"><Button>Create your first agent</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agentList.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card className="hover:border-[#0a0a0a] transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">{agent.name}</p>
              <p className="text-xs text-[#6b6b6b]">{agent.language} · {agent.voice_engine}</p>
            </div>
          </div>
          <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>{agent.status}</Badge>
        </div>
        <p className="text-xs text-[#6b6b6b] line-clamp-2 mb-4 min-h-[2rem]">{agent.objective ?? 'No objective set'}</p>
        <div className="flex items-center justify-between border-t border-[#e0e0e0] pt-3">
          <div className="flex gap-4">
            <span className="text-xs text-[#6b6b6b]"><span className="font-semibold text-[#0a0a0a]">{agent.total_calls}</span> calls</span>
            <span className="text-xs text-[#6b6b6b]"><span className="font-semibold text-[#0a0a0a]">{agent.avg_qa_score?.toFixed(0) ?? '—'}</span> QA</span>
          </div>
          <div className="flex gap-2">
            <Link href={`/agents/${agent.id}/test`}><Button variant="outline" size="sm">Test</Button></Link>
            <Link href={`/agents/${agent.id}`}><Button variant="secondary" size="sm">Edit</Button></Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
