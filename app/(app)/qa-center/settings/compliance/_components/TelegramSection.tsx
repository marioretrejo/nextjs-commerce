"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Send, Unlink, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TelegramHelpModal } from "./TelegramHelpModal";

export function TelegramSection() {
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
      const testData = (await testRes.json()) as {
        ok: boolean;
        error?: string;
      };
      if (!testRes.ok || !testData.ok) {
        toast.error(
          friendlyTelegramError(testData.error ?? "Error desconocido"),
        );
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
    return <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />;
  }

  return (
    <>
      {showHelp && <TelegramHelpModal onClose={() => setShowHelp(false)} />}
      <Card className="border-[#e0e0e0]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/telegram-logo.svg" alt="Telegram" className="h-5 w-5" />
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
