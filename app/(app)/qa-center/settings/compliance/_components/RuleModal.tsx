"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { emptyForm, type QACRule, type RuleFormState } from "./types";

export function RuleModal({
  open,
  editingRule,
  scope,
  departmentId,
  onClose,
  onSaved,
}: {
  open: boolean;
  editingRule: QACRule | null;
  scope: "global" | "department";
  departmentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RuleFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [newExample, setNewExample] = useState("");
  const [newCounter, setNewCounter] = useState("");

  useEffect(() => {
    if (editingRule) {
      setForm({
        name: editingRule.name,
        description: editingRule.description,
        category: editingRule.category,
        severity: editingRule.severity,
        regulation: editingRule.regulation ?? "",
        alert_severity: editingRule.alert_severity ?? "warning",
        examples: editingRule.examples ?? [],
        counter_examples: editingRule.counter_examples ?? [],
        is_active: editingRule.is_active,
      });
    } else {
      setForm(emptyForm());
    }
    setNewExample("");
    setNewCounter("");
  }, [editingRule, open]);

  async function save() {
    if (!form.name.trim() || !form.description.trim()) {
      toast.error("Nombre y descripción son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        scope,
        department_id: scope === "department" ? departmentId : null,
      };

      let res: Response;
      if (editingRule) {
        res = await fetch(`/api/qac/rules/${editingRule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/qac/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }

      toast.success(editingRule ? "Regla actualizada" : "Regla creada");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#efefef]">
          <h2 className="font-bold text-[#111]">
            {editingRule ? "Editar regla" : "Nueva regla"}
          </h2>
          <button
            onClick={onClose}
            className="text-[#9b9b9b] hover:text-[#111]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1.5">
              Nombre <span className="text-[#111]">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ej. Identificación obligatoria al inicio"
              className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1.5">
              Descripción <span className="text-[#111]">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              placeholder="Describe qué debe o no debe hacer el agente..."
              className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111] resize-none"
            />
          </div>

          {/* Severity + Alert Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#555] mb-1.5">
                Severidad de alerta
              </label>
              <select
                value={form.alert_severity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, alert_severity: e.target.value }))
                }
                className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
              >
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#555] mb-1.5">
                Categoría
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
              >
                <option value="compliance">Compliance</option>
                <option value="disclosure">Disclosure</option>
                <option value="prohibited">Prohibited</option>
                <option value="quality">Quality</option>
                <option value="coaching">Coaching</option>
              </select>
            </div>
          </div>

          {/* Regulation */}
          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1.5">
              Referencia regulatoria (opcional)
            </label>
            <input
              value={form.regulation}
              onChange={(e) =>
                setForm((f) => ({ ...f, regulation: e.target.value }))
              }
              placeholder="ej. FDCPA §807(11), TCPA, GDPR Art.13"
              className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
            />
          </div>

          {/* Examples */}
          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1.5">
              Ejemplos de violación
            </label>
            <div className="space-y-1.5">
              {form.examples.map((ex, i) => (
                <div key={i} className="flex gap-2">
                  <span className="flex-1 rounded-lg bg-[#fafafa] border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#111]">
                    {ex}
                  </span>
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        examples: f.examples.filter((_, j) => j !== i),
                      }))
                    }
                    className="text-[#d0d0d0] hover:text-[#111] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newExample.trim()) {
                      setForm((f) => ({
                        ...f,
                        examples: [...f.examples, newExample.trim()],
                      }));
                      setNewExample("");
                    }
                  }}
                  placeholder="Agregar ejemplo… (Enter)"
                  className="flex-1 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
                />
                <button
                  onClick={() => {
                    if (newExample.trim()) {
                      setForm((f) => ({
                        ...f,
                        examples: [...f.examples, newExample.trim()],
                      }));
                      setNewExample("");
                    }
                  }}
                  className="text-[#9b9b9b] hover:text-[#111] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Counter examples */}
          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1.5">
              Contraejemplos (NO es violación si…)
            </label>
            <div className="space-y-1.5">
              {form.counter_examples.map((ex, i) => (
                <div key={i} className="flex gap-2">
                  <span className="flex-1 rounded-lg bg-[#f8f8f8] border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#555]">
                    {ex}
                  </span>
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        counter_examples: f.counter_examples.filter(
                          (_, j) => j !== i,
                        ),
                      }))
                    }
                    className="text-[#d0d0d0] hover:text-[#111] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newCounter}
                  onChange={(e) => setNewCounter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCounter.trim()) {
                      setForm((f) => ({
                        ...f,
                        counter_examples: [
                          ...f.counter_examples,
                          newCounter.trim(),
                        ],
                      }));
                      setNewCounter("");
                    }
                  }}
                  placeholder="Agregar contraejemplo… (Enter)"
                  className="flex-1 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
                />
                <button
                  onClick={() => {
                    if (newCounter.trim()) {
                      setForm((f) => ({
                        ...f,
                        counter_examples: [
                          ...f.counter_examples,
                          newCounter.trim(),
                        ],
                      }));
                      setNewCounter("");
                    }
                  }}
                  className="text-[#9b9b9b] hover:text-[#111] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            />
            <span className="text-sm text-[#555]">Regla activa</span>
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-[#efefef]">
          <Button
            onClick={() => void save()}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {editingRule ? "Guardar cambios" : "Crear regla"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── TelegramHelpModal ────────────────────────────────────────────────────────
