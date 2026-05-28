import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WaveformPlayer } from '@/components/calls/WaveformPlayer';
import { createClient } from '@/lib/supabase/server';
import { formatDuration } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

interface CallDetail {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  direction: string;
  duration_seconds: number;
  status: string | null;
  outcome: string | null;
  sentiment: string | null;
  transcript: string | null;
  recording_url: string | null;
  summary: string | null;
  task_completed: boolean;
  extracted_name: string | null;
  extracted_email: string | null;
  extracted_interest: string | null;
  extracted_objections: string | null;
  qa_score: number | null;
  cost_usd: number;
  created_at: string;
  agent: { name: string } | null;
  campaign: { name: string } | null;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-[#f5f5f5] text-[#0a0a0a]',
  neutral: 'bg-[#f5f5f5] text-[#6b6b6b]',
  negative: 'bg-[#0a0a0a] text-white'
};

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('calls')
    .select('*, agent:agents(name), campaign:campaigns(name)')
    .eq('id', id)
    .single();

  if (!data) notFound();
  const call = data as unknown as CallDetail;

  return (
    <div className="p-6 mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/calls"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{call.contact_name ?? call.contact_phone ?? 'Unknown Contact'}</h1>
          <p className="text-sm text-[#6b6b6b]">{new Date(call.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          {call.outcome && <Badge variant="outline">{call.outcome}</Badge>}
          {call.sentiment && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SENTIMENT_COLORS[call.sentiment] ?? ''}`}>
              {call.sentiment}
            </span>
          )}
          {call.qa_score !== null && (
            <Badge variant={call.qa_score >= 70 ? 'default' : 'secondary'}>QA {call.qa_score.toFixed(0)}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Duration', value: formatDuration(call.duration_seconds) },
          { label: 'Agent', value: call.agent?.name ?? '—' },
          { label: 'Campaign', value: call.campaign?.name ?? '—' },
          { label: 'Cost', value: `$${call.cost_usd.toFixed(3)}` }
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-[#6b6b6b]">{label}</p>
              <p className="font-semibold text-sm truncate">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Waveform player + synced transcript (replaces plain <audio> + separate transcript card) */}
      {call.recording_url ? (
        <Card>
          <CardHeader>
            <CardTitle>Recording &amp; Transcript</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-0">
            <div className="px-5 pb-5">
              <WaveformPlayer
                url={call.recording_url}
                transcript={call.transcript}
                duration={call.duration_seconds}
              />
            </div>
          </CardContent>
        </Card>
      ) : call.transcript ? (
        <Card>
          <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
              {call.transcript.split('\n').filter(Boolean).map((line, i) => {
                const isAgent = /^(agent|ai|assistant)\s*:/i.test(line);
                const text = line.replace(/^(agent|ai|assistant|user|caller|contact)\s*:/i, '').trim();
                return (
                  <div key={i} className={`flex gap-3 ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${isAgent ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f5] text-[#0a0a0a]'}`}>
                      <p className={`mb-1 text-xs font-medium ${isAgent ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>
                        {isAgent ? 'Agent' : 'Contact'}
                      </p>
                      {text}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {call.summary && (
        <Card>
          <CardHeader><CardTitle>AI Summary</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-[#6b6b6b] whitespace-pre-line">{call.summary}</p></CardContent>
        </Card>
      )}

      {(call.extracted_name || call.extracted_email || call.extracted_interest || call.extracted_objections) && (
        <Card>
          <CardHeader><CardTitle>Extracted Data</CardTitle></CardHeader>
          <CardContent className="divide-y divide-[#e0e0e0]">
            {[
              { label: 'Name', value: call.extracted_name },
              { label: 'Email', value: call.extracted_email },
              { label: 'Interest', value: call.extracted_interest },
              { label: 'Objections', value: call.extracted_objections },
              { label: 'Task Completed', value: call.task_completed ? 'Yes' : 'No' }
            ].filter((r) => r.value).map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2.5 text-sm">
                <span className="text-[#6b6b6b]">{label}</span>
                <span className="font-medium max-w-[60%] text-right">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
