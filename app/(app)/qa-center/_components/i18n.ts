export type QacLang = "en" | "es";

export function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function qacLanguageOf(
  params: Record<string, string | string[] | undefined>,
): QacLang {
  return firstParam(params, "lang") === "es" ? "es" : "en";
}

export function qacT(lang: QacLang, en: string, es: string): string {
  return lang === "es" ? es : en;
}

export function qacHref(href: string, lang: QacLang): string {
  if (lang !== "es") return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}lang=es`;
}

const FIELD_TRANSLATIONS: Record<string, string> = {
  "active listening": "escucha activa",
  "already investing": "ya invierte",
  "benefits explanation": "explicacion de beneficios",
  "call flow": "flujo de llamada",
  "call opening": "apertura de llamada",
  "call outcome classification": "clasificacion del resultado de llamada",
  "call quality": "calidad de llamada",
  "call to action": "llamado a la accion",
  callback: "devolver llamada",
  "callback requested": "devolucion de llamada solicitada",
  "clear next step": "siguiente paso claro",
  closing: "cierre",
  communication: "comunicacion",
  "communication skills": "habilidades de comunicacion",
  "competitor mentioned": "competidor mencionado",
  compliance: "cumplimiento",
  "compliance violation": "violacion de cumplimiento",
  confidence: "confianza",
  "confidence recovery": "recuperacion de confianza",
  "conversation flow": "flujo de conversacion",
  "credit card mentioned": "tarjeta de credito mencionada",
  criterion: "criterio",
  "crm follow-up": "seguimiento en CRM",
  crypto: "cripto",
  "crypto mentioned": "cripto mencionada",
  discovery: "descubrimiento",
  "email requested": "email solicitado",
  empathy: "empatia",
  "financial capacity": "capacidad financiera",
  "identity verification": "verificacion de identidad",
  interested: "interesado",
  "investment experience": "experiencia de inversion",
  "investment goals": "objetivos de inversion",
  "language mismatch": "idioma incorrecto",
  "needs discovery": "descubrimiento de necesidades",
  "need spouse approval": "necesita aprobacion de pareja",
  "negative sentiment": "sentimiento negativo",
  "no answer": "no contesta",
  "no guaranteed profits": "sin ganancias garantizadas",
  "no money objection": "objecion por falta de dinero",
  "no disposition": "sin disposicion",
  "not interested": "no interesado",
  "objection handling": "manejo de objeciones",
  "objection identification": "identificacion de objecion",
  "objection resolution": "resolucion de objecion",
  "payment completed": "pago completado",
  personalization: "personalizacion",
  "permission to continue": "permiso para continuar",
  "personal relationship": "relacion personal",
  "positive sentiment": "sentimiento positivo",
  "price objection": "objecion de precio",
  "price objection detected": "objecion de precio detectada",
  "product clarity": "claridad del producto",
  "product presentation": "presentacion del producto",
  "professional closing": "cierre profesional",
  "professional greeting": "saludo profesional",
  "professional language": "lenguaje profesional",
  "potential fraud": "posible fraude",
  "potential vulnerable customer": "posible cliente vulnerable",
  "risk disclosure": "divulgacion de riesgo",
  "risk objection": "objecion de riesgo",
  "supervisor requested": "supervisor solicitado",
  "upset customer": "cliente molesto",
  uncategorized: "sin categoria",
  "whatsapp requested": "WhatsApp solicitado",
  "wire transfer mentioned": "transferencia mencionada",
  "wrong number": "numero equivocado",
};

const STATUS_TRANSLATIONS: Record<string, string> = {
  active: "activo",
  analyzed: "analizada",
  analyzing: "analizando",
  approved: "aprobada",
  auto_analyze: "analisis automatico",
  audio_ready: "audio listo",
  critical: "critico",
  disputed: "en disputa",
  fail: "fallo",
  failed_analysis: "fallo de analisis",
  failed_audio: "audio pendiente de reintento",
  failed_transcription: "fallo de transcripcion",
  high: "alto",
  in_review: "en revision",
  inactive: "inactivo",
  info: "info",
  low: "bajo",
  manual_analysis: "analisis manual",
  manual_review: "revision manual",
  manual_review_required: "revision manual requerida",
  medium: "medio",
  not_evaluable: "no evaluable",
  partial: "parcial",
  pass: "aprobado",
  pending_audio: "audio pendiente",
  pending_cdr: "CDR pendiente",
  pending_review: "revision pendiente",
  reviewed: "revisada",
  transcribed: "transcrita",
  transcribing: "transcribiendo",
  unknown: "desconocido",
};

const TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /\bThe call appears to be a conversion sales call where the agent\b/gi,
    "La llamada parece ser una llamada de ventas de conversion donde el agente",
  ],
  [
    /\bThe call appears to be a voicemail greeting in Spanish, with no actual conversation or customer interaction\./gi,
    "La llamada parece ser un mensaje de buzon de voz en espanol, sin conversacion real ni interaccion con cliente.",
  ],
  [
    /\bThe call appears to be a voicemail greeting in Spanish\b/gi,
    "La llamada parece ser un mensaje de buzon de voz en espanol",
  ],
  [
    /\bwith no actual conversation or customer interaction\b/gi,
    "sin conversacion real ni interaccion con cliente",
  ],
  [
    /\bNo actual customer interaction\b/gi,
    "No hay interaccion real con cliente",
  ],
  [/\breconnects with a client\b/gi, "retoma contacto con un cliente"],
  [
    /\bwho had previously been in contact with another advisor\b/gi,
    "que previamente habia estado en contacto con otro asesor",
  ],
  [
    /\bThe client expresses frustration with not being able to get in touch with anyone and shares personal issues\b/gi,
    "El cliente expresa frustracion por no poder comunicarse con nadie y comparte situaciones personales",
  ],
  [
    /\bincluding financial difficulties and a complicated situation\b/gi,
    "incluyendo dificultades financieras y una situacion complicada",
  ],
  [
    /\bThe conversation takes a personal turn\b/gi,
    "La conversacion toma un tono personal",
  ],
  [
    /\bdiscussing potential plans to meet\b/gi,
    "hablando de posibles planes para reunirse",
  ],
  [
    /\bThe customer objects to price, cost, fees or affordability\b/gi,
    "El cliente presenta una objecion sobre precio, costo, comisiones o capacidad de pago",
  ],
  [
    /\bCustomer expresses concern about risk, losing money or safety\b/gi,
    "El cliente expresa preocupacion por riesgo, perdida de dinero o seguridad",
  ],
  [
    /\bCustomer says they do not have money or liquidity now\b/gi,
    "El cliente dice que no tiene dinero o liquidez en este momento",
  ],
  [
    /\bCustomer needs spouse, partner or family approval\b/gi,
    "El cliente necesita aprobacion de pareja, socio o familia",
  ],
  [
    /\bCustomer mentions prior or current investing experience\b/gi,
    "El cliente menciona experiencia de inversion previa o actual",
  ],
  [
    /\bCustomer expresses negative sentiment or rejection\b/gi,
    "El cliente expresa sentimiento negativo o rechazo",
  ],
  [
    /\bCustomer expresses positive sentiment or buying intent\b/gi,
    "El cliente expresa sentimiento positivo o intencion de compra",
  ],
  [
    /\bProvide more language options for customers\b/gi,
    "Ofrecer mas opciones de idioma a los clientes",
  ],
  [
    /\bEnsure that voicemail greetings are clear and concise\b/gi,
    "Asegurar que los mensajes de buzon de voz sean claros y concisos",
  ],
  [
    /\bVerify that the voicemail greeting is accurate and up-to-date\b/gi,
    "Verificar que el mensaje de buzon de voz sea correcto y este actualizado",
  ],
  [/\bvoicemail greeting\b/gi, "mensaje de buzon de voz"],
  [/\bconversion sales call\b/gi, "llamada de ventas de conversion"],
  [/\bactual conversation\b/gi, "conversacion real"],
  [/\bcustomer interaction\b/gi, "interaccion con cliente"],
  [/\bfinancial difficulties\b/gi, "dificultades financieras"],
  [/\bcomplicated situation\b/gi, "situacion complicada"],
  [/\bpersonal issues\b/gi, "situaciones personales"],
  [/\bpersonal turn\b/gi, "tono personal"],
  [/\bpreviously\b/gi, "previamente"],
  [/\badvisor\b/gi, "asesor"],
  [/\bagent\b/gi, "agente"],
  [/\bcustomer\b/gi, "cliente"],
  [/\bclient\b/gi, "cliente"],
  [/\bcall\b/gi, "llamada"],
  [/\bconversation\b/gi, "conversacion"],
  [/\bappears to be\b/gi, "parece ser"],
  [/\bexpresses\b/gi, "expresa"],
  [/\bfrustration\b/gi, "frustracion"],
  [/\bdetected\b/gi, "detectado"],
  [/\bnot detected\b/gi, "no detectado"],
  [/\bno actual\b/gi, "sin"],
  [/\bnot interested\b/gi, "no interesado"],
  [/\binterested\b/gi, "interesado"],
  [/\bneutral\b/gi, "neutral"],
  [/\bpositive\b/gi, "positivo"],
  [/\bnegative\b/gi, "negativo"],
];

function normalizeKey(value: string): string {
  return value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
}

function applyExactTranslation(value: string): string | null {
  return FIELD_TRANSLATIONS[normalizeKey(value)] ?? null;
}

function translateSeparatedValue(value: string): string | null {
  if (!/[\/|,]/.test(value)) return applyExactTranslation(value);
  const separator = value.includes("/") ? "/" : value.includes("|") ? "|" : ",";
  let translatedAny = false;
  const translated = value
    .split(separator)
    .map((part) => {
      const translatedPart = applyExactTranslation(part);
      translatedAny ||= Boolean(translatedPart);
      return translatedPart ?? part.trim();
    })
    .filter(Boolean);
  return translatedAny && translated.length > 0
    ? translated.join(` ${separator} `)
    : null;
}

function maybeCapitalize(value: string): string {
  const first = value.at(0);
  return first ? `${first.toUpperCase()}${value.slice(1)}` : value;
}

export function qacAnalysisText(
  lang: QacLang,
  value: string | null | undefined,
): string {
  if (!value) return "-";
  if (lang !== "es") return value;

  const exact = translateSeparatedValue(value);
  if (exact) return maybeCapitalize(exact);

  let translated = value;
  for (const [pattern, replacement] of TEXT_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
}

export function qacOutcomeLabel(
  lang: QacLang,
  value: string | null | undefined,
): string {
  if (!value) return "-";
  return qacAnalysisText(lang, value);
}

export function qacRiskLabel(
  lang: QacLang,
  value: string | null | undefined,
): string {
  if (!value) return "-";
  const key = normalizeKey(value);
  if (lang !== "es") return `${key} risk`;
  return (
    {
      low: "riesgo bajo",
      medium: "riesgo medio",
      high: "riesgo alto",
      critical: "riesgo critico",
    }[key] ?? `riesgo ${key}`
  );
}

export function qacStatusLabel(
  lang: QacLang,
  value: string | null | undefined,
): string {
  const key = normalizeKey(value ?? "unknown").replace(/\s+/g, "_");
  if (lang === "es") {
    return STATUS_TRANSLATIONS[key] ?? normalizeKey(value ?? "desconocido");
  }
  return (value ?? "unknown").replace(/_/g, " ");
}

export function qacSentimentLabel(
  lang: QacLang,
  value: string | null | undefined,
): string {
  if (!value) return "-";
  const raw = value.toLowerCase();
  if (
    raw.includes("molesto") ||
    raw.includes("angry") ||
    raw.includes("upset")
  ) {
    return `\u{1F620} ${qacT(lang, "Upset", "Molesto")}`;
  }
  if (
    raw.includes("negativo") ||
    raw.includes("negative") ||
    raw.includes("triste")
  ) {
    return `\u{1F61F} ${qacT(lang, "Negative", "Negativo")}`;
  }
  if (raw.includes("feliz") || raw.includes("happy")) {
    return `\u{1F604} ${qacT(lang, "Happy", "Feliz")}`;
  }
  if (
    raw.includes("contento") ||
    raw.includes("positive") ||
    raw.includes("positivo")
  ) {
    return `\u{1F60A} ${qacT(lang, "Positive", "Contento")}`;
  }
  if (raw.includes("neutral")) {
    return "\u{1F610} Neutral";
  }
  return `\u{1F642} ${qacAnalysisText(lang, value)}`;
}
