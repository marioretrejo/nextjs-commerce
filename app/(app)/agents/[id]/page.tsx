import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Agent } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/server';
import { Bot, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AgentEditForm } from './agent-edit-form';

export default async function AgentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('agents').select('*').eq('id', id).single();
  if (!data) notFound();
  const agent = data as Agent;

  const { data: phoneNumbers } = await supabase
    .from('phone_numbers')
    .select('id, number, status')
    .eq('workspace_id', agent.workspace_id);

  return (
    <div className="p-6 mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{agent.name}</h1>
            <p className="text-xs text-[#6b6b6b]">ID: {agent.id}</p>
          </div>
        </div>
        <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>{agent.status}</Badge>
        <Link href={`/knowledge/${agent.id}`}>
          <Button variant="outline" size="sm">Knowledge</Button>
        </Link>
        <Link href={`/agents/${agent.id}/flow`}>
          <Button variant="outline" size="sm">Flow Builder</Button>
        </Link>
        <Link href={`/agents/${agent.id}/widget`}>
          <Button variant="outline" size="sm">Widget</Button>
        </Link>
        <Link href={`/agents/${agent.id}/test`}>
          <Button variant="secondary" size="sm">Test Call</Button>
        </Link>
      </div>

      <AgentEditForm agent={agent} phoneNumbers={(phoneNumbers ?? []) as { id: string; number: string; status: string }[]} />
    </div>
  );
}
