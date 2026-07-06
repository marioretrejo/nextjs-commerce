"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { CustomVoice, BuiltInVoice } from "./_components/types";
import type { VoiceFilterId } from "./_components/filters";
import { ClonedVoicesSection } from "./_components/ClonedVoicesSection";
import { VoiceLibrary } from "./_components/VoiceLibrary";
import { CloneDialog } from "./_components/CloneDialog";

export default function VoiceStudioPage() {
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [builtInVoices, setBuiltInVoices] = useState<BuiltInVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<VoiceFilterId[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [customRes, builtRes] = await Promise.all([
      fetch("/api/voices/clone"),
      fetch("/api/voices"),
    ]);
    if (customRes.ok)
      setCustomVoices((await customRes.json()) as CustomVoice[]);
    if (builtRes.ok) {
      const d = (await builtRes.json()) as { voices: BuiltInVoice[] };
      setBuiltInVoices(d.voices ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for cloning voices
  useEffect(() => {
    const hasCloning = customVoices.some((v) => v.status === "cloning");
    if (!hasCloning) return;
    const id = setInterval(async () => {
      const res = await fetch("/api/voices/clone");
      if (res.ok) {
        const updated = (await res.json()) as CustomVoice[];
        setCustomVoices(updated);
        if (!updated.some((v) => v.status === "cloning")) clearInterval(id);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [customVoices]);

  function stopAudio() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    setPlayingUrl(null);
  }

  function togglePreview(url: string | null) {
    if (!url) return;
    if (playingUrl === url) {
      stopAudio();
      return;
    }
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlayingUrl(null);
    setPlayingUrl(url);
    audio.play().catch(() => {
      toast.error("No se pudo reproducir el audio.");
      setPlayingUrl(null);
    });
  }

  async function playBuiltInVoice(voice: BuiltInVoice) {
    const key = `builtin:${voice.voice_id}`;
    if (playingUrl === key) {
      stopAudio();
      return;
    }
    stopAudio();
    setLoadingPreview(voice.voice_id);
    try {
      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voice.voice_id,
          language: voice.language || "en",
        }),
      });
      if (!res.ok) {
        const err = (await res
          .json()
          .catch(() => ({ error: "Error al generar preview" }))) as {
          error?: string;
        };
        toast.error(err.error ?? "No se pudo generar el preview");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlsRef.current.push(blobUrl);
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingUrl(null);
        URL.revokeObjectURL(blobUrl);
      };
      setPlayingUrl(key);
      audio.play().catch(() => {
        toast.error("No se pudo reproducir el audio.");
        setPlayingUrl(null);
      });
    } catch {
      toast.error("Fallo al generar preview. Verifica la API key de Cartesia.");
    } finally {
      setLoadingPreview(null);
    }
  }

  async function deleteVoice(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/voices/clone", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setCustomVoices((prev) => prev.filter((v) => v.id !== id));
      toast.success("Voice deleted");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mic className="h-6 w-6" /> Voice Studio
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            Clone voices from audio samples. Cloned voices are available when
            configuring any agent.
          </p>
        </div>
        <Button
          onClick={() => setCloneOpen(true)}
          className="bg-[#0a0a0a] text-white hover:bg-[#262626] gap-2"
        >
          <Wand2 className="h-4 w-4" /> Clone New Voice
        </Button>
      </div>

      {/* Cloned voices */}
      <ClonedVoicesSection
        customVoices={customVoices}
        loading={loading}
        deletingId={deletingId}
        playingUrl={playingUrl}
        onClone={() => setCloneOpen(true)}
        onDelete={(id) => void deleteVoice(id)}
        onTogglePreview={togglePreview}
      />

      {/* Built-in voice gallery */}
      <VoiceLibrary
        builtInVoices={builtInVoices}
        voiceSearch={voiceSearch}
        activeFilters={activeFilters}
        playingUrl={playingUrl}
        loadingPreview={loadingPreview}
        onSearchChange={setVoiceSearch}
        onFiltersChange={setActiveFilters}
        onPlay={(v) => void playBuiltInVoice(v)}
      />

      {/* Clone dialog */}
      <CloneDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        onCloned={loadData}
      />
    </div>
  );
}
