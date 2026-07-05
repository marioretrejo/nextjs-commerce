"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type Screen,
  type AgentTemplate,
  type Voice,
  type VoiceFilterId,
  AGENT_TEMPLATES,
  defaultForm,
} from "./_components/constants";
import { WorkflowScreen } from "./_components/WorkflowScreen";
import { ModeScreen } from "./_components/ModeScreen";
import { TemplatesScreen } from "./_components/TemplatesScreen";
import { StepBasics } from "./_components/StepBasics";
import { StepVoice } from "./_components/StepVoice";
import { StepBehavior } from "./_components/StepBehavior";
import { StepSchedule } from "./_components/StepSchedule";
import { StepAdvanced } from "./_components/StepAdvanced";
import { StepReview } from "./_components/StepReview";
import { WizardHeader } from "./_components/WizardHeader";
import { WizardFooter } from "./_components/WizardFooter";

export default function NewAgentPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("templates");
  const [fromTemplate, setFromTemplate] = useState<AgentTemplate | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState("");

  // Wizard state
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voiceFilters, setVoiceFilters] = useState<VoiceFilterId[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [dynVars, setDynVars] = useState<{ key: string; value: string }[]>([]);

  // Workflow creation state
  const [workflowName, setWorkflowName] = useState("");
  const [workflowLanguage, setWorkflowLanguage] = useState("en-US");
  const [workflowSaving, setWorkflowSaving] = useState(false);

  const AUTOSAVE_KEY = "voiceos:agent-draft";

  const [form, setForm] = useState(() => {
    // Restore autosaved draft if available
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved)
          return {
            ...defaultForm,
            ...(JSON.parse(saved) as Partial<typeof defaultForm>),
          };
      } catch {
        /* ignore */
      }
    }
    return defaultForm;
  });

  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saved">(
    "idle",
  );

  useEffect(() => {
    if (screen !== "simple") return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(form));
        setAutosaveStatus("saved");
        setTimeout(() => setAutosaveStatus("idle"), 2000);
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [form, screen]);

  useEffect(() => {
    async function load() {
      const [wsRes, vRes] = await Promise.all([
        fetch("/api/admin/workspace-id"),
        fetch("/api/voices"),
      ]);
      if (wsRes.ok) {
        const d = (await wsRes.json()) as { workspace_id: string };
        setWorkspaceId(d.workspace_id ?? "");
      }
      if (vRes.ok) {
        const vData = (await vRes.json()) as { voices: Voice[] };
        setVoices(vData.voices ?? []);
        if (vData.voices?.[0]) {
          setForm((f) => ({
            ...f,
            voice_id: vData.voices[0]!.voice_id,
            voice_name: vData.voices[0]!.name,
          }));
        }
      }
    }
    load();
  }, []);

  function setField<K extends keyof typeof form>(
    key: K,
    val: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function updateDynVars(entries: { key: string; value: string }[]) {
    setDynVars(entries);
    const record: Record<string, string> = {};
    entries
      .filter((e) => e.key)
      .forEach((e) => {
        record[e.key] = e.value;
      });
    setField("dynamic_variables", record);
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      schedule_days: f.schedule_days.includes(day)
        ? f.schedule_days.filter((d) => d !== day)
        : [...f.schedule_days, day],
    }));
  }

  async function playPreview(voice: Voice) {
    setPlayingVoice(voice.voice_id);
    try {
      let audioUrl: string;
      if (voice.preview_url) {
        audioUrl = `/api/voices/preview?url=${encodeURIComponent(voice.preview_url)}`;
      } else {
        const res = await fetch("/api/voices/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voice_id: voice.voice_id,
            emotion: (form as Record<string, unknown>)["voice_emotion"] ?? null,
            language: form.language,
          }),
        });
        if (!res.ok) {
          // Bubble up the real server error so users see exactly what's wrong
          let errMsg = `Preview failed (${res.status})`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) errMsg = body.error;
          } catch {
            errMsg = (await res.text().catch(() => errMsg)) || errMsg;
          }
          throw new Error(errMsg);
        }
        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
      }
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setPlayingVoice(null);
        if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setPlayingVoice(null);
        if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
    } catch (e) {
      setPlayingVoice(null);
      toast.error(e instanceof Error ? e.message : "Voice preview unavailable");
    }
  }

  function applyTemplate(tpl: AgentTemplate) {
    setFromTemplate(tpl);
    setForm((f) => ({
      ...f,
      name: tpl.name,
      language: tpl.language,
      objective: tpl.objective,
      personality: tpl.personality,
      system_prompt: tpl.system_prompt,
      first_message: tpl.first_message,
      voicemail_message: tpl.voicemail_message,
    }));
    setWorkflowName(tpl.name);
    setWorkflowLanguage(tpl.language);
    setShowGallery(false);
    setScreen("mode");
  }

  async function handleSave() {
    if (!form.name) {
      toast.error("Agent name is required");
      return;
    }
    if (!workspaceId) {
      toast.error("Workspace not loaded yet — please wait a moment.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, workspace_id: workspaceId }),
      });
      if (!res.ok) {
        const e = (await res.json()) as { error: string };
        throw new Error(e.error);
      }
      const agent = (await res.json()) as { id: string };
      if (!agent.id) {
        router.push("/agents");
        return;
      }
      localStorage.removeItem(AUTOSAVE_KEY);
      toast.success("Agent created!");
      router.refresh();
      router.push(`/agents/${agent.id}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleWorkflowCreate() {
    if (!workflowName.trim()) {
      toast.error("Agent name is required");
      return;
    }
    if (!workspaceId) {
      toast.error("Workspace not loaded yet — please wait a moment.");
      return;
    }
    setWorkflowSaving(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          language: workflowLanguage,
          workspace_id: workspaceId,
          voice_engine: "standard",
          objective: fromTemplate?.objective ?? "",
          system_prompt: fromTemplate?.system_prompt ?? "",
          first_message: fromTemplate?.first_message ?? "",
          schedule_days: ["mon", "tue", "wed", "thu", "fri"],
          schedule_start_time: "09:00",
          schedule_end_time: "18:00",
          timezone: "America/New_York",
          max_attempts: 3,
          retry_interval_minutes: 60,
        }),
      });
      if (!res.ok) {
        const e = (await res.json()) as { error: string };
        throw new Error(e.error);
      }
      const agent = (await res.json()) as { id: string };
      if (!agent.id) {
        router.push("/agents");
        return;
      }
      toast.success("Workflow agent created!");
      router.refresh();
      router.push(`/agents/${agent.id}/flow`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setWorkflowSaving(false);
    }
  }

  const tokenCount = Math.ceil(form.system_prompt.length / 4);
  const filteredTemplates = AGENT_TEMPLATES.filter(
    (t) =>
      gallerySearch === "" ||
      t.name.toLowerCase().includes(gallerySearch.toLowerCase()) ||
      t.category.toLowerCase().includes(gallerySearch.toLowerCase()) ||
      t.tags.some((tag) =>
        tag.toLowerCase().includes(gallerySearch.toLowerCase()),
      ),
  );

  if (screen === "templates") {
    return (
      <TemplatesScreen
        showGallery={showGallery}
        setShowGallery={setShowGallery}
        gallerySearch={gallerySearch}
        setGallerySearch={setGallerySearch}
        filteredTemplates={filteredTemplates}
        applyTemplate={applyTemplate}
        onBackToAgents={() => router.push("/agents")}
        onStartFromScratch={() => setScreen("mode")}
      />
    );
  }

  if (screen === "mode") {
    return (
      <ModeScreen
        fromTemplate={fromTemplate}
        onBack={() => setScreen("templates")}
        onSimple={() => setScreen("simple")}
        onWorkflow={() => setScreen("workflow")}
        onClearTemplate={() => {
          setFromTemplate(null);
          setForm((f) => ({ ...f, ...defaultForm }));
        }}
      />
    );
  }

  if (screen === "workflow") {
    return (
      <WorkflowScreen
        workflowName={workflowName}
        setWorkflowName={setWorkflowName}
        workflowLanguage={workflowLanguage}
        setWorkflowLanguage={setWorkflowLanguage}
        workflowSaving={workflowSaving}
        onBack={() => setScreen("mode")}
        onCreate={handleWorkflowCreate}
      />
    );
  }

  // ─── SIMPLE MODE WIZARD ───────────────────────────────────────────────────
  return (
    <div className="p-6 mx-auto max-w-3xl space-y-6">
      <WizardHeader
        step={step}
        fromTemplate={fromTemplate}
        autosaveStatus={autosaveStatus}
        onBack={() => {
          setScreen("mode");
          setStep(0);
        }}
        onClearDraft={() => {
          localStorage.removeItem(AUTOSAVE_KEY);
          setForm(defaultForm);
          toast.success("Draft cleared");
        }}
      />

      {step === 0 && <StepBasics form={form} setField={setField} />}
      {step === 1 && (
        <StepVoice
          form={form}
          setField={setField}
          setForm={setForm}
          voices={voices}
          voiceSearch={voiceSearch}
          setVoiceSearch={setVoiceSearch}
          voiceFilters={voiceFilters}
          setVoiceFilters={setVoiceFilters}
          playingVoice={playingVoice}
          playPreview={playPreview}
        />
      )}

      {step === 2 && <StepBehavior form={form} setField={setField} />}
      {step === 3 && (
        <StepSchedule form={form} setField={setField} toggleDay={toggleDay} />
      )}
      {step === 4 && (
        <StepAdvanced
          form={form}
          setField={setField}
          dynVars={dynVars}
          updateDynVars={updateDynVars}
        />
      )}
      {step === 5 && <StepReview form={form} />}

      <WizardFooter
        step={step}
        saving={saving}
        nextDisabled={step === 0 && !form.name}
        onBack={() => (step > 0 ? setStep(step - 1) : setScreen("mode"))}
        onNext={() => setStep(step + 1)}
        onSave={handleSave}
      />
    </div>
  );
}
