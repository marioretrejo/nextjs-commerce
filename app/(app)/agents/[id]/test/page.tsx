'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { toast } from 'sonner';

export default function TestAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [retellClient, setRetellClient] = useState<any>(null);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [persona, setPersona] = useState('Interested business owner, slightly skeptical');

  async function startCall() {
    setConnecting(true);
    try {
      const res = await fetch(`/api/agents/${id}/test-call`, { method: 'POST' });
      if (!res.ok) {
        const e = await res.json() as { error: string };
        throw new Error(e.error);
      }
      const { access_token } = await res.json() as { access_token: string };

      const { RetellWebClient } = await import('retell-client-js-sdk');
      const client = new RetellWebClient();

      client.on('call_ended', () => {
        setCallActive(false);
        setRetellClient(null);
        toast.success('Call ended');
      });
      client.on('update', (update: unknown) => {
        const u = update as { transcript?: { role: string; content: string }[] };
        if (u.transcript) {
          setTranscript(u.transcript.map((t) => ({ role: t.role, text: t.content })));
        }
      });
      client.on('error', (err: unknown) => {
        toast.error(`Call error: ${String(err)}`);
        setCallActive(false);
        setRetellClient(null);
      });

      await client.startCall({ accessToken: access_token });
      setRetellClient(client);
      setCallActive(true);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function runSimulation() {
    setSimulating(true);
    setTranscript([]);
    try {
      const res = await fetch(`/api/agents/${id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona })
      });
      const data = await res.json() as { transcript: { role: string; text: string }[] };
      setTranscript(data.transcript ?? []);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="p-6 mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/agents/${id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold">Test Agent</h1>
      </div>

      {/* Live call */}
      <Card>
        <CardHeader><CardTitle>Live Browser Call</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#6b6b6b]">Start a real WebRTC call with your agent directly from the browser.</p>
          <div className="flex items-center gap-3">
            {!callActive ? (
              <Button onClick={startCall} disabled={connecting}>
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                {connecting ? 'Connecting…' : 'Start Call'}
              </Button>
            ) : (
              <>
                <Button variant="outline" className="bg-[#0a0a0a] text-white hover:bg-[#262626]"
                  onClick={() => { retellClient?.stopCall(); }}>
                  <PhoneOff className="mr-2 h-4 w-4" />
                  End Call
                </Button>
                <Button variant="secondary" onClick={() => {
                  if (muted) { retellClient?.unmute(); } else { retellClient?.mute(); }
                  setMuted(!muted);
                }}>
                  {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {muted ? 'Unmute' : 'Mute'}
                </Button>
              </>
            )}
            {callActive && (
              <div className="flex items-center gap-2 text-sm text-[#6b6b6b]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0a0a0a] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#0a0a0a]" />
                </span>
                Live
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Simulation */}
      <Card>
        <CardHeader><CardTitle>Conversation Simulation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#6b6b6b]">Simulate a conversation with a virtual prospect — no minutes used.</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prospect Persona</label>
            <input
              className="flex h-9 w-full rounded-md border border-[#e0e0e0] bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0a0a0a]"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="Describe the prospect personality..."
            />
          </div>
          <Button variant="secondary" onClick={runSimulation} disabled={simulating}>
            {simulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Simulating…</> : 'Run Simulation'}
          </Button>
        </CardContent>
      </Card>

      {/* Transcript */}
      {transcript.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {transcript.map((t, i) => (
              <div key={i} className={`flex gap-3 ${t.role === 'agent' ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${t.role === 'agent' ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f5] text-[#0a0a0a]'}`}>
                  <p className={`mb-1 text-xs font-medium ${t.role === 'agent' ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>
                    {t.role === 'agent' ? 'Agent' : 'Prospect'}
                  </p>
                  {t.text}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
