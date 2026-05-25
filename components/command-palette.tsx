'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'cmdk';
import {
  BarChart2, Bot, CreditCard, DollarSign, Globe, Key,
  LayoutDashboard, Megaphone, Phone, PhoneCall, Plus,
  Radio, Settings, ShieldCheck, Star, Users,
} from 'lucide-react';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const navigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const commands: CommandAction[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard'), group: 'Navigate' },
    { id: 'nav-agents', label: 'Go to Agents', icon: Bot, action: () => navigate('/agents'), group: 'Navigate' },
    { id: 'nav-campaigns', label: 'Go to Campaigns', icon: Megaphone, action: () => navigate('/campaigns'), group: 'Navigate' },
    { id: 'nav-calls', label: 'Go to Calls', icon: PhoneCall, action: () => navigate('/calls'), group: 'Navigate' },
    { id: 'nav-live', label: 'Live Monitor', icon: Radio, action: () => navigate('/calls/live'), group: 'Navigate' },
    { id: 'nav-analytics', label: 'Go to Analytics', icon: BarChart2, action: () => navigate('/analytics'), group: 'Navigate' },
    { id: 'nav-costs', label: 'Cost Analytics', icon: DollarSign, action: () => navigate('/analytics/costs'), group: 'Navigate' },
    { id: 'nav-quality', label: 'Quality Center', icon: Star, action: () => navigate('/quality'), group: 'Navigate' },
    { id: 'nav-numbers', label: 'Phone Numbers', icon: Phone, action: () => navigate('/numbers'), group: 'Navigate' },
    { id: 'nav-compliance', label: 'Compliance Center', icon: ShieldCheck, action: () => navigate('/compliance'), group: 'Navigate' },
    { id: 'nav-integrations', label: 'Integrations', icon: Globe, action: () => navigate('/integrations'), group: 'Navigate' },
    { id: 'nav-team', label: 'Team', icon: Users, action: () => navigate('/team'), group: 'Navigate' },
    { id: 'nav-billing', label: 'Billing', icon: CreditCard, action: () => navigate('/billing'), group: 'Navigate' },
    { id: 'nav-settings', label: 'Settings', icon: Settings, action: () => navigate('/settings'), group: 'Navigate' },
    { id: 'nav-api-keys', label: 'API Keys', icon: Key, action: () => navigate('/settings/api-keys'), group: 'Navigate' },
    // Quick actions
    { id: 'create-agent', label: 'Create New Agent', description: 'Open agent creation wizard', icon: Bot, action: () => navigate('/agents/new'), group: 'Quick Actions' },
    { id: 'create-campaign', label: 'Create New Campaign', description: 'Launch campaign wizard', icon: Megaphone, action: () => navigate('/campaigns/new'), group: 'Quick Actions' },
    { id: 'new-number', label: 'Provision Phone Number', description: 'Get a new phone number', icon: Phone, action: () => navigate('/numbers'), group: 'Quick Actions' },
    { id: 'new-api-key', label: 'Generate API Key', description: 'Create a programmatic access key', icon: Key, action: () => navigate('/settings/api-keys'), group: 'Quick Actions' },
    { id: 'go-live', label: 'Open Live Monitor', description: 'Watch calls in real time', icon: Radio, action: () => navigate('/calls/live'), group: 'Quick Actions' },
  ];

  const groups = [...new Set(commands.map(c => c.group))];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command className="rounded-xl border border-[#e0e0e0] shadow-2xl overflow-hidden bg-white">
        <div className="border-b border-[#e0e0e0]">
          <CommandInput
            placeholder="Search pages and actions…"
            className="h-12 px-4 text-sm outline-none w-full bg-transparent"
          />
        </div>
        <CommandList className="max-h-80 overflow-y-auto p-2">
          <CommandEmpty className="py-6 text-center text-sm text-[#6b6b6b]">No results found.</CommandEmpty>
          {groups.map((group, gi) => (
            <CommandGroup key={group} heading={group} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[#6b6b6b]">
              {commands.filter(c => c.group === group).map(cmd => (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.description ?? ''}`}
                  onSelect={cmd.action}
                  className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer aria-selected:bg-[#f5f5f5] text-[#0a0a0a] text-sm"
                >
                  <cmd.icon className="h-4 w-4 text-[#6b6b6b] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{cmd.label}</span>
                    {cmd.description && <span className="ml-2 text-xs text-[#6b6b6b]">{cmd.description}</span>}
                  </div>
                </CommandItem>
              ))}
              {gi < groups.length - 1 && <CommandSeparator className="my-1 h-px bg-[#f5f5f5]" />}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="border-t border-[#e0e0e0] px-4 py-2 flex items-center gap-4 text-xs text-[#6b6b6b]">
          <span><kbd className="font-mono bg-[#f5f5f5] px-1.5 py-0.5 rounded text-xs">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-[#f5f5f5] px-1.5 py-0.5 rounded text-xs">↵</kbd> select</span>
          <span><kbd className="font-mono bg-[#f5f5f5] px-1.5 py-0.5 rounded text-xs">esc</kbd> close</span>
          <span className="ml-auto"><kbd className="font-mono bg-[#f5f5f5] px-1.5 py-0.5 rounded text-xs">⌘K</kbd></span>
        </div>
      </Command>
    </CommandDialog>
  );
}

// Trigger button for header
export function CommandPaletteTrigger() {
  const [, setOpen] = useState(false);

  function openPalette() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  }

  return (
    <button
      onClick={openPalette}
      className="hidden md:flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-white px-3 py-1.5 text-sm text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      <span>Search</span>
      <kbd className="ml-1 font-mono text-xs bg-[#f5f5f5] px-1.5 py-0.5 rounded">⌘K</kbd>
    </button>
  );
}
