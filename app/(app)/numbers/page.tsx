'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { PhoneNumber, PhoneStatus } from '@/lib/supabase/types';
import { Phone, Globe, Plus, Trash2, Bot, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
];

function statusBadge(status: PhoneStatus) {
  const map: Record<PhoneStatus, { label: string; className: string }> = {
    available:  { label: 'Available',  className: 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]' },
    in_use:     { label: 'In Use',     className: 'bg-[#0a0a0a] text-white border-transparent' },
    suspended:  { label: 'Suspended',  className: 'bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]' },
  };
  const s = map[status];
  return <Badge className={s.className}>{s.label}</Badge>;
}

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [requesting, setRequesting] = useState(false);
  const [releaseId, setReleaseId] = useState<string | null>(null);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/numbers?limit=100');
    if (res.ok) {
      const d = await res.json() as { numbers: PhoneNumber[] };
      setNumbers(d.numbers ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNumbers(); }, [fetchNumbers]);

  async function requestNumber() {
    setRequesting(true);
    const country = COUNTRIES.find(c => c.code === selectedCountry);
    const res = await fetch('/api/numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country_code: selectedCountry, country_name: country?.name }),
    });
    if (res.ok) {
      await fetchNumbers();
      setRequestDialogOpen(false);
    }
    setRequesting(false);
  }

  async function releaseNumber(id: string) {
    setReleaseId(id);
    await fetch(`/api/numbers/${id}`, { method: 'DELETE' });
    await fetchNumbers();
    setReleaseId(null);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Phone Numbers</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Manage your provisioned phone numbers and assignments.</p>
        </div>
        <Button onClick={() => setRequestDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Request Number
        </Button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Numbers', value: numbers.length },
          { label: 'In Use',        value: numbers.filter(n => n.status === 'in_use').length },
          { label: 'Available',     value: numbers.filter(n => n.status === 'available').length },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Phone className="w-4 h-4 text-[#6b6b6b]" />
              <div>
                <p className="text-2xl font-bold text-[#0a0a0a]">{s.value}</p>
                <p className="text-xs text-[#6b6b6b]">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Numbers list */}
      <Card>
        {loading ? (
          <CardContent className="p-0">
            <div className="divide-y divide-[#e0e0e0]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-36 h-4 bg-[#f5f5f5] rounded animate-pulse" />
                  <div className="w-24 h-4 bg-[#f5f5f5] rounded animate-pulse" />
                  <div className="w-20 h-4 bg-[#f5f5f5] rounded animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        ) : numbers.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Phone className="w-12 h-12 text-[#e0e0e0] mb-4" />
            <p className="text-[#0a0a0a] font-medium mb-1">No phone numbers yet</p>
            <p className="text-sm text-[#6b6b6b] mb-4">Request your first number to start making calls.</p>
            <Button size="sm" onClick={() => setRequestDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Request Number
            </Button>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_160px] gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
              <span>Number</span>
              <span>Country</span>
              <span>Provider</span>
              <span>Status</span>
              <span>Assigned Agent</span>
              <span />
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {numbers.map((num) => (
                <div
                  key={num.id}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_160px] gap-3 px-5 py-4 text-sm items-center hover:bg-[#f5f5f5]"
                >
                  <span className="font-mono font-medium text-[#0a0a0a] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#6b6b6b] shrink-0" />
                    {num.number}
                  </span>
                  <span className="text-[#6b6b6b] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    {num.country_name}
                  </span>
                  <span className="text-[#6b6b6b] capitalize">{num.provider}</span>
                  <span>{statusBadge(num.status)}</span>
                  <span className="text-[#6b6b6b] flex items-center gap-1.5 truncate">
                    {num.agent ? (
                      <>
                        <Bot className="w-3.5 h-3.5 shrink-0" />
                        {(num.agent as unknown as { name: string }).name}
                      </>
                    ) : (
                      <span className="text-[#6b6b6b]">—</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 justify-end">
                    <Link href={`/numbers/${num.id}/routing`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        <Settings2 className="w-3.5 h-3.5 mr-1" />
                        Routing
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={releaseId === num.id || num.status === 'in_use'}
                      onClick={() => releaseNumber(num.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Release
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {!loading && numbers.length > 0 && (
        <p className="mt-3 text-xs text-[#6b6b6b] text-right">
          Numbers provisioned since {numbers.length > 0 ? format(new Date(numbers[numbers.length - 1]?.created_at ?? ''), 'MMM yyyy') : '—'}
        </p>
      )}

      {/* Request dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Phone Number</DialogTitle>
            <DialogDescription>
              Select a country to provision a new phone number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="country-select">Country</Label>
            <select
              id="country-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#6b6b6b]">
              Numbers are provisioned via Twilio or Telnyx and billed monthly.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={requestNumber} disabled={requesting}>
              {requesting ? 'Requesting…' : 'Request Number'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
