'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertTriangle, BellOff, Globe, Lock } from 'lucide-react';

export function AdminSettingsForm() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [newRegistrations, setNewRegistrations] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      // In a real system, persist these flags to a platform_settings table
      await new Promise((r) => setTimeout(r, 600));
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-white border-[#e5e5e5]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Operational Controls</CardTitle>
        <CardDescription className="text-xs">
          Platform-wide kill switches. Changes take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Maintenance mode */}
        <div className="flex items-start justify-between rounded-xl border border-[#e5e5e5] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#0a0a0a]">Maintenance Mode</p>
              <p className="text-xs text-[#6b6b6b] mt-0.5">
                Blocks all new call token requests. Active calls continue unaffected.
              </p>
            </div>
          </div>
          <button
            onClick={() => setMaintenanceMode((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
              maintenanceMode ? 'bg-amber-500' : 'bg-[#e0e0e0]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                maintenanceMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* New registrations */}
        <div className="flex items-start justify-between rounded-xl border border-[#e5e5e5] p-4">
          <div className="flex items-start gap-3">
            <Lock className="h-4 w-4 text-[#6b6b6b] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#0a0a0a]">New Registrations</p>
              <p className="text-xs text-[#6b6b6b] mt-0.5">
                When disabled, sign-ups are blocked. Existing users can still log in.
              </p>
            </div>
          </div>
          <button
            onClick={() => setNewRegistrations((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
              newRegistrations ? 'bg-[#0a0a0a]' : 'bg-[#e0e0e0]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                newRegistrations ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Webhook delivery */}
        <div className="flex items-start justify-between rounded-xl border border-[#e5e5e5] p-4 opacity-60 cursor-not-allowed">
          <div className="flex items-start gap-3">
            <Globe className="h-4 w-4 text-[#6b6b6b] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#0a0a0a]">Customer Webhooks</p>
              <p className="text-xs text-[#6b6b6b] mt-0.5">
                Global pause for outbound webhook delivery (circuit breaker).
              </p>
            </div>
          </div>
          <span className="text-xs text-[#a0a0a0] mt-1">Always on</span>
        </div>

        {/* Notifications */}
        <div className="flex items-start justify-between rounded-xl border border-[#e5e5e5] p-4 opacity-60 cursor-not-allowed">
          <div className="flex items-start gap-3">
            <BellOff className="h-4 w-4 text-[#6b6b6b] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#0a0a0a]">Email Notifications</p>
              <p className="text-xs text-[#6b6b6b] mt-0.5">
                Mute all automated transactional emails (limit alerts, billing).
              </p>
            </div>
          </div>
          <span className="text-xs text-[#a0a0a0] mt-1">Always on</span>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm" className="text-xs">
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
