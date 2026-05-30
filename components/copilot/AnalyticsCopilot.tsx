'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Loader2, Bot, ChevronDown, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'How many calls this week?',
  'Best performing agent?',
  "What's my avg call duration?",
  'This month\'s success rate?',
];

export function AnalyticsCopilot({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Suppress lint warning — workspaceId is passed for future workspace-switching support;
  // the API already reads it server-side from the session.
  void workspaceId;

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res  = await fetch('/api/copilot', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      setMessages((prev) => [...prev, {
        role:    'assistant',
        content: data.reply ?? data.error ?? 'Something went wrong.',
      }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connection error — please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  return (
    <>
      {/* ── Floating toggle ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Analytics Copilot"
        className={[
          'fixed bottom-20 right-6 z-50 flex h-14 w-14 items-center justify-center',
          'rounded-full bg-[#0a0a0a] text-white shadow-2xl',
          'transition-all duration-200 hover:scale-105 hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)]',
          'md:bottom-8 md:right-8',
        ].join(' ')}
      >
        {open
          ? <ChevronDown className="h-5 w-5" />
          : <Sparkles className="h-5 w-5" />
        }
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className={[
            'fixed bottom-36 right-6 z-50 flex flex-col overflow-hidden',
            'h-[520px] w-[360px] md:bottom-28 md:right-8 md:w-[400px]',
            'rounded-2xl border border-[#e5e5e5] bg-white shadow-2xl',
          ].join(' ')}
          style={{ animation: 'copilot-in 0.18s ease-out' }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 bg-[#0a0a0a] px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-none text-white">Analytics Copilot</p>
              <p className="mt-0.5 text-xs text-white/50">GPT-4o · real-time data</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/50 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f5]">
                  <Bot className="h-6 w-6 text-[#a0a0a0]" />
                </div>
                <p className="text-sm font-medium text-[#1a1a1a]">Ask about your calls</p>
                <p className="mt-1 text-xs text-[#a0a0a0]">I have access to your real-time analytics</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-full border border-[#e5e5e5] px-3 py-1.5 text-xs text-[#404040] transition-colors hover:border-[#0a0a0a] hover:bg-[#f5f5f5]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a]">
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                )}
                <div
                  className={[
                    'max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'rounded-br-sm bg-[#0a0a0a] text-white'
                      : 'rounded-bl-sm bg-[#f5f5f5] text-[#1a1a1a]',
                  ].join(' ')}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a]">
                  <Bot className="h-3 w-3 text-white" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-[#f5f5f5] px-3 py-3">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-[#a0a0a0] animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-[#f0f0f0] p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your metrics…"
                disabled={loading}
                className="flex-1 rounded-xl border border-[#e5e5e5] bg-[#f8f8f8] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#0a0a0a] focus:bg-white disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0a0a0a] text-white transition-opacity disabled:opacity-40"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes copilot-in {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
