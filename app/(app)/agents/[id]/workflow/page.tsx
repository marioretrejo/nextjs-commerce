import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Workflow } from 'lucide-react';
import Link from 'next/link';
import type { Agent } from '@/lib/supabase/types';
import { WorkflowClientWrapper } from './WorkflowClientWrapper';

export default async function AgentWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data } = await admin.from('agents').select('*').eq('id', id).single();
  if (!data) notFound();
  const agent = data as Agent;

  const initial = (agent as unknown as Record<string, unknown>)['workflow'] as
    | { nodes: unknown[]; edges: unknown[] }
    | undefined;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[#e5e5e5] bg-white px-6 py-4">
        <Link
          href={`/agents/${id}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5e5] text-[#606060] transition-colors hover:bg-[#f5f5f5]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8b5cf6]/10">
          <Workflow className="h-4 w-4 text-[#8b5cf6]" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-[#1a1a1a]">{agent.name} — Workflow Builder</h1>
          <p className="text-xs text-[#a0a0a0]">
            Design your agent&apos;s conversation flow visually, or generate one with AI
          </p>
        </div>
      </div>

      {/* Editor fills remaining height */}
      <div className="flex-1 overflow-hidden p-4">
        <WorkflowClientWrapper
          agentId={id}
          initialNodes={(initial?.nodes ?? []) as never}
          initialEdges={(initial?.edges ?? []) as never}
        />
      </div>
    </div>
  );
}
