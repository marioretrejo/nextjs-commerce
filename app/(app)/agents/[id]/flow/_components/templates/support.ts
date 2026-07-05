import { defaultEdgeOptions, type FlowTemplate } from "../flow-config";

export const supportTemplate: FlowTemplate = {
  label: "Soporte Inbound",
  description: "Clasificación → Soporte técnico / Facturación / Humano",
  nodes: [
    {
      id: "start",
      type: "start_node",
      position: { x: 40, y: 220 },
      data: { label: "Start" },
      deletable: false,
    },
    {
      id: "welcome",
      type: "ai_state",
      position: { x: 200, y: 180 },
      data: {
        label: "AI State",
        state_name: "Bienvenida",
        system_instructions:
          "Saluda al contacto, identifícate como asistente de soporte y pregunta en qué puedes ayudar hoy.",
      },
    },
    {
      id: "classify",
      type: "semantic_router",
      position: { x: 440, y: 160 },
      data: {
        label: "Router",
        description: "Tipo de solicitud de soporte",
        intents: [
          {
            id: "i-tech",
            label: "Soporte técnico",
            description: "El usuario tiene un problema técnico con el producto",
          },
          {
            id: "i-billing",
            label: "Facturación",
            description:
              "El usuario tiene dudas sobre cobros, facturas o pagos",
          },
          {
            id: "i-human",
            label: "Quiere humano",
            description: "El usuario pide hablar con una persona",
          },
        ],
      },
    },
    {
      id: "tech",
      type: "ai_state",
      position: { x: 680, y: 60 },
      data: {
        label: "AI State",
        state_name: "Soporte Técnico",
        system_instructions:
          "Ayuda al usuario a resolver su problema técnico. Haz preguntas diagnósticas, ofrece pasos de solución. Si no puedes resolver en 3 intentos, ofrece transferir con un agente.",
      },
    },
    {
      id: "billing",
      type: "ai_state",
      position: { x: 680, y: 220 },
      data: {
        label: "AI State",
        state_name: "Facturación",
        system_instructions:
          "Atiende la consulta de facturación. Responde preguntas sobre cobros, fechas de pago y facturas. Si necesita un ajuste o reembolso, toma los datos y escala.",
      },
    },
    {
      id: "transfer",
      type: "transfer_node",
      position: { x: 680, y: 380 },
      data: { label: "Transfer", transfer_number: "+1800XXXXXXX" },
    },
    {
      id: "end-tech",
      type: "end_call_node",
      position: { x: 920, y: 60 },
      data: {
        label: "End Call",
        farewell:
          "¿Hay algo más en lo que pueda ayudarle? Que tenga un excelente día.",
      },
    },
    {
      id: "end-billing",
      type: "end_call_node",
      position: { x: 920, y: 220 },
      data: {
        label: "End Call",
        farewell: "Listo, ya tomamos nota. ¿Puedo ayudarle con algo más?",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "welcome",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e2",
      source: "welcome",
      target: "classify",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e3",
      source: "classify",
      target: "tech",
      sourceHandle: "i-tech",
      label: "Técnico",
      ...defaultEdgeOptions,
    },
    {
      id: "e4",
      source: "classify",
      target: "billing",
      sourceHandle: "i-billing",
      label: "Facturación",
      ...defaultEdgeOptions,
    },
    {
      id: "e5",
      source: "classify",
      target: "transfer",
      sourceHandle: "i-human",
      label: "Quiere humano",
      ...defaultEdgeOptions,
    },
    {
      id: "e6",
      source: "tech",
      target: "end-tech",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e7",
      source: "billing",
      target: "end-billing",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
  ],
};
