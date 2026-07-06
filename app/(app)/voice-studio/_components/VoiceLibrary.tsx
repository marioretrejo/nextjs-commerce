import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Pause, Loader2, Zap, Search, X } from "lucide-react";
import type { BuiltInVoice } from "./types";
import {
  VOICE_FILTERS,
  type VoiceFilterId,
  voiceMatchesFilter,
} from "./filters";

export function VoiceLibrary({
  builtInVoices,
  voiceSearch,
  activeFilters,
  playingUrl,
  loadingPreview,
  onSearchChange,
  onFiltersChange,
  onPlay,
}: {
  builtInVoices: BuiltInVoice[];
  voiceSearch: string;
  activeFilters: VoiceFilterId[];
  playingUrl: string | null;
  loadingPreview: string | null;
  onSearchChange: (value: string) => void;
  onFiltersChange: (filters: VoiceFilterId[]) => void;
  onPlay: (voice: BuiltInVoice) => void;
}) {
  const filtered = builtInVoices.filter((v) => {
    const text =
      `${v.name} ${v.description ?? ""} ${v.language ?? ""}`.toLowerCase();
    if (voiceSearch && !text.includes(voiceSearch.toLowerCase())) return false;
    if (
      activeFilters.length > 0 &&
      !activeFilters.every((f) => voiceMatchesFilter(v, f))
    )
      return false;
    return true;
  });

  return (
    <section>
      <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-4 flex items-center gap-2">
        <Zap className="h-3.5 w-3.5" /> AI Voice Library
        <span className="font-normal text-[#a0a0a0]">
          ({builtInVoices.length} voices)
        </span>
      </h2>

      {/* Search + filter bar */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b6b]" />
          <Input
            className="pl-9 pr-8 h-9 text-sm"
            placeholder="Buscar voces por nombre o descripción…"
            value={voiceSearch}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {voiceSearch && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              onClick={() => onSearchChange("")}
            >
              <X className="h-3.5 w-3.5 text-[#6b6b6b] hover:text-[#0a0a0a]" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {VOICE_FILTERS.map((f) => {
            const active = activeFilters.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() =>
                  onFiltersChange(
                    active
                      ? activeFilters.filter((x) => x !== f.id)
                      : [...activeFilters, f.id],
                  )
                }
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  active
                    ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                    : "bg-white text-[#6b6b6b] border-[#e0e0e0] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
          {(activeFilters.length > 0 || voiceSearch) && (
            <button
              onClick={() => {
                onFiltersChange([]);
                onSearchChange("");
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-[#6b6b6b] hover:text-red-600 border border-[#e0e0e0] hover:border-red-200 transition-all"
            >
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] py-14 text-center">
          <Search className="h-8 w-8 text-[#e0e0e0] mb-3" />
          <p className="text-sm font-medium text-[#0a0a0a]">
            No se encontraron voces
          </p>
          <p className="text-xs text-[#6b6b6b] mt-1">
            Prueba con otros términos o limpia los filtros
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#a0a0a0] mb-3">
            {filtered.length} {filtered.length === 1 ? "voz" : "voces"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((v) => {
              const activeTags = VOICE_FILTERS.filter((f) =>
                voiceMatchesFilter(v, f.id),
              );
              return (
                <Card
                  key={v.voice_id}
                  className="border-[#e0e0e0] hover:border-[#6b6b6b] transition-colors group"
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0a0a0a] truncate">
                          {v.name}
                        </p>
                        {v.language && (
                          <p className="text-[10px] text-[#a0a0a0] uppercase tracking-wide">
                            {v.language}
                          </p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 ml-1 text-[#6b6b6b] hover:text-[#0a0a0a]"
                        onClick={() => onPlay(v)}
                        disabled={loadingPreview === v.voice_id}
                        title="Preview voice"
                      >
                        {loadingPreview === v.voice_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : playingUrl === `builtin:${v.voice_id}` ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    {v.description && (
                      <p className="text-[10px] text-[#6b6b6b] line-clamp-2 mb-1.5 leading-relaxed">
                        {v.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {activeTags.map((t) => (
                        <span
                          key={t.id}
                          className="rounded-full bg-[#f5f5f5] px-1.5 py-0.5 text-[9px] font-medium text-[#6b6b6b]"
                        >
                          {t.label}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
