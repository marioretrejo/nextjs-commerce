import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces } from '@/lib/workspace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { Campaign, CampaignStatus, CampaignTemplate } from '@/lib/supabase/types';
import { Plus, PlayCircle, PauseCircle, Users, CheckCircle, TrendingUp, Calendar, BookmarkPlus, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { OutboundDialer } from '@/components/outbound/OutboundDialer';

function statusBadge(status: CampaignStatus) {
  const map: Record<CampaignStatus, { label: string; className: string }> = {
    draft:     { label: 'Draft',     className: 'border-[#e0e0e0] text-[#6b6b6b] bg-white' },
    scheduled: { label: 'Scheduled', className: 'border-transparent bg-[#f5f5f5] text-[#0a0a0a]' },
    active:    { label: 'Active',    className: 'border-transparent bg-[#0a0a0a] text-white' },
    paused:    { label: 'Paused',    className: 'border-[#e0e0e0] text-[#6b6b6b] bg-white' },
    completed: { label: 'Completed', className: 'border-transparent bg-[#f5f5f5] text-[#0a0a0a]' },
  };
  const s = map[status];
  return (
    <Badge className={s.className}>
      {s.label}
    </Badge>
  );
}

function progressPct(campaign: Campaign) {
  if (!campaign.total_contacts) return 0;
  return Math.round((campaign.completed_contacts / campaign.total_contacts) * 100);
}

export default async function CampaignsPage() {
  const workspaces = await getUserWorkspaces();
  const workspace = workspaces[0];

  let campaigns: Campaign[] = [];
  let templates: (CampaignTemplate & { agent?: { name: string } })[] = [];
  let dialerAgents: { id: string; name: string }[] = [];
  let dialerPhoneNumbers: { number: string }[] = [];
  if (workspace) {
    const supabase = await createClient();
    const [{ data: campaignData }, { data: templateData }, { data: agentData }, { data: phoneData }] = await Promise.all([
      supabase
        .from('campaigns')
        .select('*, agent:agents!campaigns_agent_id_fkey(id, name, status)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('campaign_templates')
        .select('*, agent:agents!campaign_templates_agent_id_fkey(id, name)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('agents')
        .select('id, name')
        .eq('workspace_id', workspace.id)
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('phone_numbers')
        .select('number')
        .eq('workspace_id', workspace.id)
        .eq('status', 'available')
        .order('number'),
    ]);
    campaigns = (campaignData as Campaign[]) ?? [];
    templates = (templateData as (CampaignTemplate & { agent?: { name: string } })[]) ?? [];
    dialerAgents = (agentData as { id: string; name: string }[]) ?? [];
    dialerPhoneNumbers = (phoneData as { number: string }[]) ?? [];
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Quick Outbound Dialer */}
      <div className="mb-6">
        <OutboundDialer agents={dialerAgents} phoneNumbers={dialerPhoneNumbers} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Campaigns</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Manage outbound calling campaigns and track their progress.
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: campaigns.length, icon: <PlayCircle className="w-4 h-4 text-[#6b6b6b]" /> },
          { label: 'Active', value: campaigns.filter(c => c.status === 'active').length, icon: <PlayCircle className="w-4 h-4 text-[#6b6b6b]" /> },
          { label: 'Completed', value: campaigns.filter(c => c.status === 'completed').length, icon: <CheckCircle className="w-4 h-4 text-[#6b6b6b]" /> },
          {
            label: 'Total Contacts',
            value: campaigns.reduce((sum, c) => sum + c.total_contacts, 0).toLocaleString(),
            icon: <Users className="w-4 h-4 text-[#6b6b6b]" />
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              {stat.icon}
              <div>
                <p className="text-2xl font-bold text-[#0a0a0a]">{stat.value}</p>
                <p className="text-xs text-[#6b6b6b]">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns list */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <PlayCircle className="w-12 h-12 text-[#e0e0e0] mb-4" />
            <p className="text-[#0a0a0a] font-medium mb-1">No campaigns yet</p>
            <p className="text-sm text-[#6b6b6b] mb-4">Create your first outbound campaign to get started.</p>
            <Link href="/campaigns/new">
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                New Campaign
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const pct = progressPct(campaign);
            const conversionRate = campaign.completed_contacts > 0
              ? Math.round((campaign.converted_contacts / campaign.completed_contacts) * 100)
              : 0;

            return (
              <Card key={campaign.id} className="hover:border-[#0a0a0a] transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="font-semibold text-[#0a0a0a] hover:underline truncate"
                        >
                          {campaign.name}
                        </Link>
                        {statusBadge(campaign.status)}
                      </div>

                      {campaign.agent && (
                        <p className="text-sm text-[#6b6b6b] mb-3">
                          Agent: {(campaign.agent as unknown as { name: string }).name}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-[#6b6b6b] mb-1">
                          <span>Progress</span>
                          <span>{campaign.completed_contacts} / {campaign.total_contacts} contacts</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-5 text-xs text-[#6b6b6b]">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {campaign.total_contacts.toLocaleString()} total
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {campaign.completed_contacts.toLocaleString()} completed
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {campaign.converted_contacts.toLocaleString()} converted ({conversionRate}%)
                        </span>
                        {campaign.start_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(campaign.start_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {campaign.status === 'active' && (
                        <form action={`/api/campaigns/${campaign.id}/pause`} method="POST">
                          <Button type="submit" variant="outline" size="sm">
                            <PauseCircle className="w-4 h-4 mr-1" />
                            Pause
                          </Button>
                        </form>
                      )}
                      {(campaign.status === 'draft' || campaign.status === 'paused') && (
                        <form action={`/api/campaigns/${campaign.id}/launch`} method="POST">
                          <Button type="submit" size="sm">
                            <PlayCircle className="w-4 h-4 mr-1" />
                            {campaign.status === 'paused' ? 'Resume' : 'Launch'}
                          </Button>
                        </form>
                      )}
                      <Link href={`/campaigns/${campaign.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Templates section */}
      {templates.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#0a0a0a]">Campaign Templates</h2>
              <p className="text-sm text-[#6b6b6b]">Start a new campaign from a saved template.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="hover:border-[#0a0a0a] transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5] shrink-0">
                      <BookmarkPlus className="h-4 w-4 text-[#6b6b6b]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0a0a0a] truncate">{tpl.name}</p>
                      {tpl.description && (
                        <p className="text-xs text-[#6b6b6b] mt-0.5 line-clamp-2">{tpl.description}</p>
                      )}
                    </div>
                  </div>
                  {tpl.agent && (
                    <p className="text-xs text-[#6b6b6b] flex items-center gap-1 mb-4">
                      <Bot className="w-3 h-3" />
                      {tpl.agent.name}
                    </p>
                  )}
                  <Link href={`/campaigns/new?template_id=${tpl.id}`}>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      Use Template
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
