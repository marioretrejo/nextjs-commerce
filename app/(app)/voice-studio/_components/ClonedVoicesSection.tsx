import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Plus, Play, Pause, Trash2, Loader2 } from "lucide-react";
import type { CustomVoice } from "./types";
import { STATUS_ICON } from "./filters";

export function ClonedVoicesSection({
  customVoices,
  loading,
  deletingId,
  playingUrl,
  onClone,
  onDelete,
  onTogglePreview,
}: {
  customVoices: CustomVoice[];
  loading: boolean;
  deletingId: string | null;
  playingUrl: string | null;
  onClone: () => void;
  onDelete: (id: string) => void;
  onTogglePreview: (url: string | null) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3">
        Your Cloned Voices ({customVoices.length})
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-[#f5f5f5] animate-pulse"
            />
          ))}
        </div>
      ) : customVoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] py-16 text-center">
          <Mic className="h-12 w-12 text-[#e0e0e0] mb-4" />
          <p className="font-semibold text-[#0a0a0a]">No cloned voices yet</p>
          <p className="text-sm text-[#6b6b6b] mt-1 mb-5 max-w-xs">
            Upload an audio sample and we&apos;ll clone the voice using Cartesia
            Instant Voice Cloning.
          </p>
          <Button
            onClick={onClone}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Clone your first voice
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customVoices.map((voice) => (
            <Card
              key={voice.id}
              className="border-[#e0e0e0] hover:border-[#0a0a0a] transition-colors group"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0a0a0a] truncate">
                      {voice.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {STATUS_ICON[voice.status]}
                      <span
                        className={`text-xs ${voice.status === "error" ? "text-red-600" : "text-[#6b6b6b]"}`}
                      >
                        {voice.status === "cloning"
                          ? "Cloning…"
                          : voice.status === "error"
                            ? (voice.error_message ?? "Failed")
                            : "Ready"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-[#6b6b6b] hover:text-red-600"
                      disabled={deletingId === voice.id}
                      onClick={() => onDelete(voice.id)}
                    >
                      {deletingId === voice.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {voice.provider}
                  </Badge>
                  {voice.gender && (
                    <Badge variant="secondary" className="text-[10px]">
                      {voice.gender}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {voice.language.toUpperCase()}
                  </Badge>
                </div>

                {voice.preview_url && voice.status === "ready" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 text-xs"
                    onClick={() => onTogglePreview(voice.preview_url)}
                  >
                    {playingUrl === voice.preview_url ? (
                      <>
                        <Pause className="h-3.5 w-3.5" /> Stop preview
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Preview voice
                      </>
                    )}
                  </Button>
                )}

                <p
                  className="text-[10px] text-[#a0a0a0] font-mono truncate"
                  title={voice.provider_voice_id}
                >
                  ID: {voice.provider_voice_id}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
