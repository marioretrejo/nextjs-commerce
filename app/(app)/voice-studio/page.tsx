'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mic,
  Plus,
  Play,
  Pause,
  Trash2,
  Loader2,
  Upload,
  Zap,
  CheckCircle2,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomVoice {
  id:                string;
  name:              string;
  provider:          string;
  provider_voice_id: string;
  preview_url:       string | null;
  language:          string;
  gender:            string | null;
  status:            'cloning' | 'ready' | 'error';
  error_message:     string | null;
  created_at:        string;
}

// Also show built-in Cartesia voices from /api/voices
interface BuiltInVoice {
  voice_id:    string;
  name:        string;
  provider:    string;
  preview_url: string;
  labels: {
    gender: string;
    accent: string;
    age:    string;
  };
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  ready:   <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  cloning: <Loader2      className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
  error:   <AlertCircle  className="h-3.5 w-3.5 text-red-500" />,
};

export default function VoiceStudioPage() {
  const [customVoices,  setCustomVoices]  = useState<CustomVoice[]>([]);
  const [builtInVoices, setBuiltInVoices] = useState<BuiltInVoice[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [cloneOpen,     setCloneOpen]     = useState(false);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [playingUrl,    setPlayingUrl]    = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clone form state
  const [cloneName,    setCloneName]    = useState('');
  const [cloneGender,  setCloneGender]  = useState<string>('neutral');
  const [cloneLang,    setCloneLang]    = useState('en');
  const [cloneMode,    setCloneMode]    = useState<'similarity' | 'reconstruction'>('similarity');
  const [cloneFile,    setCloneFile]    = useState<File | null>(null);
  const [cloning,      setCloning]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [customRes, builtRes] = await Promise.all([
      fetch('/api/voices/clone'),
      fetch('/api/voices'),
    ]);
    if (customRes.ok)  setCustomVoices(await customRes.json() as CustomVoice[]);
    if (builtRes.ok) {
      const d = await builtRes.json() as { voices: BuiltInVoice[] };
      setBuiltInVoices(d.voices ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for cloning voices
  useEffect(() => {
    const hasCloning = customVoices.some((v) => v.status === 'cloning');
    if (!hasCloning) return;
    const id = setInterval(async () => {
      const res = await fetch('/api/voices/clone');
      if (res.ok) {
        const updated = await res.json() as CustomVoice[];
        setCustomVoices(updated);
        if (!updated.some((v) => v.status === 'cloning')) clearInterval(id);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [customVoices]);

  function togglePreview(url: string | null) {
    if (!url) return;
    if (playingUrl === url) {
      audioRef.current?.pause();
      setPlayingUrl(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => null);
    setPlayingUrl(url);
    audio.onended = () => setPlayingUrl(null);
  }

  async function submitClone() {
    if (!cloneName.trim() || !cloneFile) {
      toast.error('Voice name and audio file are required');
      return;
    }
    setCloning(true);
    try {
      const fd = new FormData();
      fd.append('name',     cloneName.trim());
      fd.append('language', cloneLang);
      fd.append('gender',   cloneGender);
      fd.append('mode',     cloneMode);
      fd.append('file',     cloneFile);

      const res = await fetch('/api/voices/clone', { method: 'POST', body: fd });
      const data = await res.json() as { error?: string; id?: string };
      if (!res.ok) throw new Error(data.error ?? 'Clone failed');

      toast.success('Voice cloned! Processing in background…');
      setCloneOpen(false);
      setCloneName(''); setCloneFile(null); setCloneGender('neutral'); setCloneMode('similarity');
      loadData();
    } catch (e) { toast.error(String(e)); }
    finally { setCloning(false); }
  }

  async function deleteVoice(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch('/api/voices/clone', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setCustomVoices((prev) => prev.filter((v) => v.id !== id));
      toast.success('Voice deleted');
    } catch (e) { toast.error(String(e)); }
    finally { setDeletingId(null); }
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
            Clone voices from audio samples. Cloned voices are available when configuring any agent.
          </p>
        </div>
        <Button onClick={() => setCloneOpen(true)} className="bg-[#0a0a0a] text-white hover:bg-[#262626] gap-2">
          <Wand2 className="h-4 w-4" /> Clone New Voice
        </Button>
      </div>

      {/* Cloned voices */}
      <section>
        <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3">
          Your Cloned Voices ({customVoices.length})
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[#f5f5f5] animate-pulse" />
            ))}
          </div>
        ) : customVoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] py-16 text-center">
            <Mic className="h-12 w-12 text-[#e0e0e0] mb-4" />
            <p className="font-semibold text-[#0a0a0a]">No cloned voices yet</p>
            <p className="text-sm text-[#6b6b6b] mt-1 mb-5 max-w-xs">
              Upload an audio sample and we&apos;ll clone the voice using ElevenLabs Instant Voice Cloning.
            </p>
            <Button onClick={() => setCloneOpen(true)} variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Clone your first voice
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customVoices.map((voice) => (
              <Card key={voice.id} className="border-[#e0e0e0] hover:border-[#0a0a0a] transition-colors group">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0a0a0a] truncate">{voice.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {STATUS_ICON[voice.status]}
                        <span className={`text-xs ${voice.status === 'error' ? 'text-red-600' : 'text-[#6b6b6b]'}`}>
                          {voice.status === 'cloning' ? 'Cloning…' : voice.status === 'error' ? (voice.error_message ?? 'Failed') : 'Ready'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-[#6b6b6b] hover:text-red-600"
                        disabled={deletingId === voice.id}
                        onClick={() => deleteVoice(voice.id)}
                      >
                        {deletingId === voice.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{voice.provider}</Badge>
                    {voice.gender && <Badge variant="secondary" className="text-[10px]">{voice.gender}</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{voice.language.toUpperCase()}</Badge>
                  </div>

                  {voice.preview_url && voice.status === 'ready' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 text-xs"
                      onClick={() => togglePreview(voice.preview_url)}
                    >
                      {playingUrl === voice.preview_url
                        ? <><Pause className="h-3.5 w-3.5" /> Stop preview</>
                        : <><Play  className="h-3.5 w-3.5" /> Preview voice</>}
                    </Button>
                  )}

                  <p className="text-[10px] text-[#a0a0a0] font-mono truncate" title={voice.provider_voice_id}>
                    ID: {voice.provider_voice_id}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Built-in Cartesia voice gallery */}
      <section>
        <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5" /> Cartesia Sonic-3 Voice Library
          <span className="font-normal text-[#a0a0a0]">({builtInVoices.length} voices)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {builtInVoices.slice(0, 24).map((v) => (
            <Card key={v.voice_id} className="border-[#e0e0e0] hover:border-[#6b6b6b] transition-colors group">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{v.name}</p>
                  {v.preview_url && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => togglePreview(v.preview_url)}
                    >
                      {playingUrl === v.preview_url
                        ? <Pause className="h-3 w-3" />
                        : <Play  className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {v.labels.gender && <Badge variant="secondary" className="text-[9px] px-1">{v.labels.gender}</Badge>}
                  {v.labels.accent && <Badge variant="outline"   className="text-[9px] px-1">{v.labels.accent}</Badge>}
                  {v.labels.age    && <Badge variant="outline"   className="text-[9px] px-1">{v.labels.age}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Clone dialog */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" /> Clone a Voice
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Voice name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Alex Sales Voice"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={cloneLang} onValueChange={setCloneLang}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {([['en','English'],['es','Spanish'],['fr','French'],['de','German'],['pt','Portuguese'],['it','Italian'],['ja','Japanese'],['zh','Chinese']] as [string,string][]).map(([v,l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Gender (metadata)</Label>
                <Select value={cloneGender} onValueChange={setCloneGender}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Clone mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: 'similarity',     label: 'Similarity',     desc: 'Fastest · ≥10s clip' },
                  { v: 'reconstruction', label: 'Reconstruction',  desc: 'Best quality · ≥30s' },
                ] as const).map(({ v, label, desc }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCloneMode(v)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-colors
                      ${cloneMode === v ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-[#e0e0e0] hover:border-[#6b6b6b]'}`}
                  >
                    <p className="font-semibold">{label}</p>
                    <p className={cloneMode === v ? 'text-white/60' : 'text-[#6b6b6b]'}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Audio clip <span className="text-red-500">*</span></Label>
              <div
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors
                  ${cloneFile ? 'border-green-400 bg-green-50' : 'border-[#e0e0e0] hover:border-[#0a0a0a]'}`}
                onClick={() => fileRef.current?.click()}
              >
                {cloneFile ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
                    <p className="text-sm font-medium text-green-700">{cloneFile.name}</p>
                    <p className="text-xs text-green-600">{(cloneFile.size / 1024 / 1024).toFixed(1)} MB · {cloneMode} mode</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-[#6b6b6b] mb-2" />
                    <p className="text-sm text-[#6b6b6b]">Click to upload .mp3 or .wav</p>
                    <p className="text-xs text-[#a0a0a0] mt-0.5">Max 25 MB · {cloneMode === 'similarity' ? '≥10 seconds' : '≥30 seconds recommended'}</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,.ogg"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setCloneFile(f); }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#e0e0e0] bg-[#f9f9f9] px-3 py-2.5 text-xs text-[#6b6b6b] space-y-1">
              <p className="font-semibold text-[#0a0a0a]">Cartesia Voice Cloning tips:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>One speaker only, no background music</li>
                <li>Similarity mode: fast clone from any clear clip ≥10s</li>
                <li>Reconstruction: highest quality, needs 30s+ of speech</li>
                <li>Requires <code className="bg-[#f0f0f0] rounded px-0.5">CARTESIA_API_KEY</code> env var</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloneOpen(false)}>Cancel</Button>
            <Button
              onClick={submitClone}
              disabled={cloning || !cloneName.trim() || !cloneFile}
              className="bg-[#0a0a0a] text-white hover:bg-[#262626]"
            >
              {cloning ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cloning…</>
              ) : (
                <><Wand2 className="mr-2 h-4 w-4" /> Clone Voice</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
