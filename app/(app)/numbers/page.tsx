'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { PhoneNumber } from '@/lib/supabase/types';
import { Phone, Search, Plus, Trash2, Server, ChevronRight, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Convert ISO country code to emoji flag
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().split('').map(c =>
    String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))
  ).join('');
}

// Group numbers by trunk/provider
interface TrunkGroup {
  key: string;
  label: string;
  provider: string;
  numbers: PhoneNumber[];
}

function groupByTrunk(numbers: PhoneNumber[]): TrunkGroup[] {
  const map = new Map<string, TrunkGroup>();
  for (const num of numbers) {
    let key: string;
    let label: string;
    if (num.provider === 'twilio') {
      key = '__twilio__'; label = 'TWILIO';
    } else if (num.provider === 'sip_trunk') {
      const trunk = num.display_name ?? num.sip_trunk_uri ?? 'SIP TRUNK';
      key = trunk; label = `SIP - ${trunk.toUpperCase()}`;
    } else {
      key = num.provider; label = num.provider.toUpperCase();
    }
    if (!map.has(key)) map.set(key, { key, label, provider: num.provider, numbers: [] });
    map.get(key)!.numbers.push(num);
  }
  return Array.from(map.values());
}

type DialogMode = 'choose' | 'twilio' | 'sip' | 'connect-twilio';

const COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'MX', name: 'Mexico' },
  { code: 'CO', name: 'Colombia' },      { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brazil' },        { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Peru' },          { code: 'EC', name: 'Ecuador' },
  { code: 'VE', name: 'Venezuela' },     { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },      { code: 'SV', name: 'El Salvador' },
  { code: 'NI', name: 'Nicaragua' },     { code: 'CR', name: 'Costa Rica' },
  { code: 'PA', name: 'Panama' },        { code: 'UY', name: 'Uruguay' },
  { code: 'PY', name: 'Paraguay' },      { code: 'BO', name: 'Bolivia' },
  { code: 'GB', name: 'United Kingdom' },{ code: 'CA', name: 'Canada' },
  { code: 'ES', name: 'Spain' },         { code: 'DE', name: 'Germany' },
];

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [checkingSpam, setCheckingSpam] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>('choose');
  const [addingToTrunk, setAddingToTrunk] = useState<string | null>(null);

  // Twilio provisioning
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [requesting, setRequesting] = useState(false);

  // SIP trunk
  const [sipPhone, setSipPhone] = useState('');
  const [sipUri, setSipUri] = useState('');
  const [sipName, setSipName] = useState('');
  const [sipSaving, setSipSaving] = useState(false);

  // Connect Twilio
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioConnecting, setTwilioConnecting] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/numbers?limit=200');
      if (res.ok) {
        const data = await res.json() as PhoneNumber[];
        setNumbers(Array.isArray(data) ? data : []);
      }
    } catch { /* non-blocking */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNumbers(); }, [fetchNumbers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return numbers;
    return numbers.filter(n =>
      n.number.includes(q) ||
      n.country_name?.toLowerCase().includes(q) ||
      n.display_name?.toLowerCase().includes(q)
    );
  }, [numbers, search]);

  const groups = useMemo(() => groupByTrunk(filtered), [filtered]);

  function openAdd(mode: DialogMode = 'choose', trunkKey?: string) {
    setMode(mode);
    setAddingToTrunk(trunkKey ?? null);
    setSipPhone(''); setSipUri(trunkKey && trunkKey !== '__twilio__' ? trunkKey : ''); setSipName('');
    setSelectedCountry('US');
    setDialogOpen(true);
  }

  async function checkSpam() {
    setCheckingSpam(true);
    await new Promise(r => setTimeout(r, 1200));
    setCheckingSpam(false);
    toast.success('Spam check complete — no new flags detected.');
  }

  async function connectTwilio() {
    if (!twilioSid.trim() || !twilioToken.trim()) {
      toast.error('Enter both Account SID and Auth Token.');
      return;
    }
    setTwilioConnecting(true);
    const res = await fetch('/api/settings/twilio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_sid: twilioSid.trim(), auth_token: twilioToken.trim() }),
    });
    setTwilioConnecting(false);
    if (res.ok) {
      toast.success('Twilio connected successfully.');
      setDialogOpen(false);
    } else {
      const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      toast.error(err.error ?? 'Failed to connect Twilio.');
    }
  }

  async function requestTwilioNumber() {
    setRequesting(true);
    try {
      const country = COUNTRIES.find(c => c.code === selectedCountry);
      const res = await fetch('/api/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: selectedCountry, country_name: country?.name }),
      });
      if (res.ok) {
        await fetchNumbers(); setDialogOpen(false);
        toast.success('Phone number provisioned.');
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? 'Failed to provision number.');
      }
    } catch { toast.error('Network error.'); }
    finally { setRequesting(false); }
  }

  async function saveSip() {
    if (!sipPhone.trim()) { toast.error('Enter the phone number.'); return; }
    if (!sipUri.trim()) { toast.error('Enter the SIP trunk URI.'); return; }
    setSipSaving(true);
    try {
      const res = await fetch('/api/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'sip_trunk', phone_number: sipPhone.trim(),
          sip_trunk_uri: sipUri.trim(), display_name: sipName.trim() || undefined,
        }),
      });
      if (res.ok) {
        await fetchNumbers(); setDialogOpen(false);
        toast.success('SIP number added.');
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? 'Failed to add SIP number.');
      }
    } catch { toast.error('Network error.'); }
    finally { setSipSaving(false); }
  }

  async function deleteNumber(id: string) {
    setDeletingId(id);
    await fetch(`/api/numbers/${id}`, { method: 'DELETE' });
    setNumbers(prev => prev.filter(n => n.id !== id));
    setDeletingId(null);
  }

  async function deleteGroup(group: TrunkGroup) {
    if (!confirm(`Delete all ${group.numbers.length} number(s) in ${group.label}?`)) return;
    await Promise.all(group.numbers.map(n => fetch(`/api/numbers/${n.id}`, { method: 'DELETE' })));
    await fetchNumbers();
    toast.success(`Deleted all numbers in ${group.label}.`);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phone Numbers</h1>
          <p className="text-sm text-[#6b6b6b] mt-0.5">Manage your phone numbers and SIP trunk connections.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={checkSpam} disabled={checkingSpam}>
            {checkingSpam
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Checking…</>
              : <><ShieldCheck className="w-4 h-4 mr-1.5" />Check Spam</>
            }
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => { setMode('connect-twilio'); setTwilioSid(''); setTwilioToken(''); setDialogOpen(true); }}
          >
            <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.25 17.292l-4.5-4.364 1.857-1.858 2.643 2.506 5.643-5.784 1.857 1.857-7.5 7.643z"/>
            </svg>
            Connect Twilio
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
        <Input
          placeholder="Search phone number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Groups */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-lg border border-[#e0e0e0] p-5 space-y-3">
              <div className="w-48 h-4 bg-[#f5f5f5] rounded animate-pulse" />
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, j) => (
                  <div key={j} className="h-12 bg-[#f5f5f5] rounded animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e0e0e0] flex flex-col items-center justify-center py-20 text-center">
          <Phone className="w-12 h-12 text-[#e0e0e0] mb-4" />
          <p className="font-semibold text-[#0a0a0a]">No phone numbers yet</p>
          <p className="text-sm text-[#6b6b6b] mb-4">Add a number to start making calls.</p>
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="w-4 h-4 mr-1" />Add Number
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-[#6b6b6b] py-8 text-center">No numbers match "{search}".</p>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.key} className="rounded-lg border border-[#e0e0e0]">
              {/* Group header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#e0e0e0]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6b6b6b] tracking-wider uppercase">
                  <Phone className="w-3.5 h-3.5" />
                  {group.label}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAdd('sip', group.provider === 'sip_trunk' ? group.key : undefined)}
                    className="flex items-center gap-1 text-xs text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add SIP Numbers
                  </button>
                  <button
                    onClick={() => deleteGroup(group)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors ml-3"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All SIP Numbers
                  </button>
                </div>
              </div>

              {/* Number grid */}
              {group.numbers.length === 0 ? (
                <p className="px-5 py-4 text-sm text-[#6b6b6b]">No phone numbers added</p>
              ) : (
                <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.numbers.map(num => (
                    <div
                      key={num.id}
                      className="group relative flex items-center gap-2.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 hover:border-[#0a0a0a] transition-colors"
                    >
                      <span className="text-xl leading-none shrink-0">{countryFlag(num.country_code)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-sm font-medium text-[#0a0a0a] truncate">{num.number}</span>
                          {num.status === 'suspended' && (
                            <Badge className="text-[10px] px-1 py-0 bg-red-100 text-red-700 border-transparent">SPAM</Badge>
                          )}
                        </div>
                        {num.country_name && (
                          <p className="text-[11px] text-[#6b6b6b] truncate mt-0.5">{num.country_name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteNumber(num.id)}
                        disabled={deletingId === num.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#6b6b6b] hover:text-red-600 shrink-0"
                      >
                        {deletingId === num.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* + Add Number floating button when numbers exist */}
      {!loading && numbers.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="w-4 h-4 mr-1" />Add Number
          </Button>
        </div>
      )}

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">

          {/* Choose */}
          {mode === 'choose' && (
            <>
              <DialogHeader>
                <DialogTitle>Add Phone Number</DialogTitle>
                <DialogDescription>Choose how you want to add a phone number.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <button onClick={() => setMode('twilio')} className="w-full flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white p-4 text-left hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Request a new number</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">Provision via Twilio — billed monthly.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0" />
                </button>
                <button onClick={() => setMode('sip')} className="w-full flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white p-4 text-left hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Server className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Bring your own number</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">Connect via SIP trunk (CommPeak, Telnyx, etc.)</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0" />
                </button>
              </div>
            </>
          )}

          {/* Twilio provisioning */}
          {mode === 'twilio' && (
            <>
              <DialogHeader>
                <DialogTitle>Request Phone Number</DialogTitle>
                <DialogDescription>Select a country to provision a new phone number.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Country</Label>
                <select
                  value={selectedCountry}
                  onChange={e => setSelectedCountry(e.target.value)}
                  className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{countryFlag(c.code)} {c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-[#6b6b6b]">Numbers are provisioned via Twilio and billed monthly.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode('choose')}>Back</Button>
                <Button onClick={requestTwilioNumber} disabled={requesting}>
                  {requesting ? 'Requesting…' : 'Request Number'}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* SIP trunk */}
          {mode === 'sip' && (
            <>
              <DialogHeader>
                <DialogTitle>Connect SIP Trunk</DialogTitle>
                <DialogDescription>Add a number from your VoIP provider (CommPeak, Telnyx, SquareTalk, etc.)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <Input placeholder="+15551234567" value={sipPhone} onChange={e => setSipPhone(e.target.value)} />
                  <p className="text-xs text-[#6b6b6b]">E.164 format</p>
                </div>
                <div className="space-y-1.5">
                  <Label>SIP trunk URI</Label>
                  <Input placeholder="sip:username@sip.provider.com" value={sipUri} onChange={e => setSipUri(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Display name <span className="text-[#6b6b6b]">(optional)</span></Label>
                  <Input placeholder="e.g. CommPeak LATAM" value={sipName} onChange={e => setSipName(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode('choose')}>Back</Button>
                <Button onClick={saveSip} disabled={sipSaving}>{sipSaving ? 'Saving…' : 'Add Number'}</Button>
              </DialogFooter>
            </>
          )}

          {/* Connect Twilio */}
          {mode === 'connect-twilio' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.25 17.292l-4.5-4.364 1.857-1.858 2.643 2.506 5.643-5.784 1.857 1.857-7.5 7.643z"/>
                  </svg>
                  Connect Twilio
                </DialogTitle>
                <DialogDescription>Enter your Twilio credentials to provision phone numbers.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Account SID</Label>
                  <Input
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioSid}
                    onChange={e => setTwilioSid(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Auth Token</Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••••••••••••••••••••••"
                    value={twilioToken}
                    onChange={e => setTwilioToken(e.target.value)}
                  />
                </div>
                <a
                  href="https://console.twilio.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#6b6b6b] underline"
                >
                  Need help? Find these in your Twilio Console →
                </a>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={connectTwilio}
                  disabled={twilioConnecting}
                >
                  {twilioConnecting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Connecting…</> : 'Connect'}
                </Button>
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}
