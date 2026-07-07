export interface ProviderCosts {
  twilio_outbound_per_min: number;
  twilio_inbound_per_min: number;
  livekit_per_min: number;
  stt_per_min: number;
  llm_per_1k_tokens: number;
  tts_per_1k_chars: number;
}

// Precios oficiales 2025 en USD
// Twilio: $0.014/min (twilio.com/en-us/voice/pricing/us)
// Deepgram Nova-3 streaming: $0.0077/min (deepgram.com/pricing)
// Cartesia Sonic-3: $50/1M chars = $0.05/1k chars (cartesia.ai/pricing)
// Groq Llama 4 Scout: $0.11/1M input + $0.34/1M output ≈ $0.000225/1k tok blended
// LiveKit Cloud: $0.0005/participant-min (livekit.io/pricing)
export const DEFAULTS: ProviderCosts = {
  twilio_outbound_per_min: 0.014,
  twilio_inbound_per_min: 0.014,
  livekit_per_min: 0.0005,
  stt_per_min: 0.0077,
  llm_per_1k_tokens: 0.000225,
  tts_per_1k_chars: 0.05,
};

export const COST_FIELDS: {
  key: keyof ProviderCosts;
  label: string;
  unit: string;
  hint: string;
  how: string;
}[] = [
  {
    key: "twilio_outbound_per_min",
    label: "Twilio Saliente",
    unit: "$/min",
    hint: "twilio.com/en-us/voice/pricing/us",
    how: "Cobra por minuto conectado desde que el destinatario contesta hasta que cuelga. Precio oficial para llamadas salientes a EE.UU.: $0.014/min. Se factura en fracciones de segundo.",
  },
  {
    key: "twilio_inbound_per_min",
    label: "Twilio Entrante",
    unit: "$/min",
    hint: "twilio.com/en-us/voice/pricing/us",
    how: "Mismo modelo que saliente pero para llamadas que recibe tu número. $0.014/min para números de EE.UU. Se suma al costo de renta del número (~$1.15/mes).",
  },
  {
    key: "livekit_per_min",
    label: "LiveKit WebRTC",
    unit: "$/min",
    hint: "livekit.io/pricing — por participante/min",
    how: "Cobra por participante × minuto de media (audio/video) procesada. $0.0005/participante/min en plan pagado. Solo aplica en llamadas desde navegador; las llamadas telefónicas SIP tienen tarifa separada.",
  },
  {
    key: "stt_per_min",
    label: "Deepgram Nova-3",
    unit: "$/min",
    hint: "deepgram.com/pricing — STT streaming",
    how: "Cobra por minuto de audio enviado al modelo de transcripción, se factura aunque haya silencio. Nova-3 Streaming (tiempo real): $0.0077/min en PAYG. Plan Growth baja a $0.0065/min.",
  },
  {
    key: "llm_per_1k_tokens",
    label: "Groq · Llama 4 Scout",
    unit: "$/1k tokens",
    hint: "groq.com/pricing — promedio input+output",
    how: "Cobra por tokens procesados: $0.11/1M tokens de entrada + $0.34/1M tokens de salida. El valor configurado ($0.000225/1k) es un promedio blended asumiendo ~50% input / 50% output. Es el proveedor más barato del stack.",
  },
  {
    key: "tts_per_1k_chars",
    label: "Cartesia Sonic-3",
    unit: "$/1k chars",
    hint: "cartesia.ai/pricing — $50/1M chars",
    how: "Cobra por cada carácter de texto que el agente convierte a voz. Precio oficial: $50 por 1,000,000 caracteres = $0.05 por cada 1,000 chars. A 800 chars/min en una llamada de 3 min = $0.12. Es el componente más costoso del stack.",
  },
];

// Promedios fijos de consumo por minuto
export const TOKENS_PER_MIN = 300;
export const CHARS_PER_MIN = 800;

// Todos los valores son USD — retorna USD
export function computeCOGS(costs: ProviderCosts, durationMin: number): number {
  return (
    costs.twilio_outbound_per_min * durationMin +
    costs.stt_per_min * durationMin +
    costs.llm_per_1k_tokens * ((TOKENS_PER_MIN * durationMin) / 1000) +
    costs.tts_per_1k_chars * ((CHARS_PER_MIN * durationMin) / 1000)
  );
}

export function fmtUSD(usd: number): string {
  if (usd === 0) return "$0.00";
  if (Math.abs(usd) < 0.001) return `$${usd.toFixed(5)}`;
  if (Math.abs(usd) < 0.01) return `$${usd.toFixed(4)}`;
  if (Math.abs(usd) < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
