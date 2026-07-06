"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TelegramHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[#efefef]">
          <h2 className="font-bold text-[#111] flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/telegram-logo.svg" alt="Telegram" className="h-4 w-4" />
            Cómo configurar Telegram
          </h2>
          <button
            onClick={onClose}
            className="text-[#9b9b9b] hover:text-[#111]"
          >
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
                text: "Mandá el comando /newbot y seguí los pasos para crear el bot",
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
