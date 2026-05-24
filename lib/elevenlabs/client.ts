const BASE = 'https://api.elevenlabs.io/v1';

function headers(extra?: Record<string, string>) {
  return {
    'xi-api-key': process.env['ELEVENLABS_API_KEY'] ?? '',
    'Content-Type': 'application/json',
    ...extra
  };
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface ELVoice {
  voice_id: string;
  name: string;
  preview_url: string;
  category: string;
  labels: Record<string, string>;
  description?: string;
  available_for_tiers: string[];
}

export interface ELVoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export const elevenlabs = {
  // Voices
  async listVoices(): Promise<{ voices: ELVoice[] }> {
    return req('GET', '/voices');
  },
  async getVoice(voiceId: string): Promise<ELVoice> {
    return req('GET', `/voices/${voiceId}`);
  },
  async cloneVoice(formData: FormData): Promise<{ voice_id: string }> {
    const res = await fetch(`${BASE}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env['ELEVENLABS_API_KEY'] ?? '' },
      body: formData
    });
    if (!res.ok) throw new Error(`Clone failed: ${res.status}`);
    return res.json() as Promise<{ voice_id: string }>;
  },
  async deleteVoice(voiceId: string): Promise<void> {
    await req('DELETE', `/voices/${voiceId}`);
  },

  // TTS
  async textToSpeech(voiceId: string, text: string, settings?: ELVoiceSettings): Promise<ArrayBuffer> {
    const res = await fetch(`${BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: settings ?? { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
    return res.arrayBuffer();
  },

  // Knowledge base (for Conversational AI)
  async createKnowledgeBase(name: string, fileUrl: string): Promise<{ id: string }> {
    return req('POST', '/convai/knowledge-base', {
      name,
      urls: [fileUrl]
    });
  },
  async deleteKnowledgeBase(id: string): Promise<void> {
    await req('DELETE', `/convai/knowledge-base/${id}`);
  },

  // Conversational AI agent
  async createAgent(config: Record<string, unknown>): Promise<{ agent_id: string }> {
    return req('POST', '/convai/agents/create', config);
  },
  async updateAgent(agentId: string, config: Record<string, unknown>): Promise<void> {
    await req('PATCH', `/convai/agents/${agentId}`, config);
  },
  async deleteAgent(agentId: string): Promise<void> {
    await req('DELETE', `/convai/agents/${agentId}`);
  }
};
