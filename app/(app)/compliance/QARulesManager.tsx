"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  type ComplianceRule,
  type RuleForm,
  EMPTY_FORM,
} from "./_qa-rules/config";
import { RuleModal } from "./_qa-rules/RuleModal";
import { RulesList } from "./_qa-rules/RulesList";

export function QARulesManager() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComplianceRule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/rules");
      if (res.ok) setRules((await res.json()) as ComplianceRule[]);
    } catch {
      /* silently ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(rule: ComplianceRule) {
    setEditing(rule);
    setForm({
      rule_name: rule.rule_name,
      description: rule.description,
      category: rule.category,
      severity: rule.severity,
    });
    setModalOpen(true);
  }

  async function saveRule() {
    if (!form.rule_name.trim() || !form.description.trim()) {
      toast.error("Rule name and description are required");
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/compliance/rules/${editing.id}`
        : "/api/compliance/rules";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const saved = (await res.json()) as ComplianceRule;
      if (editing) {
        setRules((r) => r.map((x) => (x.id === saved.id ? saved : x)));
        toast.success("Rule updated");
      } else {
        setRules((r) => [saved, ...r]);
        toast.success("Rule created");
      }
      setModalOpen(false);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: ComplianceRule) {
    try {
      const res = await fetch(`/api/compliance/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setRules((r) =>
        r.map((x) =>
          x.id === rule.id ? { ...x, is_active: !x.is_active } : x,
        ),
      );
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function deleteRule(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/compliance/rules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setRules((r) => r.filter((x) => x.id !== id));
      toast.success("Rule deleted");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeleting(null);
    }
  }

  const active = rules.filter((r) => r.is_active).length;
  const inactive = rules.length - active;

  return (
    <>
      <RuleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={saveRule}
      />

      <RulesList
        rules={rules}
        loading={loading}
        active={active}
        inactive={inactive}
        deleting={deleting}
        onToggle={toggleActive}
        onEdit={openEdit}
        onDelete={deleteRule}
        onCreate={openCreate}
      />
    </>
  );
}
