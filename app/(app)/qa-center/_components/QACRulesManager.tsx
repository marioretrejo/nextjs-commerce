"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QACRule } from "./types";
import { SEV, CAT_COLOR } from "./scoring";

// ─── QA Rules Manager (own UI, not shared with compliance page) ───────────────

export function QACRulesManager() {
  const [rules, setRules] = useState<QACRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("quality");
  const [severity, setSeverity] = useState("medium");
  const [regulation, setRegulation] = useState("");

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/qac/rules");
    if (res.ok) setRules((await res.json()) as QACRule[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function createRule() {
    if (!name.trim() || !desc.trim()) {
      toast.error("Name and description are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/qac/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          category,
          severity,
          regulation: regulation.trim() || undefined,
        }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      toast.success("Rule created");
      setName("");
      setDesc("");
      setCategory("quality");
      setSeverity("medium");
      setRegulation("");
      setShowForm(false);
      fetchRules();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(id: string, is_active: boolean) {
    await fetch(`/api/qac/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active } : r)),
    );
  }

  async function deleteRule(id: string) {
    await fetch(`/api/qac/rules/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Rule deleted");
  }

  if (loading)
    return <div className="h-48 bg-[#f5f5f5] rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#111]">QA Rules</h3>
          <p className="text-xs text-[#6b6b6b] mt-0.5">
            Define what the AI auditor checks on every interaction. Each rule
            maps to a regulation and category.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm((s) => !s)}
          variant={showForm ? "outline" : "default"}
        >
          {showForm ? (
            <>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Rule
            </>
          )}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-[#e0e0e0]">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Rule Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. FDCPA Mini-Miranda Required"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Regulation Reference</Label>
                <Input
                  placeholder="e.g. FDCPA §807(11), TCPA, GDPR Art.13"
                  value={regulation}
                  onChange={(e) => setRegulation(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                rows={2}
                placeholder="Describe what the agent must do or must not do..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="disclosure">Disclosure</SelectItem>
                    <SelectItem value="prohibited">Prohibited</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="coaching">Coaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={createRule} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Plus className="h-3.5 w-3.5 mr-1" />
                )}
                Create Rule
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-8 w-8 text-[#e0e0e0] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#555]">No QA rules yet</p>
            <p className="text-xs text-[#9b9b9b] mt-1 mb-4">
              Add rules to define what the AI checks on every interaction —
              disclosures, prohibited phrases, quality criteria.
            </p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-[#f0f0f0]">
              {rules.map((rule) => {
                const rs = SEV[rule.severity] ?? SEV["medium"]!;
                return (
                  <div
                    key={rule.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${rule.is_active ? rs.dot : "bg-gray-200"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-medium ${rule.is_active ? "text-[#111]" : "text-[#9b9b9b]"}`}
                        >
                          {rule.name}
                        </span>
                        {rule.regulation && (
                          <span className="text-[10px] font-mono bg-[#f0f0f0] px-1.5 py-0.5 rounded">
                            {rule.regulation}
                          </span>
                        )}
                        <span
                          className={`text-[10px] capitalize font-medium px-1.5 py-0.5 rounded ${CAT_COLOR[rule.category] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {rule.category}
                        </span>
                      </div>
                      <p className="text-xs text-[#9b9b9b] mt-0.5 line-clamp-1">
                        {rule.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(v) => toggleRule(rule.id, v)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#c0c0c0] hover:text-red-500"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
