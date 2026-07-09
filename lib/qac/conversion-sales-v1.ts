export interface ConversionCriterionPreset {
  sort_order: number;
  category: string;
  category_es: string;
  name: string;
  name_es: string;
  description: string;
  description_es: string;
  weight: number;
  is_critical?: boolean;
  applicability_rule?: string;
  applicability_rule_es?: string;
  pass_definition: string;
  pass_definition_es: string;
  partial_definition?: string;
  partial_definition_es?: string;
  fail_definition: string;
  fail_definition_es: string;
  na_definition?: string;
  na_definition_es?: string;
  examples?: string[];
}

export interface ConversionTrackerPreset {
  name: string;
  name_es: string;
  description: string;
  description_es: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  risk_level_override?: "low" | "medium" | "high" | "critical";
  trigger_manual_review?: boolean;
  positive_examples: string[];
}

export const CONVERSION_SALES_SCORECARD = {
  name: "Ventas de Conversion",
  legacyName: "Conversion Sales",
  version: 1,
  departmentName: "Conversion",
  departmentSlug: "conversion",
  qaPrompt: `Evaluate this real conversion sales call against Conversion Sales V1.
Score only observable behavior from the transcript. Do not invent evidence.
Compliance criteria are critical: guaranteed profit promises, missing risk disclosure, fraud risk, vulnerable customer risk or unsafe payment guidance must be surfaced even if the overall score is high.
Trackers do not directly change the score. They detect operational signals, risks and opportunities in parallel.`,
  qaPromptEs: `Evalua esta llamada real de ventas de conversion contra Ventas de Conversion V1.
Califica solo comportamientos observables en la transcripcion. No inventes evidencia.
Los criterios de cumplimiento son criticos: promesas de ganancias garantizadas, ausencia de divulgacion de riesgo, riesgo de fraude, cliente vulnerable o instrucciones de pago inseguras deben marcarse aunque el score general sea alto.
Los trackers no cambian directamente el score. Detectan señales operativas, riesgos y oportunidades en paralelo.`,
};

export const CONVERSION_SALES_CRITERIA: ConversionCriterionPreset[] = [
  {
    sort_order: 1,
    category: "Call Opening",
    category_es: "Apertura de llamada",
    name: "Professional Greeting",
    name_es: "Saludo profesional",
    description:
      "The agent greets the customer professionally, introduces themselves and the company.",
    description_es:
      "El agente saluda profesionalmente al cliente, se presenta y presenta la empresa.",
    weight: 5,
    pass_definition: "Professional greeting, introduction and positive tone.",
    pass_definition_es: "Saludo profesional, presentacion y tono positivo.",
    partial_definition: "Greeting present but incomplete.",
    partial_definition_es: "Hay saludo, pero esta incompleto.",
    fail_definition: "No greeting or unprofessional introduction.",
    fail_definition_es: "No hay saludo o la introduccion no es profesional.",
  },
  {
    sort_order: 2,
    category: "Call Opening",
    category_es: "Apertura de llamada",
    name: "Permission to Continue",
    name_es: "Permiso para continuar",
    description: "The agent verifies whether it is a good time to speak.",
    description_es: "El agente verifica si es buen momento para hablar.",
    weight: 5,
    pass_definition: "Agent asks if the customer has time to talk.",
    pass_definition_es:
      "El agente pregunta si el cliente tiene tiempo para hablar.",
    fail_definition: "Starts pitching immediately.",
    fail_definition_es: "Empieza a vender inmediatamente.",
  },
  {
    sort_order: 3,
    category: "Discovery",
    category_es: "Descubrimiento",
    name: "Needs Discovery",
    name_es: "Descubrimiento de necesidades",
    description:
      "The agent asks open-ended questions to understand customer needs.",
    description_es:
      "El agente hace preguntas abiertas para entender las necesidades del cliente.",
    weight: 5,
    pass_definition: "Uses relevant open-ended questions before pitching.",
    pass_definition_es: "Usa preguntas abiertas relevantes antes de vender.",
    partial_definition:
      "Asks some questions, but mostly closed or superficial.",
    partial_definition_es:
      "Hace algunas preguntas, pero son cerradas o superficiales.",
    fail_definition: "Does not ask discovery questions.",
    fail_definition_es: "No hace preguntas de descubrimiento.",
  },
  {
    sort_order: 4,
    category: "Discovery",
    category_es: "Descubrimiento",
    name: "Investment Experience",
    name_es: "Experiencia de inversion",
    description: "The agent asks whether the customer has invested before.",
    description_es: "El agente pregunta si el cliente ha invertido antes.",
    weight: 5,
    pass_definition:
      "Clearly asks about prior investment or trading experience.",
    pass_definition_es:
      "Pregunta claramente por experiencia previa en inversion o trading.",
    fail_definition: "No investment experience question is asked.",
    fail_definition_es: "No pregunta por experiencia de inversion.",
  },
  {
    sort_order: 5,
    category: "Discovery",
    category_es: "Descubrimiento",
    name: "Financial Capacity",
    name_es: "Capacidad financiera",
    description:
      "The agent evaluates the customer's financial capacity appropriately.",
    description_es:
      "El agente evalua de forma adecuada la capacidad financiera del cliente.",
    weight: 5,
    pass_definition:
      "Asks appropriate questions about budget, available capital or financial readiness.",
    pass_definition_es:
      "Pregunta adecuadamente por presupuesto, capital disponible o preparacion financiera.",
    fail_definition: "Does not evaluate financial capacity.",
    fail_definition_es: "No evalua la capacidad financiera.",
  },
  {
    sort_order: 6,
    category: "Discovery",
    category_es: "Descubrimiento",
    name: "Investment Goals",
    name_es: "Objetivos de inversion",
    description: "The agent discovers the customer's investment goals.",
    description_es:
      "El agente descubre los objetivos de inversion del cliente.",
    weight: 5,
    pass_definition: "Identifies goals, motivations or expected outcomes.",
    pass_definition_es:
      "Identifica objetivos, motivaciones o resultados esperados.",
    fail_definition: "Does not ask about customer goals.",
    fail_definition_es: "No pregunta por los objetivos del cliente.",
  },
  {
    sort_order: 7,
    category: "Product Presentation",
    category_es: "Presentacion del producto",
    name: "Product Clarity",
    name_es: "Claridad del producto",
    description: "The agent explains the platform correctly and clearly.",
    description_es:
      "El agente explica la plataforma correctamente y con claridad.",
    weight: 5,
    pass_definition: "Explanation is clear, accurate and understandable.",
    pass_definition_es: "La explicacion es clara, precisa y entendible.",
    fail_definition: "Product explanation is missing, confusing or incorrect.",
    fail_definition_es: "La explicacion falta, es confusa o incorrecta.",
  },
  {
    sort_order: 8,
    category: "Product Presentation",
    category_es: "Presentacion del producto",
    name: "Benefits Explanation",
    name_es: "Explicacion de beneficios",
    description:
      "The agent explains benefits without exaggerating or overpromising.",
    description_es:
      "El agente explica beneficios sin exagerar ni prometer de mas.",
    weight: 5,
    pass_definition: "Benefits are explained realistically and compliantly.",
    pass_definition_es:
      "Los beneficios se explican de forma realista y conforme.",
    fail_definition: "Benefits are exaggerated, vague or misleading.",
    fail_definition_es: "Los beneficios son exagerados, vagos o engañosos.",
  },
  {
    sort_order: 9,
    category: "Product Presentation",
    category_es: "Presentacion del producto",
    name: "Personalization",
    name_es: "Personalizacion",
    description: "The agent connects the offer to discovered customer needs.",
    description_es:
      "El agente relaciona la oferta con las necesidades descubiertas del cliente.",
    weight: 5,
    pass_definition:
      "Presentation references the customer's needs, goals or context.",
    pass_definition_es:
      "La presentacion hace referencia a necesidades, objetivos o contexto del cliente.",
    fail_definition: "Uses a generic pitch with no personalization.",
    fail_definition_es: "Usa un discurso generico sin personalizacion.",
  },
  {
    sort_order: 10,
    category: "Communication Skills",
    category_es: "Habilidades de comunicacion",
    name: "Active Listening",
    name_es: "Escucha activa",
    description: "The agent listens and responds to what the customer says.",
    description_es: "El agente escucha y responde a lo que dice el cliente.",
    weight: 3,
    pass_definition:
      "Acknowledges customer statements and responds appropriately.",
    pass_definition_es:
      "Reconoce lo que dice el cliente y responde de forma adecuada.",
    fail_definition: "Talks over the customer or ignores customer input.",
    fail_definition_es: "Interrumpe o ignora lo que dice el cliente.",
  },
  {
    sort_order: 11,
    category: "Communication Skills",
    category_es: "Habilidades de comunicacion",
    name: "Empathy",
    name_es: "Empatia",
    description: "The agent shows empathy and respect.",
    description_es: "El agente muestra empatia y respeto.",
    weight: 3,
    pass_definition: "Tone is empathetic, respectful and customer-centered.",
    pass_definition_es:
      "El tono es empatico, respetuoso y centrado en el cliente.",
    fail_definition: "Tone is cold, dismissive or disrespectful.",
    fail_definition_es: "El tono es frio, despectivo o irrespetuoso.",
  },
  {
    sort_order: 12,
    category: "Communication Skills",
    category_es: "Habilidades de comunicacion",
    name: "Confidence",
    name_es: "Confianza",
    description: "The agent communicates with confidence and control.",
    description_es: "El agente comunica con confianza y control.",
    weight: 3,
    pass_definition: "Sounds confident, prepared and credible.",
    pass_definition_es: "Suena seguro, preparado y creible.",
    fail_definition: "Sounds uncertain, confused or unprepared.",
    fail_definition_es: "Suena inseguro, confundido o poco preparado.",
  },
  {
    sort_order: 13,
    category: "Communication Skills",
    category_es: "Habilidades de comunicacion",
    name: "Professional Language",
    name_es: "Lenguaje profesional",
    description: "The agent uses professional language throughout the call.",
    description_es: "El agente usa lenguaje profesional durante la llamada.",
    weight: 3,
    pass_definition: "Uses clear, professional and appropriate language.",
    pass_definition_es: "Usa lenguaje claro, profesional y apropiado.",
    fail_definition:
      "Uses slang, pressure, insults or unprofessional language.",
    fail_definition_es:
      "Usa jerga, presion, insultos o lenguaje no profesional.",
  },
  {
    sort_order: 14,
    category: "Communication Skills",
    category_es: "Habilidades de comunicacion",
    name: "Conversation Flow",
    name_es: "Flujo de conversacion",
    description: "The conversation is structured and easy to follow.",
    description_es: "La conversacion es estructurada y facil de seguir.",
    weight: 3,
    pass_definition:
      "Moves naturally from opening to discovery, presentation and next step.",
    pass_definition_es:
      "Avanza naturalmente de apertura a descubrimiento, presentacion y siguiente paso.",
    fail_definition: "Conversation is disorganized or hard to follow.",
    fail_definition_es: "La conversacion es desorganizada o dificil de seguir.",
  },
  {
    sort_order: 15,
    category: "Objection Handling",
    category_es: "Manejo de objeciones",
    name: "Objection Identification",
    name_es: "Identificacion de objeciones",
    description: "The agent correctly detects the customer's objection.",
    description_es: "El agente detecta correctamente la objecion del cliente.",
    weight: 5,
    pass_definition: "Identifies the real objection before responding.",
    pass_definition_es: "Identifica la objecion real antes de responder.",
    fail_definition: "Misses or misreads the objection.",
    fail_definition_es: "No detecta o interpreta mal la objecion.",
  },
  {
    sort_order: 16,
    category: "Objection Handling",
    category_es: "Manejo de objeciones",
    name: "Objection Resolution",
    name_es: "Resolucion de objeciones",
    description: "The agent responds to the objection correctly.",
    description_es: "El agente responde correctamente a la objecion.",
    weight: 5,
    pass_definition: "Provides a relevant, respectful and convincing response.",
    pass_definition_es: "Da una respuesta relevante, respetuosa y convincente.",
    fail_definition: "Avoids, pressures or answers incorrectly.",
    fail_definition_es: "Evade, presiona o responde incorrectamente.",
  },
  {
    sort_order: 17,
    category: "Objection Handling",
    category_es: "Manejo de objeciones",
    name: "Confidence Recovery",
    name_es: "Recuperacion de interes",
    description: "The agent recovers customer interest after an objection.",
    description_es:
      "El agente recupera el interes del cliente despues de una objecion.",
    weight: 5,
    pass_definition:
      "Reframes value and keeps the conversation moving constructively.",
    pass_definition_es:
      "Reformula valor y mantiene la conversacion avanzando constructivamente.",
    fail_definition: "Customer interest is not recovered.",
    fail_definition_es: "No recupera el interes del cliente.",
  },
  {
    sort_order: 18,
    category: "Closing",
    category_es: "Cierre",
    name: "Clear Next Step",
    name_es: "Siguiente paso claro",
    description: "The agent establishes a clear next step.",
    description_es: "El agente establece un siguiente paso claro.",
    weight: 4,
    pass_definition: "Next step includes what will happen and when.",
    pass_definition_es: "El siguiente paso incluye que ocurrira y cuando.",
    fail_definition: "No clear next step is established.",
    fail_definition_es: "No se establece un siguiente paso claro.",
  },
  {
    sort_order: 19,
    category: "Closing",
    category_es: "Cierre",
    name: "Call to Action",
    name_es: "Llamado a la accion",
    description: "The agent asks for an appropriate action from the customer.",
    description_es: "El agente pide una accion apropiada al cliente.",
    weight: 3,
    pass_definition: "CTA is clear, relevant and aligned with call context.",
    pass_definition_es: "El CTA es claro, relevante y alineado al contexto.",
    fail_definition: "No CTA or inappropriate CTA.",
    fail_definition_es: "No hay CTA o es inapropiado.",
  },
  {
    sort_order: 20,
    category: "Closing",
    category_es: "Cierre",
    name: "Professional Closing",
    name_es: "Cierre profesional",
    description: "The agent closes the call professionally.",
    description_es: "El agente cierra la llamada profesionalmente.",
    weight: 3,
    pass_definition: "Thanks the customer and closes respectfully.",
    pass_definition_es: "Agradece al cliente y cierra con respeto.",
    fail_definition: "Abrupt, rude or missing closing.",
    fail_definition_es: "Cierre abrupto, grosero o ausente.",
  },
  {
    sort_order: 21,
    category: "Compliance",
    category_es: "Cumplimiento",
    name: "Risk Disclosure",
    name_es: "Divulgacion de riesgo",
    description:
      "The agent avoids promising gains and discloses risk when relevant.",
    description_es:
      "El agente evita prometer ganancias y divulga riesgos cuando corresponde.",
    weight: 5,
    is_critical: true,
    pass_definition: "Risk is disclosed or no risk-related claim is made.",
    pass_definition_es:
      "Se divulga el riesgo o no se hace afirmacion de riesgo.",
    fail_definition: "Agent promises gains or hides material risk.",
    fail_definition_es:
      "El agente promete ganancias u oculta riesgos materiales.",
  },
  {
    sort_order: 22,
    category: "Compliance",
    category_es: "Cumplimiento",
    name: "No Guaranteed Profits",
    name_es: "Sin beneficios garantizados",
    description: "The agent never promises guaranteed profits.",
    description_es: "El agente nunca promete beneficios garantizados.",
    weight: 5,
    is_critical: true,
    pass_definition: "No guaranteed profit claim is made.",
    pass_definition_es: "No se afirma que haya ganancias garantizadas.",
    fail_definition:
      "Any guaranteed profit or risk-free return promise is made.",
    fail_definition_es:
      "Se promete cualquier ganancia garantizada o retorno sin riesgo.",
  },
  {
    sort_order: 23,
    category: "Compliance",
    category_es: "Cumplimiento",
    name: "Identity Verification",
    name_es: "Verificacion de identidad",
    description:
      "The agent performs KYC or identity verification when appropriate.",
    description_es:
      "El agente realiza KYC o verificacion de identidad cuando corresponde.",
    weight: 5,
    is_critical: true,
    applicability_rule:
      "Applicable when account setup, deposit, payment or regulated action is discussed.",
    applicability_rule_es:
      "Aplica cuando se habla de apertura de cuenta, deposito, pago o accion regulada.",
    pass_definition:
      "Appropriate identity verification or KYC step is completed or explained.",
    pass_definition_es:
      "Se completa o explica el paso adecuado de verificacion de identidad o KYC.",
    fail_definition: "Required KYC is skipped or discouraged.",
    fail_definition_es: "Se omite o desalienta el KYC requerido.",
    na_definition: "No account, payment or regulated action is discussed.",
    na_definition_es: "No se habla de cuenta, pago o accion regulada.",
  },
  {
    sort_order: 24,
    category: "Call Quality",
    category_es: "Calidad de llamada",
    name: "Call Outcome Classification",
    name_es: "Clasificacion del resultado",
    description: "The AI correctly identifies how the call ended.",
    description_es: "La IA identifica correctamente como termino la llamada.",
    weight: 5,
    pass_definition:
      "Outcome is correctly classified as Interested, Callback, No Answer, Not Interested, Wrong Number, Deposit Completed or another accurate status.",
    pass_definition_es:
      "El resultado se clasifica correctamente como Interesado, Devolver llamada, No contesta, No interesado, Numero equivocado, Deposito completado u otro estado preciso.",
    fail_definition: "Call outcome is missing or incorrectly classified.",
    fail_definition_es:
      "El resultado falta o esta clasificado incorrectamente.",
    examples: [
      "Interested",
      "Callback",
      "No Answer",
      "Not Interested",
      "Wrong Number",
      "Deposit Completed",
    ],
  },
  {
    sort_order: 25,
    category: "Call Quality",
    category_es: "Calidad de llamada",
    name: "CRM Follow-up",
    name_es: "Seguimiento CRM",
    description: "The agent clearly leaves or confirms the follow-up step.",
    description_es: "El agente deja o confirma claramente el siguiente paso.",
    weight: 5,
    pass_definition: "Follow-up action is clear enough to be recorded in CRM.",
    pass_definition_es:
      "La accion de seguimiento es suficientemente clara para registrarse en CRM.",
    fail_definition: "No clear CRM follow-up is established.",
    fail_definition_es: "No se establece un seguimiento claro para CRM.",
  },
];

export const CONVERSION_TRACKERS: ConversionTrackerPreset[] = [
  {
    name: "Price objection detected",
    name_es: "Objecion de precio detectada",
    description: "Customer objects to price, cost, fees or affordability.",
    description_es:
      "El cliente objeta precio, costo, comisiones o asequibilidad.",
    severity: "medium",
    positive_examples: ["It's too expensive.", "Eso es muy caro."],
  },
  {
    name: "Risk objection",
    name_es: "Objecion por riesgo",
    description:
      "Customer expresses concern about risk, losing money or safety.",
    description_es:
      "El cliente expresa preocupacion por riesgo, perder dinero o seguridad.",
    severity: "high",
    positive_examples: ["I don't want to lose money.", "Me da miedo perder."],
  },
  {
    name: "No money objection",
    name_es: "Objecion sin dinero",
    description: "Customer says they do not have money or liquidity now.",
    description_es: "El cliente dice que no tiene dinero o liquidez ahora.",
    severity: "medium",
    positive_examples: [
      "I don't have money right now.",
      "Ahora no tengo dinero.",
    ],
  },
  {
    name: "Need spouse approval",
    name_es: "Necesita aprobacion de pareja",
    description: "Customer needs spouse, partner or family approval.",
    description_es:
      "El cliente necesita aprobacion de pareja, socio o familia.",
    severity: "info",
    positive_examples: [
      "I need to ask my wife.",
      "Tengo que consultarlo con mi esposo.",
    ],
  },
  {
    name: "Already investing",
    name_es: "Ya invierte",
    description: "Customer states they already invest or trade elsewhere.",
    description_es: "El cliente indica que ya invierte u opera en otro lugar.",
    severity: "info",
    positive_examples: ["I already trade.", "Ya estoy invirtiendo."],
  },
  {
    name: "Competitor mentioned",
    name_es: "Competidor mencionado",
    description:
      "A competitor, broker, platform or alternative provider is mentioned.",
    description_es:
      "Se menciona un competidor, broker, plataforma o proveedor alternativo.",
    severity: "info",
    positive_examples: [
      "I use another broker.",
      "Trabajo con otra plataforma.",
    ],
  },
  {
    name: "Deposit mentioned",
    name_es: "Deposito mencionado",
    description: "Deposit, initial funding or account funding is discussed.",
    description_es: "Se habla de deposito, fondeo inicial o fondeo de cuenta.",
    severity: "info",
    positive_examples: [
      "How much is the deposit?",
      "Cuanto tengo que depositar?",
    ],
  },
  {
    name: "Credit card mentioned",
    name_es: "Tarjeta de credito mencionada",
    description: "Credit card payment is mentioned.",
    description_es: "Se menciona pago con tarjeta de credito.",
    severity: "medium",
    positive_examples: [
      "Can I use my credit card?",
      "Puedo pagar con tarjeta?",
    ],
  },
  {
    name: "Wire transfer mentioned",
    name_es: "Transferencia bancaria mencionada",
    description: "Wire transfer or bank transfer is mentioned.",
    description_es: "Se menciona transferencia bancaria.",
    severity: "info",
    positive_examples: ["I'll send a wire.", "Lo hago por transferencia."],
  },
  {
    name: "Crypto mentioned",
    name_es: "Cripto mencionada",
    description: "Crypto, bitcoin, USDT or crypto payment is mentioned.",
    description_es: "Se menciona cripto, bitcoin, USDT o pago cripto.",
    severity: "medium",
    positive_examples: ["Can I pay with USDT?", "Tengo bitcoin."],
  },
  {
    name: "WhatsApp requested",
    name_es: "WhatsApp solicitado",
    description: "Customer asks to continue by WhatsApp.",
    description_es: "El cliente pide continuar por WhatsApp.",
    severity: "info",
    positive_examples: ["Send it to WhatsApp.", "Escribeme por WhatsApp."],
  },
  {
    name: "Email requested",
    name_es: "Email solicitado",
    description: "Customer asks for information by email.",
    description_es: "El cliente pide informacion por email.",
    severity: "info",
    positive_examples: ["Email me the details.", "Mandamelo por correo."],
  },
  {
    name: "Callback requested",
    name_es: "Devolver llamada solicitado",
    description: "Customer asks to be called later.",
    description_es: "El cliente pide que le llamen luego.",
    severity: "info",
    positive_examples: ["Call me tomorrow.", "Llamame mas tarde."],
  },
  {
    name: "Language mismatch",
    name_es: "Idioma incorrecto",
    description: "The customer and agent are not aligned on language.",
    description_es: "Cliente y agente no estan alineados en el idioma.",
    severity: "medium",
    positive_examples: ["I don't speak Spanish.", "No entiendo ingles."],
  },
  {
    name: "Upset customer",
    name_es: "Cliente molesto",
    description: "Customer is upset, angry, frustrated or complains strongly.",
    description_es:
      "El cliente esta molesto, enojado, frustrado o reclama fuerte.",
    severity: "high",
    trigger_manual_review: true,
    risk_level_override: "high",
    positive_examples: ["Stop calling me.", "Estoy cansado de ustedes."],
  },
  {
    name: "Positive sentiment",
    name_es: "Sentimiento positivo",
    description: "Customer expresses positive interest or satisfaction.",
    description_es: "El cliente expresa interes positivo o satisfaccion.",
    severity: "info",
    positive_examples: ["Sounds good.", "Me interesa."],
  },
  {
    name: "Negative sentiment",
    name_es: "Sentimiento negativo",
    description: "Customer expresses negative sentiment or rejection.",
    description_es: "El cliente expresa sentimiento negativo o rechazo.",
    severity: "medium",
    positive_examples: ["I don't like this.", "No me interesa."],
  },
  {
    name: "Supervisor requested",
    name_es: "Supervisor solicitado",
    description: "Customer asks for a supervisor or manager.",
    description_es: "El cliente pide hablar con supervisor o gerente.",
    severity: "high",
    trigger_manual_review: true,
    risk_level_override: "high",
    positive_examples: [
      "Let me speak to your supervisor.",
      "Pasame con un supervisor.",
    ],
  },
  {
    name: "Escalation needed",
    name_es: "Escalamiento requerido",
    description:
      "The call should be escalated due to risk, complaint or complexity.",
    description_es:
      "La llamada debe escalarse por riesgo, queja o complejidad.",
    severity: "high",
    trigger_manual_review: true,
    risk_level_override: "high",
    positive_examples: [
      "This is a formal complaint.",
      "Necesito resolver esto ya.",
    ],
  },
  {
    name: "Payment completed",
    name_es: "Pago completado",
    description: "Customer confirms payment, deposit or funding completed.",
    description_es: "El cliente confirma pago, deposito o fondeo completado.",
    severity: "info",
    positive_examples: ["I already paid.", "Ya hice el deposito."],
  },
  {
    name: "Compliance violation",
    name_es: "Violacion de cumplimiento",
    description:
      "Potential regulatory, risk disclosure or sales compliance violation.",
    description_es:
      "Posible violacion regulatoria, de divulgacion de riesgo o de cumplimiento comercial.",
    severity: "critical",
    trigger_manual_review: true,
    risk_level_override: "high",
    positive_examples: ["Guaranteed profit.", "No puedes perder."],
  },
  {
    name: "Potential fraud",
    name_es: "Posible fraude",
    description:
      "Signals of fraud, impersonation, suspicious payment or identity concern.",
    description_es:
      "Señales de fraude, suplantacion, pago sospechoso o problema de identidad.",
    severity: "critical",
    trigger_manual_review: true,
    risk_level_override: "critical",
    positive_examples: [
      "Use someone else's card.",
      "La cuenta no esta a mi nombre.",
    ],
  },
  {
    name: "Potential vulnerable customer",
    name_es: "Cliente vulnerable potencial",
    description:
      "Customer may be vulnerable due to age, distress, confusion or pressure.",
    description_es:
      "El cliente podria ser vulnerable por edad, angustia, confusion o presion.",
    severity: "critical",
    trigger_manual_review: true,
    risk_level_override: "critical",
    positive_examples: [
      "I don't understand but I'll do it.",
      "Estoy desesperado.",
    ],
  },
];

export function criterionExamplesJson(criterion: ConversionCriterionPreset) {
  return {
    examples: criterion.examples ?? [],
    i18n: {
      es: {
        category: criterion.category_es,
        name: criterion.name_es,
        description: criterion.description_es,
        applicability_rule: criterion.applicability_rule_es,
        pass_definition: criterion.pass_definition_es,
        partial_definition: criterion.partial_definition_es,
        fail_definition: criterion.fail_definition_es,
        na_definition: criterion.na_definition_es,
      },
    },
  };
}
