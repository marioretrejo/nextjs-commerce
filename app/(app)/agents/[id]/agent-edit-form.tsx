"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trash2, Star } from "lucide-react";
import { AgentScorecard } from "@/components/agents/agent-scorecard";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Agent } from "@/lib/supabase/types";
import type { PhoneNumber } from "./_edit-form/constants";
import { BasicsTab } from "./_edit-form/BasicsTab";
import { BehaviorTab } from "./_edit-form/BehaviorTab";
import { ScheduleTab } from "./_edit-form/ScheduleTab";
import { AdvancedTab } from "./_edit-form/AdvancedTab";
import { AutomationTab } from "./_edit-form/AutomationTab";

export function AgentEditForm({
  agent,
  phoneNumbers,
}: {
  agent: Agent;
  phoneNumbers: PhoneNumber[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<Partial<Agent>>(agent);

  // Keep form in sync when parent re-fetches after save (router.refresh())
  const agentId = agent.id;
  useEffect(() => {
    setForm(agent);
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [dynVars, setDynVars] = useState<{ key: string; value: string }[]>(
    Object.entries(agent.dynamic_variables ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
  );

  function updateDynVars(entries: { key: string; value: string }[]) {
    setDynVars(entries);
    const record: Record<string, string> = {};
    entries
      .filter((e) => e.key)
      .forEach((e) => {
        record[e.key] = e.value;
      });
    setForm((f) => ({ ...f, dynamic_variables: record }));
  }

  function setField<K extends keyof Agent>(key: K, val: Agent[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const updated = (await res.json()) as Partial<Agent>;
      setForm(updated); // sync form with what the server actually saved
      toast.success("Agent saved");
      router.refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent() {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Agent deleted");
      router.push("/agents");
    } else {
      toast.error("Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="basics">
        <TabsList>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="scorecard">
            <Star className="h-3.5 w-3.5 mr-1" />
            Scorecard
          </TabsTrigger>
        </TabsList>

        <BasicsTab form={form} setField={setField} agent={agent} />
        <BehaviorTab form={form} setField={setField} />
        <ScheduleTab form={form} setField={setField} />
        <AdvancedTab
          form={form}
          setField={setField}
          agent={agent}
          phoneNumbers={phoneNumbers}
          dynVars={dynVars}
          updateDynVars={updateDynVars}
        />
        <AutomationTab agentId={agent.id} />

        <TabsContent value="scorecard" className="pt-4">
          <AgentScorecard agentId={agent.id} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          className="text-[#6b6b6b]"
          onClick={deleteAgent}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Delete Agent
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}
