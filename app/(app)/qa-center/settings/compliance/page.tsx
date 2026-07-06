"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { QACRule, Department } from "./_components/types";
import { RuleCard } from "./_components/RuleCard";
import { RuleModal } from "./_components/RuleModal";
import { TelegramSection } from "./_components/TelegramSection";

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<"global" | "department">("global");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [rules, setRules] = useState<QACRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<QACRule | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/qac/departments");
      if (res.ok) {
        const data = (await res.json()) as Department[];
        setDepartments(data.filter((d) => d.is_active));
        if (data.length > 0 && !selectedDeptId) {
          setSelectedDeptId(data[0]!.id);
        }
      }
    } catch {
      /* non-critical */
    }
  }, [selectedDeptId]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope: activeTab });
      if (activeTab === "department" && selectedDeptId) {
        params.set("department_id", selectedDeptId);
      }
      const res = await fetch(`/api/qac/rules?${params.toString()}`);
      if (res.ok) setRules((await res.json()) as QACRule[]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDeptId]);

  useEffect(() => {
    void fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  async function handleToggle(id: string, active: boolean) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active: active } : r)),
    );
    const res = await fetch(`/api/qac/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active }),
    });
    if (!res.ok) {
      toast.error("Error al actualizar regla");
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: !active } : r)),
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta regla?")) return;
    const res = await fetch(`/api/qac/rules/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Regla eliminada");
    } else {
      toast.error("Error al eliminar");
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= rules.length) return;

    const updated = [...rules];
    const a = updated[idx]!;
    const b = updated[targetIdx]!;
    [updated[idx], updated[targetIdx]] = [
      { ...b, sort_order: a.sort_order },
      { ...a, sort_order: b.sort_order },
    ];
    setRules(updated);

    await fetch("/api/qac/rules/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { id: a.id, sort_order: b.sort_order },
          { id: b.id, sort_order: a.sort_order },
        ],
      }),
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/qa-center/settings/departments"
          className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-[#111] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 shrink-0">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#111]">
            Reglas de Compliance
          </h1>
          <p className="text-xs text-[#555]">
            Definen qué verifica el AI auditor en cada llamada
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#e0e0e0]">
        {(["global", "department"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-[#111] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#111] after:rounded-t"
                : "text-[#9b9b9b] hover:text-[#555]"
            }`}
          >
            {tab === "global"
              ? "Global (todas las llamadas)"
              : "Por Departamento"}
          </button>
        ))}
      </div>

      {/* Department selector */}
      {activeTab === "department" && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#555] shrink-0">
            Departamento:
          </label>
          <select
            value={selectedDeptId ?? ""}
            onChange={(e) => setSelectedDeptId(e.target.value || null)}
            className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
          >
            {departments.length === 0 ? (
              <option value="">Sin departamentos configurados</option>
            ) : (
              departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))
            )}
          </select>
          {departments.length === 0 && (
            <Link
              href="/qa-center/settings/departments"
              className="text-xs text-[#555] hover:text-[#111] underline"
            >
              Crear departamento →
            </Link>
          )}
        </div>
      )}

      {/* Rules list */}
      <Card className="border-[#e0e0e0]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {activeTab === "global"
                ? "Reglas globales"
                : `Reglas del departamento`}
              {rules.length > 0 && (
                <span className="ml-2 text-xs font-normal text-[#9b9b9b]">
                  ({rules.length})
                </span>
              )}
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditingRule(null);
                setModalOpen(true);
              }}
              disabled={
                activeTab === "department" &&
                (departments.length === 0 || !selectedDeptId)
              }
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva regla
            </Button>
          </div>
          <p className="text-xs text-[#555]">
            {activeTab === "global"
              ? "Estas reglas se aplican a todas las llamadas, independientemente del departamento."
              : "Estas reglas solo se aplican a llamadas del departamento seleccionado."}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-gray-50 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="h-8 w-8 text-[#e0e0e0] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#555]">
                Sin reglas configuradas
              </p>
              <p className="text-xs text-[#9b9b9b] mt-1 mb-4 max-w-xs mx-auto">
                Agregá reglas para que el AI auditor verifique cumplimiento
                específico en cada llamada.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setEditingRule(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Agregar primera regla
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, idx) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isFirst={idx === 0}
                  isLast={idx === rules.length - 1}
                  onToggle={(id, active) => void handleToggle(id, active)}
                  onEdit={(r) => {
                    setEditingRule(r);
                    setModalOpen(true);
                  }}
                  onDelete={(id) => void handleDelete(id)}
                  onMoveUp={(id) => void handleMove(id, "up")}
                  onMoveDown={(id) => void handleMove(id, "down")}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram Section */}
      <TelegramSection />

      {/* Rule Modal */}
      <RuleModal
        open={modalOpen}
        editingRule={editingRule}
        scope={activeTab}
        departmentId={activeTab === "department" ? selectedDeptId : null}
        onClose={() => {
          setModalOpen(false);
          setEditingRule(null);
        }}
        onSaved={() => void fetchRules()}
      />
    </div>
  );
}
