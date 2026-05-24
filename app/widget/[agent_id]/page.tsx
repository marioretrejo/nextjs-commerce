'use client';

import { use, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';

interface TranscriptLine { role: 'agent' | 'user'; text: string }

interface RetellWebClientType {
  on(event: string, cb: (data?: unknown) => void): void;
  startCall(opts: { accessToken: string; sampleRate: number }): Promise<void>;
  stopCall(): void;
}

export default function WidgetPage({ params }: { params: Promise<{ agent_id: string }> }) {
  const { agent_id } = use(params);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [agentName, setAgentName] = useState('AI Agent');
  const retellRef = useRef<RetellWebClientType | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/agents/${agent_id}/widget-config`)
      .then(r => r.json())
      .then((d: { name?: string }) => setAgentName(d.name ?? 'AI Agent'));
  }, [agent_id]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  async function startCall() {
    setStatus('connecting');
    setTranscript([]);
    try {
      const res = await fetch(`/api/agents/${agent_id}/web-call`, { method: 'POST' });
      if (!res.ok) { setStatus('idle'); return; }
      const { access_token } = await res.json() as { access_token: string };

      // Dynamic import to avoid SSR issues
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const mod = await import('retell-client-js-sdk' as any).catch(() => null);
      if (!mod) { setStatus('idle'); return; }
      const { RetellWebClient } = mod as { RetellWebClient: new () => RetellWebClientType };
      const client = new RetellWebClient();
      retellRef.current = client;

      client.on('call_started', () => setStatus('active'));
      client.on('call_ended', () => { setStatus('ended'); });
      client.on('update', (update) => {
        const upd = update as { transcript?: { role: string; content: string }[] } | undefined;
        if (upd?.transcript) {
          setTranscript(
            upd.transcript.map(t => ({
              role: (t.role === 'agent' ? 'agent' : 'user') as 'agent' | 'user',
              text: t.content,
            }))
          );
        }
      });
      client.on('error', () => setStatus('idle'));

      await client.startCall({ accessToken: access_token, sampleRate: 24000 });
    } catch {
      setStatus('idle');
    }
  }

  async function endCall() {
    retellRef.current?.stopCall();
    setStatus('ended');
  }

  const isActive = status === 'active';
  const isConnecting = status === 'connecting';

  return (
    <div className="flex flex-col h-screen bg-white font-sans">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#e0e0e0] p-4">
        <div className="w-8 h-8 rounded-full bg-[#0a0a0a] flex items-center justify-center text-white text-xs font-bold">
          {agentName[0]?.toUpperCase() ?? 'A'}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">{agentName}</p>
          <p className="text-xs text-[#6b6b6b]">
            {status === 'idle' ? 'Click to start' : status === 'connecting' ? 'Connecting…' : status === 'active' ? 'Live' : 'Call ended'}
          </p>
        </div>
        {isActive && (
          <span className="ml-auto flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>

      {/* Transcript */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcript.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Phone className="h-10 w-10 text-[#e0e0e0] mb-3" />
            <p className="text-sm text-[#6b6b6b]">Start a voice conversation</p>
          </div>
        )}
        {transcript.map((line, i) => (
          <div key={i} className={`flex gap-2 ${line.role === 'agent' ? '' : 'flex-row-reverse'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              line.role === 'agent'
                ? 'bg-[#f5f5f5] text-[#0a0a0a]'
                : 'bg-[#0a0a0a] text-white'
            }`}>
              {line.text}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="border-t border-[#e0e0e0] p-4 flex items-center justify-center gap-4">
        {status === 'idle' || status === 'ended' ? (
          <button
            onClick={startCall}
            className="flex items-center gap-2 rounded-full bg-[#0a0a0a] px-6 py-3 text-white text-sm font-medium hover:bg-[#3a3a3a] transition-colors"
          >
            <Phone className="h-4 w-4" />
            {status === 'ended' ? 'Call Again' : 'Start Call'}
          </button>
        ) : (
          <button
            onClick={endCall}
            disabled={isConnecting}
            className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            <PhoneOff className="h-4 w-4" />
            {isConnecting ? 'Connecting…' : 'End Call'}
          </button>
        )}

        <div className="flex items-center gap-1 text-xs text-[#6b6b6b]">
          {isActive ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          {isActive ? 'Mic active' : 'Mic off'}
        </div>
      </div>
    </div>
  );
}
