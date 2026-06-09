/**
 * GET /api/voices
 *
 * Returns the public Cartesia voice library (Sonic-3 compatible voices).
 * Falls back to a curated static list if CARTESIA_API_KEY is not set,
 * so the UI is never broken in development.
 */
import { getCartesiaVoices } from "@/lib/cartesia";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Static fallback — a handful of well-known public Cartesia voices
const FALLBACK_VOICES = [
  {
    voice_id: "02aeee94-c02b-456e-be7a-659672acf82d",
    name: "LatAm Spanish Neutral",
    provider: "cartesia",
    preview_url: "",
    description: "Voz femenina latinoamericana neutra, cálida y profesional.",
    language: "es",
    labels: { gender: "female", accent: "latin american", age: "adult" },
  },
  {
    voice_id: "694f9389-aac1-45b6-b726-9d9369183238",
    name: "Barbershop Man",
    provider: "cartesia",
    preview_url: "",
    description: "A confident male voice with an American accent.",
    language: "en",
    labels: { gender: "male", accent: "american", age: "middle_aged" },
  },
  {
    voice_id: "a0e99841-438c-4a64-b679-ae501e7d6091",
    name: "Barbershop Woman",
    provider: "cartesia",
    preview_url: "",
    description: "A friendly female voice with an American accent.",
    language: "en",
    labels: { gender: "female", accent: "american", age: "middle_aged" },
  },
  {
    voice_id: "79a125e8-cd45-4c13-8a67-188112f4dd22",
    name: "British Lady",
    provider: "cartesia",
    preview_url: "",
    description: "A young British female voice, professional and clear.",
    language: "en",
    labels: { gender: "female", accent: "british", age: "young" },
  },
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env["CARTESIA_API_KEY"]) {
    return NextResponse.json({ voices: FALLBACK_VOICES, source: "fallback" });
  }

  try {
    const raw = await getCartesiaVoices();

    const voices = raw
      .filter((v) => v.is_public || v.is_public === undefined)
      .map((v) => ({
        voice_id: v.id,
        name: v.name,
        provider: "cartesia" as const,
        preview_url: "",
        description: v.description ?? "",
        language: v.language ?? "",
        tags: v.tags ?? [],
        labels: {
          gender: "",
          accent: "",
          age: "",
        },
      }));

    return NextResponse.json({
      voices: voices.length ? voices : FALLBACK_VOICES,
    });
  } catch (e) {
    console.error("[api/voices] Cartesia fetch failed:", e);
    return NextResponse.json({ voices: FALLBACK_VOICES, source: "fallback" });
  }
}
