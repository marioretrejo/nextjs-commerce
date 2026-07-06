import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import type { BuiltInVoice } from "./types";

// ── Voice filter taxonomy ─────────────────────────────────────────────────────
export const VOICE_FILTERS = [
  { id: "female", label: "Femenino", re: /\b(female|woman|mujer|femenin)/i },
  {
    id: "male",
    label: "Masculino",
    re: /\b(male(?!vol)|man\b|hombre|masculin)/i,
  },
  {
    id: "latino",
    label: "Latino",
    re: /\b(latin|spanish|hispano|latam|español|colombia|mexic|venezuel|argentin|chil|perua)/i,
  },
  {
    id: "conversational",
    label: "Conversacional",
    re: /\b(conversation|casual|natural|everyday|friendly|amigable|chat)/i,
  },
  {
    id: "narrative",
    label: "Narrativa",
    re: /\b(narrat|storytell|audiobook|story\b)/i,
  },
  {
    id: "professional",
    label: "Profesional",
    re: /\b(profes|formal|business|corporate|executiv|ejecutiv)/i,
  },
] as const;
export type VoiceFilterId = (typeof VOICE_FILTERS)[number]["id"];

export function voiceMatchesFilter(
  v: BuiltInVoice,
  filterId: VoiceFilterId,
): boolean {
  const haystack = [
    v.name,
    v.description ?? "",
    ...(v.tags ?? []),
    v.labels?.gender ?? "",
    v.labels?.accent ?? "",
    v.language ?? "",
  ].join(" ");
  return VOICE_FILTERS.find((f) => f.id === filterId)!.re.test(haystack);
}

export const STATUS_ICON: Record<string, React.ReactNode> = {
  ready: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  cloning: <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
};
