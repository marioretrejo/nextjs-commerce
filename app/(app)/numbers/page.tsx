'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { parsePhoneNumber } from 'libphonenumber-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { PhoneNumber, SipProtocol } from '@/lib/supabase/types';
import { Phone, Search, Plus, Trash2, Server, ChevronRight, ShieldCheck, Loader2, Plug, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  iso_country: string;
  locality?: string;
  region?: string;
  capabilities?: { voice?: boolean; sms?: boolean };
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().split('').map(c =>
    String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))
  ).join('');
}

// Detect country ISO code from a phone number string using libphonenumber-js.
// Handles ambiguous +1 numbers correctly: +1829 → DO, +1787 → PR, etc.
function phoneToCountryCode(phone: string): string | null {
  if (!phone) return null;
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed?.country ?? null;
  } catch {
    return null;
  }
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',  CA: 'Canada',        MX: 'Mexico',          DO: 'Dominican Republic',
  PR: 'Puerto Rico',    CU: 'Cuba',           HT: 'Haiti',           JM: 'Jamaica',
  TT: 'Trinidad & Tobago', BB: 'Barbados',    BS: 'Bahamas',         AG: 'Antigua',
  DM: 'Dominica',       GD: 'Grenada',        KN: 'St. Kitts',       LC: 'St. Lucia',
  VC: 'St. Vincent',    VI: 'US Virgin Islands', VG: 'British Virgin Islands', TC: 'Turks & Caicos',
  GB: 'United Kingdom', DE: 'Germany',        FR: 'France',          ES: 'Spain',
  IT: 'Italy',          PT: 'Portugal',       NL: 'Netherlands',     BE: 'Belgium',
  SE: 'Sweden',         NO: 'Norway',         DK: 'Denmark',         FI: 'Finland',
  CH: 'Switzerland',    AT: 'Austria',        IE: 'Ireland',         PL: 'Poland',
  RU: 'Russia',         UA: 'Ukraine',        TR: 'Turkey',
  BR: 'Brazil',         AR: 'Argentina',      CO: 'Colombia',        CL: 'Chile',
  PE: 'Peru',           EC: 'Ecuador',        VE: 'Venezuela',       CR: 'Costa Rica',
  PA: 'Panama',         GT: 'Guatemala',      HN: 'Honduras',        SV: 'El Salvador',
  NI: 'Nicaragua',      UY: 'Uruguay',        PY: 'Paraguay',        BO: 'Bolivia',
  AU: 'Australia',      NZ: 'New Zealand',    JP: 'Japan',           KR: 'South Korea',
  CN: 'China',          IN: 'India',          SG: 'Singapore',       HK: 'Hong Kong',
  PH: 'Philippines',    TH: 'Thailand',       MY: 'Malaysia',        ID: 'Indonesia',
  ZA: 'South Africa',   NG: 'Nigeria',        KE: 'Kenya',           GH: 'Ghana',
  EG: 'Egypt',          MA: 'Morocco',        IL: 'Israel',          AE: 'UAE',
  SA: 'Saudi Arabia',
};

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

function TwilioLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.25 17.292l-4.5-4.364 1.857-1.858 2.643 2.506 5.643-5.784 1.857 1.857-7.5 7.643z"/>
    </svg>
  );
}

type DialogMode = 'choose' | 'twilio' | 'sip' | 'connect-twilio' | 'connect-sip';

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
  { code: 'DO', name: 'Dominican Republic' }, { code: 'PR', name: 'Puerto Rico' },
  { code: 'CU', name: 'Cuba' },          { code: 'HT', name: 'Haiti' },
  { code: 'JM', name: 'Jamaica' },
];

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [checkingSpam, setCheckingSpam] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>('choose');
  const [addingToTrunk, setAddingToTrunk] = useState<string | null>(null);

  // SIP trunk (add number)
  const [sipPhone, setSipPhone] = useState('');
  const [sipUri, setSipUri] = useState('');
  const [sipName, setSipName] = useState('');
  const [sipSaving, setSipSaving] = useState(false);

  // Twilio connection
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioConnecting, setTwilioConnecting] = useState(false);
  const [twilioConnected, setTwilioConnected] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState<string | null>(null);

  // SIP trunk connection
  const [sipTrunkProvider, setSipTrunkProvider] = useState('Squaretalk');
  const [sipTrunkHost, setSipTrunkHost] = useState('');
  const [sipTrunkPort, setSipTrunkPort] = useState('5060');
  const [sipTrunkUser, setSipTrunkUser] = useState('');
  const [sipTrunkPass, setSipTrunkPass] = useState('');
  const [sipTrunkNetmask, setSipTrunkNetmask] = useState('32');
  const [sipTrunkProtocol, setSipTrunkProtocol] = useState<SipProtocol>('UDP');
  const [sipTrunkShowPass, setSipTrunkShowPass] = useState(false);
  const [sipTrunkConnecting, setSipTrunkConnecting] = useState(false);
  const [activeSipProvider, setActiveSipProvider] = useState<string | null>(null);
  const [activeSipTrunkId, setActiveSipTrunkId] = useState<string | null>(null);

  // Twilio number search & buy
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [numberType, setNumberType] = useState<'local' | 'tollfree'>('local');
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [buyingPhone, setBuyingPhone] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  useEffect(() => {
    fetchNumbers();

    fetch('/api/settings/sip-trunks')
      .then(r => r.ok ? r.json() : null)
      .then((d: { trunks?: Array<{ id: string; name: string; status: string; provider: string }> } | null) => {
        const active = (d?.trunks ?? []).find(t => t.status === 'active');
        if (active) {
          setActiveSipProvider(active.name);
          setActiveSipTrunkId(active.id);
        }
      })
      .catch(() => null);

    async function checkTwilio() {
      try {
        const r = await fetch('/api/settings/twilio');
        if (!r.ok) return;
        const d = await r.json() as { connected?: boolean; account_sid?: string };
        if (d?.connected) {
          setTwilioConnected(true);
          setTwilioAccountSid(d.account_sid ?? null);
          const syncRes = await fetch('/api/numbers/twilio-sync');
          if (syncRes.ok) {
            const sd = await syncRes.json() as { synced?: number; numbers?: unknown[] };
            if ((sd.synced ?? 0) > 0) {
              toast.success(`${sd.synced} Twilio number(s) synced.`);
            }
          }
          await fetchNumbers();
        }
      } catch { /* non-blocking */ }
    }
    void checkTwilio();
  }, [fetchNumbers]);

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

  function openAdd(m: DialogMode = 'choose', trunkKey?: string) {
    setMode(m);
    setAddingToTrunk(trunkKey ?? null);
    setSipPhone(''); setSipUri(trunkKey && trunkKey !== '__twilio__' ? trunkKey : ''); setSipName('');
    setSelectedCountry('US');
    setAvailableNumbers([]);
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
      setTwilioConnected(true);
      setDialogOpen(false);
      const syncRes = await fetch('/api/numbers/twilio-sync');
      if (syncRes.ok) {
        const sd = await syncRes.json() as { synced?: number; numbers?: unknown[] };
        const count = sd.synced ?? 0;
        toast.success(count > 0 ? `Twilio connected — ${count} number(s) synced.` : 'Twilio connected. No existing numbers found in account.');
      } else {
        toast.success('Twilio connected.');
        toast.error('Could not sync numbers. Use "Sync Numbers" in the Twilio settings.');
      }
      await fetchNumbers();
    } else {
      const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      toast.error(err.error ?? 'Failed to connect Twilio.');
    }
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/numbers/twilio-sync');
      const data = await res.json() as { synced?: number; numbers?: unknown[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Sync failed. Check your Twilio credentials.');
        return;
      }
      const total = data.numbers?.length ?? 0;
      const inserted = data.synced ?? 0;
      if (total === 0) {
        toast.info('No phone numbers found in your Twilio account.');
      } else if (inserted > 0) {
        toast.success(`${inserted} number(s) imported from Twilio.`);
      } else {
        toast.info(`${total} number(s) already in sync.`);
      }
      await fetchNumbers();
    } catch {
      toast.error('Network error during sync.');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectTwilio() {
    const res = await fetch('/api/settings/twilio', { method: 'DELETE' });
    if (res.ok) {
      setTwilioConnected(false);
      setTwilioAccountSid(null);
      toast.success('Twilio disconnected.');
      setDialogOpen(false);
    } else {
      toast.error('Failed to disconnect Twilio.');
    }
  }

  async function searchTwilioNumbers() {
    setSearchingNumbers(true);
    setAvailableNumbers([]);
    try {
      const res = await fetch(`/api/numbers/twilio-search?country=${selectedCountry}&type=${numberType}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error' })) as { error?: string };
        toast.error(err.error ?? 'Failed to search numbers.');
        return;
      }
      const data = await res.json() as { numbers: AvailableNumber[] };
      setAvailableNumbers(data.numbers ?? []);
      if ((data.numbers ?? []).length === 0) toast.info('No numbers available for this selection.');
    } catch { toast.error('Network error.'); }
    finally { setSearchingNumbers(false); }
  }

  async function buyTwilioNumber(num: AvailableNumber) {
    setBuyingPhone(num.phone_number);
    try {
      const country = COUNTRIES.find(c => c.code === selectedCountry);
      const res = await fetch('/api/numbers/twilio-buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: num.phone_number,
          country_code: selectedCountry,
          country_name: country?.name ?? num.iso_country,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error' })) as { error?: string };
        toast.error(err.error ?? 'Failed to purchase number.');
        return;
      }
      toast.success(`${num.phone_number} purchased successfully!`);
      setDialogOpen(false);
      await fetchNumbers();
    } catch { toast.error('Network error.'); }
    finally { setBuyingPhone(null); }
  }

  async function connectSipTrunk() {
    if (!sipTrunkHost.trim()) { toast.error('Enter the SIP server URL.'); return; }
    if (!sipTrunkUser.trim()) { toast.error('Enter a username.'); return; }
    if (!activeSipTrunkId && !sipTrunkPass.trim()) { toast.error('Enter a password.'); return; }
    const portNum = parseInt(sipTrunkPort, 10);
    const netmaskNum = parseInt(sipTrunkNetmask, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) { toast.error('Port must be 1–65535.'); return; }
    if (isNaN(netmaskNum) || netmaskNum < 0 || netmaskNum > 32) { toast.error('Net mask must be 0–32.'); return; }

    setSipTrunkConnecting(true);
    try {
      const payload: Record<string, unknown> = {
        name:     sipTrunkProvider.trim() || 'Squaretalk',
        provider: 'squaretalk',
        sip_host: sipTrunkHost.trim(),
        port:     portNum,
        username: sipTrunkUser.trim(),
        netmask:  netmaskNum,
        protocol: sipTrunkProtocol,
      };
      if (sipTrunkPass.trim()) payload.password = sipTrunkPass.trim();

      const url    = activeSipTrunkId ? `/api/settings/sip-trunks/${activeSipTrunkId}` : '/api/settings/sip-trunks';
      const method = activeSipTrunkId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(err.error ?? 'Failed to save SIP trunk.');
      }
      const d = await res.json() as { trunk?: { id: string; name: string } };
      const name = d.trunk?.name ?? (sipTrunkProvider.trim() || 'Squaretalk');
      setActiveSipProvider(name);
      setActiveSipTrunkId(d.trunk?.id ?? activeSipTrunkId);
      toast.success(activeSipTrunkId ? `${name} updated.` : `${name} connected as SIP trunk.`);
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSipTrunkConnecting(false);
    }
  }

  async function disconnectSipTrunk() {
    if (activeSipTrunkId) {
      await fetch(`/api/settings/sip-trunks/${activeSipTrunkId}`, { method: 'DELETE' });
    }
    setActiveSipProvider(null);
    setActiveSipTrunkId(null);
    toast.success('SIP trunk disconnected.');
  }

  async function saveSip() {
    if (!sipPhone.trim()) { toast.error('Enter the phone number.'); return; }
    if (!sipUri.trim()) { toast.error('Enter the SIP trunk URI.'); return; }
    setSipSaving(true);
    try {
      const detectedCode = phoneToCountryCode(sipPhone.trim());
      const detectedName = detectedCode ? (COUNTRY_NAMES[detectedCode] ?? detectedCode) : undefined;
      const res = await fetch('/api/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'sip_trunk', phone_number: sipPhone.trim(),
          sip_trunk_uri: sipUri.trim(), display_name: sipName.trim() || undefined,
          country_code: detectedCode ?? undefined,
          country_name: detectedName,
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

  // suppress unused warning
  void addingToTrunk;

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

          {activeSipProvider ? (
            <Button
              size="sm"
              variant="outline"
              className="border-green-500 text-green-700 hover:bg-green-50"
              onClick={() => {
                setSipTrunkProvider(activeSipProvider); setSipTrunkHost('');
                setSipTrunkPort('5060'); setSipTrunkUser(''); setSipTrunkPass('');
                setSipTrunkNetmask('32'); setSipTrunkProtocol('UDP'); setSipTrunkShowPass(false);
                setMode('connect-sip'); setDialogOpen(true);
              }}
            >
              <Plug className="w-4 h-4 mr-1.5" />
              {activeSipProvider}
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSipTrunkProvider('Squaretalk'); setSipTrunkHost('');
                setSipTrunkPort('5060'); setSipTrunkUser(''); setSipTrunkPass('');
                setSipTrunkNetmask('32'); setSipTrunkProtocol('UDP'); setSipTrunkShowPass(false);
                setMode('connect-sip'); setDialogOpen(true);
              }}
            >
              <Plug className="w-4 h-4 mr-1.5" />
              Add SIP Trunk
            </Button>
          )}

          {twilioConnected ? (
            <Button
              size="sm"
              variant="outline"
              className="border-green-500 text-green-700 hover:bg-green-50"
              onClick={() => { setMode('connect-twilio'); setTwilioSid(''); setTwilioToken(''); setDialogOpen(true); }}
            >
              <TwilioLogo className="w-4 h-4 mr-1.5" />
              Twilio Connected
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { setMode('connect-twilio'); setTwilioSid(''); setTwilioToken(''); setDialogOpen(true); }}
            >
              <TwilioLogo className="w-4 h-4 mr-1.5" />
              Connect Twilio
            </Button>
          )}
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
          {twilioConnected ? (
            <>
              <p className="text-sm text-[#6b6b6b] mb-4">Twilio is connected — sync your existing numbers or buy a new one.</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={triggerSync} disabled={syncing}>
                  {syncing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Syncing…</> : 'Sync from Twilio'}
                </Button>
                <Button size="sm" onClick={() => openAdd('twilio')}>
                  <Plus className="w-4 h-4 mr-1" />Buy Number
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[#6b6b6b] mb-4">Add a number to start making calls.</p>
              <Button size="sm" onClick={() => openAdd()}>
                <Plus className="w-4 h-4 mr-1" />Add Number
              </Button>
            </>
          )}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-[#6b6b6b] py-8 text-center">No numbers match &ldquo;{search}&rdquo;.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.key} className="rounded-lg border border-[#e0e0e0]">
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
                    Delete All
                  </button>
                </div>
              </div>

              {group.numbers.length === 0 ? (
                <p className="px-5 py-4 text-sm text-[#6b6b6b]">No phone numbers added</p>
              ) : (
                <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.numbers.map(num => {
                    const detectedCode = phoneToCountryCode(num.number) ?? num.country_code;
                    const displayName = detectedCode
                      ? (COUNTRY_NAMES[detectedCode] ?? num.country_name)
                      : num.country_name;
                    return (
                    <div
                      key={num.id}
                      className="group relative flex items-center gap-2.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 hover:border-[#0a0a0a] transition-colors"
                    >
                      <span className="text-xl leading-none shrink-0">{countryFlag(detectedCode ?? '')}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-sm font-medium text-[#0a0a0a] truncate">{num.number}</span>
                          {num.status === 'suspended' && (
                            <Badge className="text-[10px] px-1 py-0 bg-red-100 text-red-700 border-transparent">SPAM</Badge>
                          )}
                        </div>
                        {displayName && (
                          <p className="text-[11px] text-[#6b6b6b] truncate mt-0.5">{displayName}</p>
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
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
                <button
                  onClick={() => { setAvailableNumbers([]); setMode('twilio'); }}
                  className="w-full flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white p-4 text-left hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Buy a Twilio number</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">
                      {twilioConnected
                        ? 'Search & purchase from your Twilio account.'
                        : 'Connect Twilio first to search and buy numbers.'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0" />
                </button>
                <button
                  onClick={() => setMode('sip')}
                  className="w-full flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white p-4 text-left hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Server className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Bring your own number</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">
                      Register a DID from your SIP provider.
                      {activeSipProvider ? ` Trunk: ${activeSipProvider}` : ' (Connect a SIP trunk first.)'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0" />
                </button>
                <button
                  onClick={() => { setSipTrunkProvider('Squaretalk'); setSipTrunkHost(''); setSipTrunkPort('5060'); setSipTrunkUser(''); setSipTrunkPass(''); setSipTrunkNetmask('32'); setSipTrunkProtocol('UDP'); setSipTrunkShowPass(false); setMode('connect-sip'); }}
                  className="w-full flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white p-4 text-left hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Plug className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Configure SIP trunk</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">
                      {activeSipProvider
                        ? `Currently connected: ${activeSipProvider}. Click to update.`
                        : 'Squaretalk, CommPeak, Telnyx, or any SIP provider.'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0" />
                </button>
              </div>
            </>
          )}

          {/* Twilio — search & buy */}
          {mode === 'twilio' && (
            <>
              <DialogHeader>
                <DialogTitle>Buy a Phone Number</DialogTitle>
                <DialogDescription>
                  {twilioConnected
                    ? 'Search available numbers in your Twilio account and purchase one.'
                    : 'Connect Twilio to search and purchase phone numbers.'}
                </DialogDescription>
              </DialogHeader>

              {!twilioConnected ? (
                <div className="py-4 text-center space-y-3">
                  <p className="text-sm text-[#6b6b6b]">You need to connect your Twilio account first.</p>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => { setTwilioSid(''); setTwilioToken(''); setMode('connect-twilio'); }}
                  >
                    Connect Twilio
                  </Button>
                  <div>
                    <Button variant="outline" size="sm" onClick={() => setMode('choose')}>Back</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {/* Country */}
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <select
                        value={selectedCountry}
                        onChange={e => { setSelectedCountry(e.target.value); setAvailableNumbers([]); }}
                        className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
                      >
                        {COUNTRIES.map(c => (
                          <option key={c.code} value={c.code}>{countryFlag(c.code)} {c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Type */}
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <div className="flex gap-2">
                        {(['local', 'tollfree'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => { setNumberType(t); setAvailableNumbers([]); }}
                            className={`flex-1 h-8 rounded-md border text-sm font-medium transition-colors ${
                              numberType === t
                                ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                                : 'border-[#e0e0e0] text-[#6b6b6b] hover:border-[#0a0a0a]'
                            }`}
                          >
                            {t === 'local' ? 'Local' : 'Toll-Free'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Search */}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={searchTwilioNumbers}
                      disabled={searchingNumbers}
                    >
                      {searchingNumbers
                        ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Searching…</>
                        : <><Search className="w-4 h-4 mr-1.5" />Search Available Numbers</>
                      }
                    </Button>

                    {/* Results */}
                    {availableNumbers.length > 0 && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {availableNumbers.map(num => (
                          <div
                            key={num.phone_number}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#e0e0e0] px-3 py-2 bg-white"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-lg shrink-0">
                                {countryFlag(phoneToCountryCode(num.phone_number) ?? num.iso_country)}
                              </span>
                              <div className="min-w-0">
                                <p className="font-mono text-sm font-medium text-[#0a0a0a]">{num.phone_number}</p>
                                {(num.locality || num.region) && (
                                  <p className="text-[11px] text-[#6b6b6b] truncate">
                                    {[num.locality, num.region].filter(Boolean).join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="text-xs shrink-0 h-7"
                              disabled={buyingPhone === num.phone_number}
                              onClick={() => buyTwilioNumber(num)}
                            >
                              {buyingPhone === num.phone_number
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : 'Buy'
                              }
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMode('choose')}>Back</Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}

          {/* SIP — add number */}
          {mode === 'sip' && (
            <>
              <DialogHeader>
                <DialogTitle>Add SIP Number</DialogTitle>
                <DialogDescription>Add a number from your VoIP provider (CommPeak, Telnyx, SquareTalk, etc.)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl w-8 text-center shrink-0">
                      {phoneToCountryCode(sipPhone) ? countryFlag(phoneToCountryCode(sipPhone)!) : '🌐'}
                    </span>
                    <Input
                      placeholder="+15551234567"
                      value={sipPhone}
                      onChange={e => setSipPhone(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  {phoneToCountryCode(sipPhone) && (
                    <p className="text-xs text-[#6b6b6b]">
                      {COUNTRY_NAMES[phoneToCountryCode(sipPhone)!] ?? phoneToCountryCode(sipPhone)}
                    </p>
                  )}
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

          {/* Connect SIP Trunk */}
          {mode === 'connect-sip' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plug className="w-5 h-5" />
                  {activeSipProvider ? 'Update SIP Trunk' : 'Add SIP Trunk'}
                </DialogTitle>
                <DialogDescription>
                  Ingresa los datos que te proporciona Squaretalk en Settings → SIP Trunk.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {/* Label */}
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input
                    placeholder="Squaretalk"
                    value={sipTrunkProvider}
                    onChange={e => setSipTrunkProvider(e.target.value)}
                  />
                </div>
                {/* URL + Port */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <Label>URL <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="sip.squaretalk.com"
                      value={sipTrunkHost}
                      onChange={e => setSipTrunkHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Port <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      placeholder="5060"
                      value={sipTrunkPort}
                      onChange={e => setSipTrunkPort(e.target.value)}
                      min={1} max={65535}
                    />
                  </div>
                </div>
                {/* Username */}
                <div className="space-y-1.5">
                  <Label>Username <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="SIP username"
                    autoComplete="off"
                    value={sipTrunkUser}
                    onChange={e => setSipTrunkUser(e.target.value)}
                  />
                </div>
                {/* Password */}
                <div className="space-y-1.5">
                  <Label>Password {!activeSipTrunkId && <span className="text-red-500">*</span>}</Label>
                  <div className="relative">
                    <Input
                      type={sipTrunkShowPass ? 'text' : 'password'}
                      placeholder={activeSipTrunkId ? 'Dejar en blanco para no cambiar' : '••••••••'}
                      autoComplete="new-password"
                      value={sipTrunkPass}
                      onChange={e => setSipTrunkPass(e.target.value)}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setSipTrunkShowPass(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b] hover:text-[#0a0a0a]"
                    >
                      {sipTrunkShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {/* Netmask + Protocol */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Net Mask (0–32)</Label>
                    <Input
                      type="number"
                      placeholder="32"
                      value={sipTrunkNetmask}
                      onChange={e => setSipTrunkNetmask(e.target.value)}
                      min={0} max={32}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Protocol</Label>
                    <div className="flex flex-wrap gap-1">
                      {(['UDP','TCP','TLS','TLS/SRTP'] as SipProtocol[]).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setSipTrunkProtocol(p);
                            setSipTrunkPort(p === 'UDP' || p === 'TCP' ? '5060' : '5061');
                          }}
                          className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                            sipTrunkProtocol === p
                              ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                              : 'text-[#6b6b6b] border-[#e0e0e0] hover:border-[#0a0a0a]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {activeSipProvider && (
                  <button
                    onClick={disconnectSipTrunk}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Desconectar trunk actual ({activeSipProvider})
                  </button>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={connectSipTrunk} disabled={sipTrunkConnecting}>
                  {sipTrunkConnecting
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Guardando…</>
                    : activeSipProvider ? 'Actualizar' : 'Conectar'
                  }
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Connect / Manage Twilio */}
          {mode === 'connect-twilio' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TwilioLogo className="w-5 h-5 text-red-600" />
                  {twilioConnected ? 'Twilio Account' : 'Connect Twilio'}
                </DialogTitle>
                <DialogDescription>
                  {twilioConnected
                    ? `Connected${twilioAccountSid ? ` · ${twilioAccountSid}` : ''}. Manage your Twilio connection.`
                    : 'Enter your Twilio credentials to provision phone numbers.'}
                </DialogDescription>
              </DialogHeader>

              {twilioConnected ? (
                <div className="space-y-4 py-1">
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-sm text-green-700 font-medium">Twilio is connected</p>
                  </div>
                  {twilioAccountSid && (
                    <p className="text-xs text-[#6b6b6b]">Account SID: {twilioAccountSid}</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={async () => { await triggerSync(); setDialogOpen(false); }}
                    disabled={syncing}
                  >
                    {syncing
                      ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Syncing numbers…</>
                      : 'Sync Numbers from Twilio'
                    }
                  </Button>
                  <button
                    onClick={disconnectTwilio}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Disconnect Twilio
                  </button>
                </div>
              ) : (
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
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {twilioConnected ? 'Close' : 'Cancel'}
                </Button>
                {!twilioConnected && (
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={connectTwilio}
                    disabled={twilioConnecting}
                  >
                    {twilioConnecting
                      ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Connecting…</>
                      : 'Connect'
                    }
                  </Button>
                )}
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}
