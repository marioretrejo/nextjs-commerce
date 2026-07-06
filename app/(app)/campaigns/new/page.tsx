"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookmarkPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  STEPS,
  DEFAULT_FORM,
  type Agent,
  type Contact,
  type CampaignForm,
} from "./_components/types";
import { StepInfo } from "./_components/StepInfo";
import { StepContacts } from "./_components/StepContacts";
import { StepAbTest } from "./_components/StepAbTest";
import { StepSchedule } from "./_components/StepSchedule";
import { StepReview } from "./_components/StepReview";

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template_id");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [fromTemplate, setFromTemplate] = useState<string | null>(null);

  const [form, setForm] = useState<CampaignForm>(DEFAULT_FORM);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    async function load() {
      const wsRes = await fetch("/api/admin/workspace-id");
      const wsData = (await wsRes.json()) as { workspace_id: string };
      setWorkspaceId(wsData.workspace_id ?? "");

      const agRes = await fetch(
        `/api/agents?workspace_id=${wsData.workspace_id}`,
      );
      const agData = (await agRes.json()) as Agent[];
      setAgents(agData ?? []);
      if (agData?.[0]) setForm((f) => ({ ...f, agent_id: agData[0]!.id }));

      if (templateId) {
        const tplRes = await fetch(`/api/campaign-templates?id=${templateId}`);
        if (tplRes.ok) {
          const tpl = (await tplRes.json()) as {
            name?: string;
            description?: string;
            agent_id?: string;
            config?: { max_concurrency?: number };
          };
          setFromTemplate(tpl.name ?? null);
          setForm((f) => ({
            ...f,
            name: tpl.name ? `${tpl.name} (copy)` : f.name,
            description: tpl.description ?? f.description,
            agent_id: tpl.agent_id ?? f.agent_id,
            max_concurrency: tpl.config?.max_concurrency ?? f.max_concurrency,
          }));
        }
      }
    }
    load();
  }, [templateId]);

  async function handleCSV(file: File) {
    const Papa = (await import("papaparse")).default;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const parsed: Contact[] = results.data
          .map((row) => ({
            name: row["name"] ?? row["Name"] ?? row["nombre"] ?? "",
            phone:
              row["phone"] ??
              row["Phone"] ??
              row["telefono"] ??
              row["tel"] ??
              "",
            email: row["email"] ?? row["Email"] ?? "",
          }))
          .filter((c) => c.phone);
        setContacts(parsed);
        toast.success(`${parsed.length} contacts loaded`);
      },
    });
  }

  async function handleSave() {
    if (!form.name) {
      toast.error("Campaign name required");
      return;
    }
    if (contacts.length === 0) {
      toast.error("Upload at least one contact");
      return;
    }
    setSaving(true);

    try {
      // Create campaign
      const payload = {
        ...form,
        workspace_id: workspaceId,
        ab_agent_id:
          form.ab_enabled && form.ab_agent_id ? form.ab_agent_id : null,
        max_retries: form.retry_enabled ? form.max_retries : 0,
        // datetime-local inputs return '' when empty; API requires null not ''
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      };
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const campaign = (await res.json()) as { id: string };

      // Upload contacts in batches
      const BATCH = 100;
      for (let i = 0; i < contacts.length; i += BATCH) {
        const batch = contacts.slice(i, i + BATCH).map((c) => ({
          campaign_id: campaign.id,
          name: c.name ?? null,
          phone: c.phone,
          email: c.email ?? null,
          variables: c,
          status: "pending",
        }));
        await fetch("/api/campaigns/" + campaign.id + "/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: batch }),
        });
      }

      toast.success("Campaign created!");
      router.push(`/campaigns/${campaign.id}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Campaign</h1>
          <p className="text-sm text-[#6b6b6b]">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </div>
      </div>

      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#0a0a0a]" : "bg-[#e0e0e0]"}`}
          />
        ))}
      </div>

      {fromTemplate && (
        <div className="flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-[#f5f5f5] px-4 py-2.5 text-sm text-[#6b6b6b]">
          <BookmarkPlus className="w-4 h-4 shrink-0" />
          Started from template:{" "}
          <span className="font-medium text-[#0a0a0a]">{fromTemplate}</span>
        </div>
      )}

      {step === 0 && <StepInfo form={form} setForm={setForm} agents={agents} />}
      {step === 1 && (
        <StepContacts
          contacts={contacts}
          onCSV={handleCSV}
          onClear={() => setContacts([])}
        />
      )}
      {step === 2 && (
        <StepAbTest form={form} setForm={setForm} agents={agents} />
      )}
      {step === 3 && <StepSchedule form={form} setForm={setForm} />}
      {step === 4 && (
        <StepReview form={form} agents={agents} contacts={contacts} />
      )}

      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={() =>
            step > 0 ? setStep(step - 1) : router.push("/campaigns")
          }
          disabled={saving}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 0 && !form.name) ||
              (step === 1 && contacts.length === 0) ||
              (step === 2 && form.ab_enabled && !form.ab_agent_id)
            }
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Create Campaign"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
