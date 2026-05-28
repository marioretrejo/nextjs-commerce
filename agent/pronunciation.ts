/**
 * Pronunciation Dictionary Loader
 *
 * Loads per-agent custom vocabulary from Supabase and converts it into the
 * formats expected by each provider:
 *   - Deepgram `keywords`: boosts recognition probability for rare/brand terms
 *   - Deepgram `keyterm`: exact-match terms that must be transcribed verbatim
 *   - Cartesia `ttsPronunciationMap`: text replacements applied before synthesis
 *
 * Configuration is stored in agents.widget_config under the key "pronunciation":
 *
 *   widget_config: {
 *     "pronunciation": {
 *       "keywords":  [["VoiceOS", 1.5], ["ACME Corp", 1.2]],  // [term, boost 0–10]
 *       "keyterms":  ["VoiceOS", "Groq", "Cartesia"],          // exact-match
 *       "tts_map":   { "VoiceOS": "Voice O S", "ACME": "Ack Me" }
 *     }
 *   }
 *
 * Falls back to built-in platform defaults if no config is found.
 */
import { createClient } from '@supabase/supabase-js';

export interface PronunciationConfig {
  /** Deepgram keyword boosts: [term, intensity 0–10] */
  deepgramKeywords: [string, number][];
  /** Deepgram exact-match key terms */
  deepgramKeyterms: string[];
  /** Cartesia / TTS text replacement map: { "original": "phonetic" } */
  ttsMap: Record<string, string>;
}

/** Platform-level defaults — always active regardless of agent config. */
const PLATFORM_DEFAULTS: PronunciationConfig = {
  deepgramKeywords: [
    ['VoiceOS', 1.5],
    ['Groq', 1.2],
    ['Cartesia', 1.2],
    ['LiveKit', 1.2],
    ['Deepgram', 1.2],
  ],
  deepgramKeyterms: ['VoiceOS'],
  ttsMap: {
    'VoiceOS':  'Voice O S',
    'LiveKit':  'Live Kit',
    'Deepgram': 'Deep gram',
    'Groq':     'Groh k',
  },
};

/**
 * Load pronunciation config for an agent.
 * Returns merged platform defaults + agent-specific overrides.
 * Never throws — on any error it returns the platform defaults.
 */
export async function loadPronunciationConfig(
  agentId: string | null,
  supabaseUrl: string,
  supabaseKey: string
): Promise<PronunciationConfig> {
  if (!agentId) return PLATFORM_DEFAULTS;

  try {
    const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data } = await db
      .from('agents')
      .select('widget_config')
      .eq('id', agentId)
      .single();

    const cfg = (data as { widget_config?: Record<string, unknown> } | null)?.widget_config;
    const p = cfg?.['pronunciation'] as {
      keywords?: [string, number][];
      keyterms?: string[];
      tts_map?: Record<string, string>;
    } | undefined;

    if (!p) return PLATFORM_DEFAULTS;

    return {
      deepgramKeywords: [
        ...PLATFORM_DEFAULTS.deepgramKeywords,
        ...(p.keywords ?? []),
      ],
      deepgramKeyterms: [
        ...PLATFORM_DEFAULTS.deepgramKeyterms,
        ...(p.keyterms ?? []),
      ],
      ttsMap: {
        ...PLATFORM_DEFAULTS.ttsMap,
        ...(p.tts_map ?? {}),
      },
    };
  } catch {
    return PLATFORM_DEFAULTS;
  }
}
