'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CreditCard, Loader2, Zap, Check } from 'lucide-react';

const PRESETS = [
  { label: '$10',  cents: 1000,  minutes: '~100 min' },
  { label: '$25',  cents: 2500,  minutes: '~250 min' },
  { label: '$50',  cents: 5000,  minutes: '~500 min', popular: true },
  { label: '$100', cents: 10000, minutes: '~1,000 min' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function TopUpModal({ open, onClose, workspaceId: _workspaceId }: Props) {
  const [selected, setSelected] = useState(PRESETS[2]!.cents); // $50 default
  const [loading, setLoading] = useState(false);

  async function handleTopUp() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: selected }),
      });
      const d = await res.json() as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? 'Failed to create checkout session');
      window.location.href = d.url;
    } catch (e) {
      toast.error(String(e));
      setLoading(false);
    }
  }

  const preset = PRESETS.find(p => p.cents === selected);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Activate Your Workspace
          </DialogTitle>
          <DialogDescription>
            Add credit to unlock AI agents, outbound calls, and all platform features.
            You only pay for what you use — no monthly commitment.
          </DialogDescription>
        </DialogHeader>

        {/* Value props */}
        <div className="grid grid-cols-3 gap-2 my-2">
          {[
            { icon: '🎙', text: 'Real-time AI voice' },
            { icon: '📞', text: 'Outbound campaigns' },
            { icon: '📊', text: 'Full analytics' },
          ].map((v) => (
            <div key={v.text} className="rounded-lg bg-[#f9f9f9] border border-[#efefef] p-2.5 text-center">
              <div className="text-lg mb-1">{v.icon}</div>
              <p className="text-[11px] text-[#6b6b6b] font-medium leading-tight">{v.text}</p>
            </div>
          ))}
        </div>

        {/* Amount selector */}
        <div>
          <p className="text-xs font-semibold text-[#0a0a0a] mb-2 uppercase tracking-wide">Choose an amount</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.cents}
                onClick={() => setSelected(p.cents)}
                className={`relative rounded-xl border-2 py-3 px-2 text-center transition-all ${
                  selected === p.cents
                    ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                    : 'border-[#e0e0e0] bg-white text-[#0a0a0a] hover:border-[#0a0a0a]/30'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 whitespace-nowrap">
                    Popular
                  </span>
                )}
                <p className="font-bold text-sm">{p.label}</p>
                <p className={`text-[10px] mt-0.5 ${selected === p.cents ? 'text-white/70' : 'text-[#a0a0a0]'}`}>
                  {p.minutes}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-[#f5f5f5] p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[#6b6b6b]">Credit amount</span>
            <span className="font-semibold">{preset?.label ?? `$${(selected / 100).toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b6b6b]">Estimated minutes</span>
            <span className="font-semibold">{preset?.minutes ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b6b6b]">Expiry</span>
            <span className="font-semibold text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> Never expires
            </span>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleTopUp}
          disabled={loading}
          size="lg"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting to Stripe…</>
            : <><CreditCard className="h-4 w-4 mr-2" /> Pay {preset?.label} Securely</>
          }
        </Button>

        <p className="text-center text-[11px] text-[#a0a0a0]">
          Secured by Stripe · SSL encrypted · Instant activation
        </p>
      </DialogContent>
    </Dialog>
  );
}
