export interface CustomVoice {
  id: string;
  name: string;
  provider: string;
  provider_voice_id: string;
  preview_url: string | null;
  language: string;
  gender: string | null;
  status: "cloning" | "ready" | "error";
  error_message: string | null;
  created_at: string;
}

// Also show built-in Cartesia voices from /api/voices
export interface BuiltInVoice {
  voice_id: string;
  name: string;
  provider: string;
  preview_url: string;
  description?: string;
  language?: string;
  tags?: string[];
  labels: {
    gender: string;
    accent: string;
    age: string;
  };
}
