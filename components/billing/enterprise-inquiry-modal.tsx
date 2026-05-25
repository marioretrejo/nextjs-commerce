'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const VOLUME_OPTIONS = [
  { value: 'lt_1k', label: 'Less than 1,000 calls/month' },
  { value: '1k_10k', label: '1,000 – 10,000 calls/month' },
  { value: '10k_50k', label: '10,000 – 50,000 calls/month' },
  { value: '50k_100k', label: '50,000 – 100,000 calls/month' },
  { value: 'gt_100k', label: 'More than 100,000 calls/month' },
];

export function EnterpriseInquiryModal() {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [volume, setVolume] = useState('');
  const [countries, setCountries] = useState('');
  const [phoneSystem, setPhoneSystem] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!company.trim() || !volume) {
      toast.error('Company name and call volume are required');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/billing/enterprise-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, volume, countries, phone_system: phoneSystem, message }),
      });
      if (res.ok) {
        toast.success("Thanks! We'll be in touch within 1 business day.");
        setOpen(false);
        setCompany(''); setVolume(''); setCountries(''); setPhoneSystem(''); setMessage('');
      } else {
        const d = await res.json() as { error?: string };
        toast.error(d.error ?? 'Failed to send inquiry');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button size="sm" className="w-full text-xs" onClick={() => setOpen(true)}>
        Contact Sales
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enterprise Inquiry</DialogTitle>
            <DialogDescription>
              Tell us about your needs and our team will craft a custom plan for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Company name <span className="text-[#0a0a0a]">*</span></Label>
              <Input
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly call volume <span className="text-[#0a0a0a]">*</span></Label>
              <Select value={volume} onValueChange={setVolume}>
                <SelectTrigger>
                  <SelectValue placeholder="Select volume" />
                </SelectTrigger>
                <SelectContent>
                  {VOLUME_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Countries / regions <span className="text-xs text-[#6b6b6b]">(optional)</span></Label>
              <Input
                value={countries}
                onChange={e => setCountries(e.target.value)}
                placeholder="US, Mexico, Colombia…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Current phone system <span className="text-xs text-[#6b6b6b]">(optional)</span></Label>
              <Input
                value={phoneSystem}
                onChange={e => setPhoneSystem(e.target.value)}
                placeholder="e.g. Twilio, Genesys, Amazon Connect"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message <span className="text-xs text-[#6b6b6b]">(optional)</span></Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us about your use case, integrations needed, or any specific requirements."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={sending || !company.trim() || !volume}>
              {sending ? 'Sending…' : 'Send Inquiry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
