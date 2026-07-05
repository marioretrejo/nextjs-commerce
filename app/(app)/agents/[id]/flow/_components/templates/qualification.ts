import { defaultEdgeOptions, type FlowTemplate } from "../flow-config";

export const qualificationTemplate: FlowTemplate = {
  label: "Calificación de Lead",
  description: "BANT → Webhook CRM → FIN",
  nodes: [
    {
      id: "start",
      type: "start_node",
      position: { x: 40, y: 180 },
      data: { label: "Start" },
      deletable: false,
    },
    {
      id: "greeting",
      type: "ai_state",
      position: { x: 200, y: 140 },
      data: {
        label: "AI State",
        state_name: "Saludo y Contexto",
        system_instructions:
          "Saluda al contacto {{contact_name}}, confírmale que llamamos porque mostró interés y explica que harás unas preguntas rápidas para ver cómo podemos ayudar.",
      },
    },
    {
      id: "qualify",
      type: "ai_state",
      position: { x: 440, y: 140 },
      data: {
        label: "AI State",
        state_name: "Calificación BANT",
        system_instructions:
          "Haz las siguientes preguntas de calificación:\n1. ¿Cuál es su presupuesto aproximado?\n2. ¿Tiene autoridad para tomar esta decisión?\n3. ¿Qué necesita resolver?\n4. ¿Cuál es su plazo?\n\nToma nota de las respuestas.",
      },
    },
    {
      id: "route1",
      type: "semantic_router",
      position: { x: 680, y: 120 },
      data: {
        label: "Router",
        description: "Resultado de calificación",
        intents: [
          {
            id: "i-qual",
            label: "Calificado",
            description: "Tiene presupuesto, autoridad, necesidad y urgencia",
          },
          {
            id: "i-notqual",
            label: "No calificado",
            description: "No cumple criterios BANT",
          },
        ],
      },
    },
    {
      id: "crm",
      type: "webhook_node",
      position: { x: 920, y: 60 },
      data: {
        label: "Webhook",
        url: "https://your-crm.com/api/leads",
        method: "POST",
        extract_variables: "lead_id,next_steps",
      },
    },
    {
      id: "end-qual",
      type: "end_call_node",
      position: { x: 1140, y: 60 },
      data: {
        label: "End Call",
        farewell:
          "Perfecto, un asesor se pondrá en contacto con usted en las próximas 24 horas. ¡Gracias!",
      },
    },
    {
      id: "end-notqual",
      type: "end_call_node",
      position: { x: 940, y: 260 },
      data: {
        label: "End Call",
        farewell:
          "Gracias por su tiempo. Si en el futuro necesita nuestros servicios, no dude en contactarnos. ¡Hasta luego!",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "greeting",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e2",
      source: "greeting",
      target: "qualify",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e3",
      source: "qualify",
      target: "route1",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e4",
      source: "route1",
      target: "crm",
      sourceHandle: "i-qual",
      label: "Calificado",
      ...defaultEdgeOptions,
    },
    {
      id: "e5",
      source: "route1",
      target: "end-notqual",
      sourceHandle: "i-notqual",
      label: "No calificado",
      ...defaultEdgeOptions,
    },
    {
      id: "e6",
      source: "crm",
      target: "end-qual",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
  ],
};
