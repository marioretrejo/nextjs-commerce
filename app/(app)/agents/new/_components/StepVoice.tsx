"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Play, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  VOICE_FILTERS,
  type Voice,
  type VoiceFilterId,
  type FormState,
  type SetField,
} from "./constants";

export function StepVoice({
  form,
  setField,
  setForm,
  voices,
  voiceSearch,
  setVoiceSearch,
  voiceFilters,
  setVoiceFilters,
  playingVoice,
  playPreview,
}: {
  form: FormState;
  setField: SetField;
  setForm: Dispatch<SetStateAction<FormState>>;
  voices: Voice[];
  voiceSearch: string;
  setVoiceSearch: (v: string) => void;
  voiceFilters: VoiceFilterId[];
  setVoiceFilters: Dispatch<SetStateAction<VoiceFilterId[]>>;
  playingVoice: string | null;
  playPreview: (v: Voice) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Voice</Label>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b6b]" />
            <Input
              className="pl-8 pr-7 h-8 text-xs"
              placeholder="Buscar voz…"
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
            />
            {voiceSearch && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setVoiceSearch("")}
              >
                <X className="h-3 w-3 text-[#6b6b6b]" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {VOICE_FILTERS.map((f) => {
              const active = voiceFilters.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setVoiceFilters((prev) =>
                      active ? prev.filter((x) => x !== f.id) : [...prev, f.id],
                    )
                  }
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-all ${
                    active
                      ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                      : "bg-white text-[#6b6b6b] border-[#e0e0e0] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
            {(voiceFilters.length > 0 || voiceSearch) && (
              <button
                type="button"
                onClick={() => {
                  setVoiceFilters([]);
                  setVoiceSearch("");
                }}
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] text-[#6b6b6b] hover:text-red-600 border border-[#e0e0e0] hover:border-red-200 transition-all"
              >
                <X className="h-2.5 w-2.5" /> Limpiar
              </button>
            )}
          </div>

          {/* Voice list */}
          <div className="max-h-56 overflow-y-auto rounded-md border border-[#e0e0e0]">
            {voices.length === 0 ? (
              <div className="p-4 text-center text-sm text-[#6b6b6b]">
                Loading voices…
              </div>
            ) : (
              (() => {
                const filtered = voices.filter((v) => {
                  const text =
                    `${v.name} ${v.description ?? ""} ${v.language ?? ""}`.toLowerCase();
                  if (voiceSearch && !text.includes(voiceSearch.toLowerCase()))
                    return false;
                  const haystack =
                    `${v.name} ${v.description ?? ""} ${(v.tags ?? []).join(" ")} ${v.language ?? ""}`.toLowerCase();
                  if (
                    voiceFilters.length > 0 &&
                    !voiceFilters.every((f) =>
                      VOICE_FILTERS.find((fi) => fi.id === f)!.re.test(
                        haystack,
                      ),
                    )
                  )
                    return false;
                  return true;
                });
                if (filtered.length === 0)
                  return (
                    <div className="p-4 text-center text-xs text-[#6b6b6b]">
                      No se encontraron voces
                    </div>
                  );
                return filtered.map((v) => (
                  <div
                    key={v.voice_id}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        voice_id: v.voice_id,
                        voice_name: v.name,
                      }))
                    }
                    className={`flex items-center justify-between p-3 cursor-pointer border-b border-[#e0e0e0] last:border-b-0 transition-colors ${form.voice_id === v.voice_id ? "bg-[#0a0a0a] text-white" : "hover:bg-[#f5f5f5]"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{v.name}</p>
                        {v.language && (
                          <span
                            className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 uppercase ${form.voice_id === v.voice_id ? "bg-white/20 text-white" : "bg-[#f5f5f5] text-[#6b6b6b]"}`}
                          >
                            {v.language}
                          </span>
                        )}
                      </div>
                      {v.description ? (
                        <p
                          className={`text-xs line-clamp-1 ${form.voice_id === v.voice_id ? "text-[#aaa]" : "text-[#6b6b6b]"}`}
                        >
                          {v.description}
                        </p>
                      ) : (
                        <p
                          className={`text-xs ${form.voice_id === v.voice_id ? "text-[#aaa]" : "text-[#6b6b6b]"}`}
                        >
                          {v.labels?.["gender"] ?? ""}{" "}
                          {v.labels?.["accent"]
                            ? `· ${v.labels["accent"]}`
                            : ""}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        playPreview(v);
                      }}
                      disabled={playingVoice === v.voice_id}
                      className="p-1.5 rounded-md hover:bg-white/20 disabled:opacity-60"
                    >
                      {playingVoice === v.voice_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ));
              })()
            )}
          </div>
        </div>
        <div className="space-y-3">
          <Label>Voice Emotion</Label>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { value: null, label: "😶 None" },
                { value: "calm", label: "😌 Calm" },
                { value: "sympathetic", label: "🤝 Sympathetic" },
                { value: "happy", label: "😊 Happy" },
                { value: "sad", label: "😢 Sad" },
                { value: "angry", label: "😠 Angry" },
                { value: "fearful", label: "😨 Fearful" },
                { value: "surprised", label: "😲 Surprised" },
              ] as { value: string | null; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value ?? "none"}
                type="button"
                onClick={() =>
                  setField("voice_emotion" as keyof typeof form, value as never)
                }
                className={`rounded-lg border p-2 text-xs text-center transition-colors ${
                  (form as Record<string, unknown>)["voice_emotion"] === value
                    ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                    : "border-[#e0e0e0] hover:border-[#0a0a0a]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
