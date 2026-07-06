"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, CheckCircle2, Wand2 } from "lucide-react";
import { toast } from "sonner";

export function CloneDialog({
  open,
  onOpenChange,
  onCloned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloned: () => void;
}) {
  const [cloneName, setCloneName] = useState("");
  const [cloneGender, setCloneGender] = useState<string>("neutral");
  const [cloneLang, setCloneLang] = useState("en");
  const [cloneMode, setCloneMode] = useState<"similarity" | "reconstruction">(
    "similarity",
  );
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloning, setCloning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submitClone() {
    if (!cloneName.trim() || !cloneFile) {
      toast.error("Voice name and audio file are required");
      return;
    }
    setCloning(true);
    try {
      const fd = new FormData();
      fd.append("name", cloneName.trim());
      fd.append("language", cloneLang);
      fd.append("gender", cloneGender);
      fd.append("mode", cloneMode);
      fd.append("file", cloneFile);

      const res = await fetch("/api/voices/clone", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) throw new Error(data.error ?? "Clone failed");

      toast.success("Voice cloned! Processing in background…");
      onOpenChange(false);
      setCloneName("");
      setCloneFile(null);
      setCloneGender("neutral");
      setCloneMode("similarity");
      onCloned();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCloning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" /> Clone a Voice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>
              Voice name <span className="text-red-500">*</span>
            </Label>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      ["en", "English"],
                      ["es", "Spanish"],
                      ["fr", "French"],
                      ["de", "German"],
                      ["pt", "Portuguese"],
                      ["it", "Italian"],
                      ["ja", "Japanese"],
                      ["zh", "Chinese"],
                    ] as [string, string][]
                  ).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gender (metadata)</Label>
              <Select value={cloneGender} onValueChange={setCloneGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              {(
                [
                  {
                    v: "similarity",
                    label: "Similarity",
                    desc: "Fastest · ≥10s clip",
                  },
                  {
                    v: "reconstruction",
                    label: "Reconstruction",
                    desc: "Best quality · ≥30s",
                  },
                ] as const
              ).map(({ v, label, desc }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCloneMode(v)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-colors
                    ${cloneMode === v ? "border-[#0a0a0a] bg-[#0a0a0a] text-white" : "border-[#e0e0e0] hover:border-[#6b6b6b]"}`}
                >
                  <p className="font-semibold">{label}</p>
                  <p
                    className={
                      cloneMode === v ? "text-white/60" : "text-[#6b6b6b]"
                    }
                  >
                    {desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Audio clip <span className="text-red-500">*</span>
            </Label>
            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors
                ${cloneFile ? "border-green-400 bg-green-50" : "border-[#e0e0e0] hover:border-[#0a0a0a]"}`}
              onClick={() => fileRef.current?.click()}
            >
              {cloneFile ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-green-700">
                    {cloneFile.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {(cloneFile.size / 1024 / 1024).toFixed(1)} MB · {cloneMode}{" "}
                    mode
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-[#6b6b6b] mb-2" />
                  <p className="text-sm text-[#6b6b6b]">
                    Click to upload .mp3 or .wav
                  </p>
                  <p className="text-xs text-[#a0a0a0] mt-0.5">
                    Max 25 MB ·{" "}
                    {cloneMode === "similarity"
                      ? "≥10 seconds"
                      : "≥30 seconds recommended"}
                  </p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setCloneFile(f);
                }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#e0e0e0] bg-[#f9f9f9] px-3 py-2.5 text-xs text-[#6b6b6b] space-y-1">
            <p className="font-semibold text-[#0a0a0a]">Voice Cloning tips:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>One speaker only, no background music</li>
              <li>Similarity mode: fast clone from any clear clip ≥10s</li>
              <li>Reconstruction: highest quality, needs 30s+ of speech</li>
              <li>Clear audio quality improves accuracy</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submitClone}
            disabled={cloning || !cloneName.trim() || !cloneFile}
            className="bg-[#0a0a0a] text-white hover:bg-[#262626]"
          >
            {cloning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cloning…
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" /> Clone Voice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
