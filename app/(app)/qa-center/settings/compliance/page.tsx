"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Send,
  Shield,
  ShieldAlert,
  Trash2,
  Unlink,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QACRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string | null;
  scope: string;
  department_id: string | null;
  alert_severity: string;
  examples: string[];
  counter_examples: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface RuleFormState {
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string;
  alert_severity: string;
  examples: string[];
  counter_examples: string[];
  is_active: boolean;
}

const emptyForm = (): RuleFormState => ({
  name: "",
  description: "",
  category: "compliance",
  severity: "medium",
  regulation: "",
  alert_severity: "warning",
  examples: [],
  counter_examples: [],
  is_active: true,
});

// ─── RuleCard ─────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  rule: QACRule;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (rule: QACRule) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const alertSevColor =
    rule.alert_severity === "critical"
      ? "bg-[#111] text-white border-transparent"
      : "bg-[#f0f0f0] text-[#555] border-[#e0e0e0]";

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${rule.is_active ? "border-[#e0e0e0] bg-white" : "border-[#efefef] bg-[#fafafa] opacity-60"}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle / reorder arrows */}
        <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
          <button
            onClick={() => onMoveUp(rule.id)}
            disabled={isFirst}
            className="text-[#d0d0d0] hover:text-[#555] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMoveDown(rule.id)}
            disabled={isLast}
            className="text-[#d0d0d0] hover:text-[#555] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${alertSevColor}`}
            >
              {rule.alert_severity === "critical" ? (
                <AlertTriangle className="h-2.5 w-2.5" />
              ) : (
                <ShieldAlert className="h-2.5 w-2.5" />
              )}
              {rule.alert_severity === "critical" ? "Critical" : "Warning"}
            </span>
            <span className="font-semibold text-sm text-[#111]">
              {rule.name}
            </span>
            {rule.regulation && (
              <span className="text-[10px] font-mono bg-[#f0f0f0] px-1.5 py-0.5 rounded text-[#6b6b6b]">
                {rule.regulation}
              </span>
            )}
          </div>
          <p className="text-xs text-[#555] mt-1 line-clamp-2">
            {rule.description}
          </p>

          {/* Examples + counter */}
          {expanded && (
            <div className="mt-3 space-y-2">
              {rule.examples.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Ejemplos de violación
                  </p>
                  <ul className="space-y-0.5">
                    {rule.examples.map((ex, i) => (
                      <li
                        key={i}
                        className="text-xs text-[#111] bg-[#fafafa] rounded px-2 py-1 border border-[#e0e0e0]"
                      >
                        ✗ {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rule.counter_examples.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    NO es violación si…
                  </p>
                  <ul className="space-y-0.5">
                    {rule.counter_examples.map((ex, i) => (
                      <li
                        key={i}
                        className="text-xs text-[#555] bg-[#f8f8f8] rounded px-2 py-1 border border-[#e0e0e0]"
                      >
                        ✓ {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {(rule.examples.length > 0 || rule.counter_examples.length > 0) && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[#9b9b9b] hover:text-[#555] transition-colors"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
              {expanded ? "Ocultar" : `Ver ejemplos (${rule.examples.length + rule.counter_examples.length})`}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={rule.is_active}
            onCheckedChange={(v) => onToggle(rule.id, v)}
          />
          <button
            onClick={() => onEdit(rule)}
            className="text-xs text-[#6b6b6b] hover:text-[#111] border border-[#e0e0e0] rounded-lg px-2 py-1 hover:border-[#111] transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="text-[#d0d0d0] hover:text-[#111] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RuleModal ────────────────────────────────────────────────────────────────

function RuleModal({
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
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#efefef]">
          <h2 className="font-bold text-[#111]">
            {editingRule ? "Editar regla" : "Nueva regla"}
          </h2>
          <button onClick={onClose} className="text-[#9b9b9b] hover:text-[#111]">
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
          <Button onClick={() => void save()} disabled={saving} className="gap-1.5">
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

function TelegramHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[#efefef]">
          <h2 className="font-bold text-[#111] flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#6b6b6b]" />
            Cómo configurar Telegram
          </h2>
          <button onClick={onClose} className="text-[#9b9b9b] hover:text-[#111]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <ol className="space-y-3">
            {[
              {
                n: 1,
                text: "Abrí Telegram y buscá @BotFather",
              },
              {
                n: 2,
                text: 'Mandá el comando /newbot y seguí los pasos para crear el bot',
              },
              {
                n: 3,
                text: "Copiá el token que te da BotFather (formato: 123456789:AAF...)",
              },
              {
                n: 4,
                text: "Agregá el bot al grupo o canal donde querés recibir alertas y dale permisos de envío",
              },
              {
                n: 5,
                text: "Para obtener el Chat ID: buscá @userinfobot, mandá /start en tu grupo con el bot, o usá la API de Telegram",
              },
              {
                n: 6,
                text: "Si es un grupo/canal, el Chat ID empieza con -100 (ej. -1001234567890)",
              },
            ].map(({ n, text }) => (
              <li key={n} className="flex gap-3">
                <span className="h-5 w-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {n}
                </span>
                <p className="text-sm text-gray-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="p-5 border-t border-[#efefef]">
          <Button variant="outline" onClick={onClose} className="w-full">
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── TelegramSection ──────────────────────────────────────────────────────────

function TelegramSection() {
  const [config, setConfig] = useState<{
    connected: boolean;
    bot_token_hint?: string;
    chat_id?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/qac/settings/telegram");
      if (res.ok) setConfig(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  function friendlyTelegramError(msg: string): string {
    if (msg.includes("Unauthorized") || msg.includes("Not Authorized"))
      return "Bot Token inválido. Verificá que lo copiaste completo desde BotFather.";
    if (msg.includes("chat not found") || msg.includes("CHAT_NOT_FOUND"))
      return "Chat ID incorrecto o el bot no fue agregado al grupo/canal.";
    if (msg.includes("bot was blocked") || msg.includes("bot_blocked"))
      return "El bot fue bloqueado. Desbloquealo en Telegram primero.";
    return msg;
  }

  async function connectAndTest() {
    if (!botToken.trim() || !chatId.trim()) {
      toast.error("Bot Token y Chat ID son obligatorios");
      return;
    }
    setSaving(true);
    try {
      // First test the credentials
      const testRes = await fetch("/api/qac/settings/telegram-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken, chat_id: chatId }),
      });
      const testData = (await testRes.json()) as { ok: boolean; error?: string };
      if (!testRes.ok || !testData.ok) {
        toast.error(friendlyTelegramError(testData.error ?? "Error desconocido"));
        return;
      }

      // If test passed, save the config
      const saveRes = await fetch("/api/qac/settings/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken, chat_id: chatId }),
      });
      if (!saveRes.ok) {
        const e = (await saveRes.json()) as { error: string };
        throw new Error(e.error);
      }

      toast.success("Telegram conectado — mensaje de prueba enviado");
      setBotToken("");
      setChatId("");
      await fetchConfig();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      // Re-fetch current saved credentials and test
      const cfgRes = await fetch("/api/qac/settings/telegram");
      const cfg = (await cfgRes.json()) as {
        connected: boolean;
        chat_id?: string;
      };
      if (!cfg.connected) {
        toast.error("No hay configuración Telegram activa");
        return;
      }
      // We can't get the full token from the GET endpoint (only hint)
      // Instead hit the test endpoint with a re-fetch signal
      toast.info("Enviando mensaje de prueba…");
      // Use a dedicated test-with-saved endpoint approach by hitting telegram
      // with the stored credentials (server reads from DB)
      const res = await fetch("/api/qac/settings/telegram-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_saved: true, workspace_id: "" }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(friendlyTelegramError(data.error ?? "Error en prueba"));
      } else {
        toast.success("Mensaje de prueba enviado");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/qac/settings/telegram", { method: "DELETE" });
      toast.success("Telegram desconectado");
      setConfig({ connected: false });
    } catch {
      toast.error("Error al desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />
    );
  }

  return (
    <>
      {showHelp && <TelegramHelpModal onClose={() => setShowHelp(false)} />}
      <Card className="border-[#e0e0e0]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-[#6b6b6b]" />
            Notificaciones Telegram
          </CardTitle>
          <p className="text-xs text-[#555] mt-0.5">
            Recibí alertas en Telegram cada vez que se detecte una violación
            crítica de compliance.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {config?.connected ? (
            /* Connected state */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#111] text-white border-transparent gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  Conectado
                </Badge>
              </div>
              <div className="rounded-xl bg-[#fafafa] border border-[#efefef] p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-[#555]">
                  <span className="font-medium w-16">Bot:</span>
                  <span className="font-mono">{config.bot_token_hint}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#555]">
                  <span className="font-medium w-16">Chat ID:</span>
                  <span className="font-mono">{config.chat_id}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void sendTest()}
                  disabled={testing}
                  className="gap-1.5"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Enviar prueba
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void disconnect()}
                  disabled={disconnecting}
                  className="gap-1.5 text-[#6b6b6b] hover:text-[#111]"
                >
                  {disconnecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            /* Disconnected state */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5">
                  Bot Token
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:AAF..."
                  className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5">
                  Chat ID
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-1001234567890"
                  className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => void connectAndTest()}
                  disabled={saving}
                  className="gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Conectar y enviar prueba
                </Button>
                <button
                  onClick={() => setShowHelp(true)}
                  className="text-xs text-[#555] hover:text-[#111] underline transition-colors"
                >
                  ¿Cómo obtener el Bot Token y Chat ID?
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
            {tab === "global" ? "Global (todas las llamadas)" : "Por Departamento"}
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
