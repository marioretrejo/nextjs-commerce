"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, Zap, ChevronUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { AutomationRule } from "@/lib/supabase/types";
import { TRIGGER_LABELS, ACTION_LABELS, ACTION_COLORS } from "./constants";

export function AutomationTab({ agentId }: { agentId: string }) {
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [showNewRule, setShowNewRule] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    trigger_outcome: "converted",
    action_type: "webhook",
    webhook_url: "",
    tag_name: "",
    sms_message: "",
    notify_email: "",
    campaign_id: "",
  });

  const loadAutomation = useCallback(async () => {
    if (automationLoaded) return;
    const res = await fetch(`/api/agents/${agentId}/automation`);
    if (res.ok) {
      const data = (await res.json()) as AutomationRule[];
      setAutomationRules(data);
      setAutomationLoaded(true);
    }
  }, [agentId, automationLoaded]);

  useEffect(() => {
    void loadAutomation();
  }, [loadAutomation]);

  async function toggleRule(ruleId: string, enabled: boolean) {
    await fetch(`/api/agents/${agentId}/automation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule_id: ruleId, enabled }),
    });
    setAutomationRules((r) =>
      r.map((rule) => (rule.id === ruleId ? { ...rule, enabled } : rule)),
    );
  }

  async function deleteRule(ruleId: string) {
    await fetch(`/api/agents/${agentId}/automation?rule_id=${ruleId}`, {
      method: "DELETE",
    });
    setAutomationRules((r) => r.filter((rule) => rule.id !== ruleId));
    toast.success("Rule deleted");
  }

  async function createRule() {
    if (!newRule.name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    setSavingRule(true);
    try {
      const actionConfig: Record<string, string> = {};
      if (newRule.action_type === "webhook")
        actionConfig["url"] = newRule.webhook_url;
      else if (newRule.action_type === "tag_contact")
        actionConfig["tag"] = newRule.tag_name;
      else if (newRule.action_type === "send_sms")
        actionConfig["message"] = newRule.sms_message;
      else if (newRule.action_type === "notify_team")
        actionConfig["email"] = newRule.notify_email;
      else if (newRule.action_type === "add_to_campaign")
        actionConfig["campaign_id"] = newRule.campaign_id;

      const res = await fetch(`/api/agents/${agentId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRule.name,
          trigger_outcome: newRule.trigger_outcome,
          action_type: newRule.action_type,
          action_config: actionConfig,
        }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const rule = (await res.json()) as AutomationRule;
      setAutomationRules((r) => [...r, rule]);
      setShowNewRule(false);
      setNewRule({
        name: "",
        trigger_outcome: "converted",
        action_type: "webhook",
        webhook_url: "",
        tag_name: "",
        sms_message: "",
        notify_email: "",
        campaign_id: "",
      });
      toast.success("Automation rule created");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingRule(false);
    }
  }

  return (
    <TabsContent value="automation" className="space-y-4 pt-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Automation Rules</CardTitle>
            <CardDescription className="mt-1">
              Trigger actions automatically based on call outcomes.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowNewRule((v) => !v)}>
            {showNewRule ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" /> Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" /> New Rule
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNewRule && (
            <div className="rounded-lg border border-[#e0e0e0] bg-[#f5f5f5] p-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Rule Name</Label>
                <Input
                  placeholder="e.g. Notify on conversion"
                  value={newRule.name}
                  onChange={(e) =>
                    setNewRule((r) => ({ ...r, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Trigger (when)</Label>
                  <Select
                    value={newRule.trigger_outcome}
                    onValueChange={(v) =>
                      setNewRule((r) => ({ ...r, trigger_outcome: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Action (then)</Label>
                  <Select
                    value={newRule.action_type}
                    onValueChange={(v) =>
                      setNewRule((r) => ({ ...r, action_type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {newRule.action_type === "webhook" && (
                <div className="space-y-1.5">
                  <Label>Webhook URL</Label>
                  <Input
                    placeholder="https://your-server.com/webhook"
                    value={newRule.webhook_url}
                    onChange={(e) =>
                      setNewRule((r) => ({
                        ...r,
                        webhook_url: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              {newRule.action_type === "tag_contact" && (
                <div className="space-y-1.5">
                  <Label>Tag Name</Label>
                  <Input
                    placeholder="e.g. hot-lead"
                    value={newRule.tag_name}
                    onChange={(e) =>
                      setNewRule((r) => ({
                        ...r,
                        tag_name: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              {newRule.action_type === "send_sms" && (
                <div className="space-y-1.5">
                  <Label>SMS Message</Label>
                  <Textarea
                    rows={2}
                    placeholder="Thanks for your interest! We'll be in touch."
                    value={newRule.sms_message}
                    onChange={(e) =>
                      setNewRule((r) => ({
                        ...r,
                        sms_message: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              {newRule.action_type === "notify_team" && (
                <div className="space-y-1.5">
                  <Label>Notify Email</Label>
                  <Input
                    type="email"
                    placeholder="team@yourcompany.com"
                    value={newRule.notify_email}
                    onChange={(e) =>
                      setNewRule((r) => ({
                        ...r,
                        notify_email: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              {newRule.action_type === "add_to_campaign" && (
                <div className="space-y-1.5">
                  <Label>Campaign ID</Label>
                  <Input
                    placeholder="Campaign UUID"
                    value={newRule.campaign_id}
                    onChange={(e) =>
                      setNewRule((r) => ({
                        ...r,
                        campaign_id: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              <Button onClick={createRule} disabled={savingRule} size="sm">
                {savingRule ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-1" /> Create Rule
                  </>
                )}
              </Button>
            </div>
          )}

          {!automationLoaded && !showNewRule && (
            <p className="text-sm text-[#6b6b6b]">
              Click the tab to load rules.
            </p>
          )}

          {automationLoaded && automationRules.length === 0 && !showNewRule && (
            <div className="text-center py-8">
              <Zap className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#0a0a0a]">
                No automation rules yet
              </p>
              <p className="text-xs text-[#6b6b6b] mt-1">
                Create a rule to trigger actions when a call ends with a
                specific outcome.
              </p>
            </div>
          )}

          {automationRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 rounded-lg border border-[#e0e0e0] p-3"
            >
              <Switch
                checked={rule.enabled}
                onCheckedChange={(v) => toggleRule(rule.id, v)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#0a0a0a] truncate">
                    {rule.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[#e0e0e0] text-[#6b6b6b] shrink-0"
                  >
                    {TRIGGER_LABELS[rule.trigger_outcome] ??
                      rule.trigger_outcome}
                  </Badge>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${ACTION_COLORS[rule.action_type] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {ACTION_LABELS[rule.action_type] ?? rule.action_type}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => deleteRule(rule.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-[#6b6b6b]" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
