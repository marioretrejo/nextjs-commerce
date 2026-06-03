'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, ShieldCheck, AlertTriangle, Zap, Info } from 'lucide-react';
import { toast } from 'sonner';

interface ComplianceRule {
  id:          string;
  rule_name:   string;
  description: string;
  category:    'disclosure' | 'prohibited' | 'required' | 'quality' | 'general';
  severity:    'low' | 'medium' | 'high' | 'critical';
  is_active:   boolean;
  created_at:  string;
}

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      class: 'bg-gray-100 text-gray-600 border-gray-200' },
  medium:   { label: 'Medium',   class: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  high:     { label: 'High',     class: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', class: 'bg-red-100 text-red-700 border-red-200' },
};

const CATEGORY_CONFIG = {
  disclosure: { label: 'Disclosure',  icon: Info,          class: 'bg-blue-50 text-blue-700 border-blue-200' },
  prohibited: { label: 'Prohibited',  icon: AlertTriangle, class: 'bg-red-50 text-red-700 border-red-200' },
  required:   { label: 'Required',    icon: ShieldCheck,   class: 'bg-green-50 text-green-700 border-green-200' },
  quality:    { label: 'Quality',     icon: Zap,           class: 'bg-purple-50 text-purple-700 border-purple-200' },
  general:    { label: 'General',     icon: ShieldCheck,   class: 'bg-gray-50 text-gray-700 border-gray-200' },
};

type Category = ComplianceRule['category'];
type Severity  = ComplianceRule['severity'];
type RuleForm  = { rule_name: string; description: string; category: Category; severity: Severity };
const EMPTY_FORM: RuleForm = { rule_name: '', description: '', category: 'general', severity: 'medium' };

export function QARulesManager() {
  const [rules, setRules]         = useState<ComplianceRule[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<ComplianceRule | null>(null);
  const [form, setForm]           = useState<RuleForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compliance/rules');
      if (res.ok) setRules(await res.json() as ComplianceRule[]);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(rule: ComplianceRule) {
    setEditing(rule);
    setForm({
      rule_name:   rule.rule_name,
      description: rule.description,
      category:    rule.category as Category,
      severity:    rule.severity as Severity,
    });
    setModalOpen(true);
  }

  async function saveRule() {
    if (!form.rule_name.trim() || !form.description.trim()) {
      toast.error('Rule name and description are required');
      return;
    }
    setSaving(true);
    try {
      const url     = editing ? `/api/compliance/rules/${editing.id}` : '/api/compliance/rules';
      const method  = editing ? 'PATCH' : 'POST';
      const res     = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const saved = await res.json() as ComplianceRule;
      if (editing) {
        setRules(r => r.map(x => x.id === saved.id ? saved : x));
        toast.success('Rule updated');
      } else {
        setRules(r => [saved, ...r]);
        toast.success('Rule created');
      }
      setModalOpen(false);
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  async function toggleActive(rule: ComplianceRule) {
    try {
      const res = await fetch(`/api/compliance/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setRules(r => r.map(x => x.id === rule.id ? { ...x, is_active: !x.is_active } : x));
    } catch (e) { toast.error(String(e)); }
  }

  async function deleteRule(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/compliance/rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setRules(r => r.filter(x => x.id !== id));
      toast.success('Rule deleted');
    } catch (e) { toast.error(String(e)); }
    finally { setDeleting(null); }
  }

  const active   = rules.filter(r => r.is_active).length;
  const inactive = rules.length - active;

  return (
    <>
      {/* Rule modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {editing ? 'Edit Compliance Rule' : 'New Compliance Rule'}
            </DialogTitle>
            <DialogDescription>
              Define what the agent must say, avoid, or be evaluated on during calls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g. Investment Risk Disclosure"
                value={form.rule_name}
                onChange={e => setForm(f => ({ ...f, rule_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-[#a0a0a0] text-xs">(what the evaluator checks)</span></Label>
              <Textarea
                rows={3}
                placeholder="e.g. The agent must mention that investments carry risk and past performance does not guarantee future results."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as typeof f.category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disclosure">Disclosure</SelectItem>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="prohibited">Prohibited</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v as typeof f.severity }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveRule} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? 'Saving…' : editing ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main content */}
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#0a0a0a]">QA Compliance Rules</h3>
            <p className="text-xs text-[#6b6b6b] mt-0.5">
              {rules.length === 0
                ? 'No rules yet. Create your first rule to start evaluating calls.'
                : `${active} active · ${inactive} inactive — applied to every post-call analysis`}
            </p>
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Add Rule
          </Button>
        </div>

        {/* Stats */}
        {rules.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(
              rules.reduce((acc, r) => {
                acc[r.severity] = (acc[r.severity] ?? 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([sev, count]) => (
              <div key={sev} className={`rounded-lg border px-3 py-2.5 ${SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG]?.class ?? 'bg-gray-100'}`}>
                <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">{sev}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        )}

        {/* Rules list */}
        {loading ? (
          <div className="py-8 text-center text-sm text-[#a0a0a0]">Loading rules…</div>
        ) : rules.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#e5e5e5] py-14 text-center">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-[#d0d0d0]" />
            <p className="text-sm font-medium text-[#6b6b6b]">No compliance rules yet</p>
            <p className="mt-1 text-xs text-[#a0a0a0]">Rules define what the AI evaluator checks after each call</p>
            <Button size="sm" variant="outline" onClick={openCreate} className="mt-4 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Create first rule
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0f0] rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
            {rules.map((rule) => {
              const catCfg = CATEGORY_CONFIG[rule.category];
              const sevCfg = SEVERITY_CONFIG[rule.severity];
              const CatIcon = catCfg.icon;
              return (
                <div key={rule.id} className={`flex items-start gap-4 px-4 py-3.5 transition-colors ${!rule.is_active ? 'opacity-50' : ''}`}>
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#f9f9f9]">
                    <CatIcon className="h-4 w-4 text-[#9b9b9b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#0a0a0a]">{rule.rule_name}</span>
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${catCfg.class}`}>
                        {catCfg.label}
                      </span>
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${sevCfg.class}`}>
                        {sevCfg.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#6b6b6b] line-clamp-2">{rule.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 ml-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => toggleActive(rule)}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                    <button
                      onClick={() => openEdit(rule)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] text-[#9b9b9b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      disabled={deleting === rule.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] text-[#9b9b9b] hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Evaluator note */}
        {rules.length > 0 && (
          <p className="text-xs text-[#a0a0a0] leading-relaxed">
            <strong className="text-[#6b6b6b]">How it works:</strong> After each call, the QA engine checks the transcript
            against all active rules and generates a risk score (0–100) with detailed violation reports.
            Critical violations score 50 pts each; high = 30, medium = 15, low = 5.
          </p>
        )}
      </div>
    </>
  );
}
