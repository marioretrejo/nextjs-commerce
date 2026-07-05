"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AiStateData,
  SemanticRouterData,
  WebhookData,
  TransferData,
  EndCallData,
  Intent,
} from "./types";

export function AiStateInspector({
  data,
  patch,
}: {
  data: AiStateData;
  patch: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">State Name</Label>
        <Input
          value={data.state_name}
          onChange={(e) => patch({ state_name: e.target.value })}
          placeholder="e.g. Qualification, Closing…"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">System Instructions</Label>
        <Textarea
          rows={7}
          value={data.system_instructions}
          onChange={(e) => patch({ system_instructions: e.target.value })}
          placeholder="Describe the LLM objective and behaviour for this phase…"
          className="text-sm resize-none"
        />
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Variables disponibles
        </p>
        <div className="flex flex-wrap gap-1">
          {[
            "{{contact_name}}",
            "{{contact_phone}}",
            "{{agent_name}}",
            "{{workspace_name}}",
          ].map((v) => (
            <code
              key={v}
              className="rounded bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] text-indigo-600 cursor-pointer hover:bg-indigo-50"
              onClick={() =>
                patch({
                  system_instructions: (data.system_instructions || "") + v,
                })
              }
              title="Click to insert"
            >
              {v}
            </code>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">
          Click para insertar en las instrucciones
        </p>
      </div>
    </>
  );
}

export function SemanticRouterInspector({
  data,
  patch,
}: {
  data: SemanticRouterData;
  patch: (p: Record<string, unknown>) => void;
}) {
  const intents: Intent[] = Array.isArray(data.intents) ? data.intents : [];

  function addIntent() {
    patch({
      intents: [
        ...intents,
        { id: crypto.randomUUID(), label: "", description: "" },
      ],
    });
  }
  function removeIntent(intentId: string) {
    patch({ intents: intents.filter((i) => i.id !== intentId) });
  }
  function updateIntent(intentId: string, field: keyof Intent, value: string) {
    patch({
      intents: intents.map((i) =>
        i.id === intentId ? { ...i, [field]: value } : i,
      ),
    });
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Descripción del Router</Label>
        <Input
          value={data.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="¿Qué decide este router?"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            Intents ({intents.length})
          </Label>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={addIntent}
          >
            <Plus className="mr-1 h-3 w-3" /> Añadir
          </Button>
        </div>

        {intents.length === 0 && (
          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-center">
            <p className="text-[11px] text-amber-600">
              Sin intents. Cada intent crea un handle de salida en el nodo.
            </p>
          </div>
        )}

        {intents.map((intent, idx) => (
          <div
            key={intent.id}
            className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">
                Intent {idx + 1}
              </span>
              <button
                onClick={() => removeIntent(intent.id)}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500">
                Label (se muestra en el edge)
              </Label>
              <Input
                value={intent.label}
                onChange={(e) =>
                  updateIntent(intent.id, "label", e.target.value)
                }
                placeholder="e.g. Interesado"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500">
                Descripción (para el LLM)
              </Label>
              <Input
                value={intent.description}
                onChange={(e) =>
                  updateIntent(intent.id, "description", e.target.value)
                }
                placeholder="Cuando el contacto expresa interés…"
                className="h-7 text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function WebhookInspector({
  data,
  patch,
}: {
  data: WebhookData;
  patch: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">URL</Label>
        <Input
          value={data.url}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Método HTTP</Label>
        <Select value={data.method} onValueChange={(v) => patch({ method: v })}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Variables a extraer</Label>
        <Input
          value={data.extract_variables}
          onChange={(e) => patch({ extract_variables: e.target.value })}
          placeholder="price,availability,lead_id"
          className="h-8 text-sm font-mono"
        />
        <p className="text-[10px] text-gray-400">
          Nombres separados por coma del JSON de respuesta
        </p>
      </div>
    </>
  );
}

export function TransferInspector({
  data,
  patch,
}: {
  data: TransferData;
  patch: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Número de transferencia</Label>
      <Input
        value={data.transfer_number}
        onChange={(e) => patch({ transfer_number: e.target.value })}
        placeholder="+1234567890"
        className="h-8 text-sm font-mono"
      />
      <p className="text-[10px] text-gray-400">
        Formato E.164. La llamada se transfiere a este número via SIP REFER.
      </p>
    </div>
  );
}

export function EndCallInspector({
  data,
  patch,
}: {
  data: EndCallData;
  patch: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Mensaje de despedida</Label>
      <Textarea
        rows={3}
        value={data.farewell}
        onChange={(e) => patch({ farewell: e.target.value })}
        placeholder="Gracias por su tiempo, ¡que tenga un buen día!"
        className="text-sm resize-none"
      />
      <p className="text-[10px] text-gray-400">
        Opcional. El agente lo dirá antes de colgar.
      </p>
    </div>
  );
}
