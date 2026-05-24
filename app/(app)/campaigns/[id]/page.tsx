'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2, Pause, Play, BookmarkPlus } from 'lucide-react';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Campaign {
  id: string; name: string; status: string; agent_id: string | null;
  total_contacts: number; completed_contacts: number; converted_contacts: number;
  max_concurrency: number; start_at: string | null; workspace_id: string;
  agent?: { name: string };
}
interface Contact {
  id: string; name: string | null; phone: string; status: string; attempts: number; last_called_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-[#f5f5f5] text-[#6b6b6b]',
  calling: 'bg-[#0a0a0a] text-white',
  converted: 'bg-[#f5f5f5] text-[#0a0a0a] font-semibold',
  no_answer: 'bg-[#f5f5f5] text-[#6b6b6b]',
  voicemail: 'bg-[#f5f5f5] text-[#6b6b6b]',
  invalid: 'bg-[#f5f5f5] text-[#6b6b6b]'
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  async function refetchCampaign() {
    const r = await fetch(`/api/campaigns/${id}`);
    if (r.ok) setCampaign(await r.json() as Campaign);
  }

  async function refetchContacts() {
    const r = await fetch(`/api/campaigns/${id}/contacts`);
    if (r.ok) setContacts(await r.json() as Contact[]);
  }

  useEffect(() => {
    async function load() {
      const [campRes, coRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/campaigns/${id}/contacts`)
      ]);
      if (campRes.ok) setCampaign(await campRes.json() as Campaign);
      if (coRes.ok) setContacts(await coRes.json() as Contact[]);
      setLoading(false);
    }
    load();

    const supabase = createClient();

    // Realtime for contacts
    const contactsChannel = supabase.channel(`campaign-contacts-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_contacts', filter: `campaign_id=eq.${id}` },
        () => { refetchContacts(); refetchCampaign(); })
      .subscribe();

    // Realtime for campaign row (metrics updates)
    const campaignChannel = supabase.channel(`campaign-row-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${id}` },
        (payload) => { setCampaign((c) => c ? { ...c, ...(payload.new as Partial<Campaign>) } : c); })
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(campaignChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function launch() {
    setActing(true);
    const res = await fetch(`/api/campaigns/${id}/launch`, { method: 'POST' });
    if (res.ok) { toast.success('Campaign launched!'); setCampaign((c) => c ? { ...c, status: 'active' } : c); }
    else toast.error((await res.json() as { error: string }).error);
    setActing(false);
  }

  async function pause() {
    setActing(true);
    const res = await fetch(`/api/campaigns/${id}/pause`, { method: 'POST' });
    if (res.ok) { toast.success('Campaign paused'); setCampaign((c) => c ? { ...c, status: 'paused' } : c); }
    setActing(false);
  }

  async function saveAsTemplate() {
    if (!campaign) return;
    setSavingTemplate(true);
    const res = await fetch('/api/campaign-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${campaign.name} (template)`,
        description: '',
        agent_id: campaign.agent_id,
        settings: { max_concurrency: campaign.max_concurrency },
      }),
    });
    if (res.ok) toast.success('Saved as template');
    else toast.error('Failed to save template');
    setSavingTemplate(false);
  }

  if (loading) return <div className="p-6"><p className="text-[#6b6b6b]">Loading…</p></div>;
  if (!campaign) return <div className="p-6"><p>Campaign not found.</p></div>;

  const progress = campaign.total_contacts > 0 ? (campaign.completed_contacts / campaign.total_contacts) * 100 : 0;
  const conversionRate = campaign.completed_contacts > 0 ? (campaign.converted_contacts / campaign.completed_contacts * 100).toFixed(1) : '0';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <p className="text-sm text-[#6b6b6b]">{campaign.agent?.name ?? 'No agent'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>{campaign.status}</Badge>
          <Button variant="outline" size="sm" onClick={saveAsTemplate} disabled={savingTemplate}>
            <BookmarkPlus className="mr-2 h-4 w-4" />
            {savingTemplate ? 'Saving…' : 'Save as Template'}
          </Button>
          {campaign.status === 'draft' || campaign.status === 'paused' ? (
            <Button onClick={launch} disabled={acting}>
              {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Launch
            </Button>
          ) : campaign.status === 'active' ? (
            <Button variant="secondary" onClick={pause} disabled={acting}>
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          ) : null}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Contacts', value: campaign.total_contacts },
          { label: 'Completed', value: campaign.completed_contacts },
          { label: 'Converted', value: campaign.converted_contacts },
          { label: 'Conversion Rate', value: `${conversionRate}%` }
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-[#6b6b6b]">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#6b6b6b]">Progress</span>
            <span className="font-medium">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      {/* Contact board */}
      <Card>
        <CardHeader><CardTitle>Contacts ({contacts.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e0e0e0] bg-[#f5f5f5]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">Contact</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">Attempts</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">Last Call</th>
                </tr>
              </thead>
              <tbody>
                {contacts.slice(0, 200).map((c) => (
                  <tr key={c.id} className="border-b border-[#e0e0e0] hover:bg-[#f5f5f5]">
                    <td className="px-4 py-2.5">{c.name ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.phone}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{c.attempts}</td>
                    <td className="px-4 py-2.5 text-[#6b6b6b] text-xs">
                      {c.last_called_at ? new Date(c.last_called_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6b6b6b]">No contacts yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
