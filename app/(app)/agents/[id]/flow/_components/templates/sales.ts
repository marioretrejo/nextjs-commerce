import { defaultEdgeOptions, type FlowTemplate } from "../flow-config";

export const salesTemplate: FlowTemplate = {
  label: "Ventas Outbound",
  description: "Presentación → Calificación → Cierre o FIN",
  nodes: [
    {
      id: "start",
      type: "start_node",
      position: { x: 40, y: 200 },
      data: { label: "Start" },
      deletable: false,
    },
    {
      id: "intro",
      type: "ai_state",
      position: { x: 200, y: 160 },
      data: {
        label: "AI State",
        state_name: "Presentación",
        system_instructions:
          "Saluda al contacto, preséntate como {{agent_name}} de {{workspace_name}} y explica brevemente el motivo de la llamada. Sé amable y conciso.",
      },
    },
    {
      id: "route1",
      type: "semantic_router",
      position: { x: 480, y: 140 },
      data: {
        label: "Router",
        description: "¿Qué quiere hacer el contacto?",
        intents: [
          {
            id: "i-interested",
            label: "Interesado",
            description: "El contacto muestra interés o quiere más información",
          },
          {
            id: "i-not-interested",
            label: "No interesado",
            description: "El contacto rechaza la oferta o no quiere continuar",
          },
          {
            id: "i-callback",
            label: "Callback",
            description: "El contacto pide que lo llamen después",
          },
        ],
      },
    },
    {
      id: "qualified",
      type: "ai_state",
      position: { x: 760, y: 60 },
      data: {
        label: "AI State",
        state_name: "Cierre",
        system_instructions:
          "El contacto está interesado. Recoge sus datos de contacto, confirma la cita o el siguiente paso, y agradece su tiempo.",
      },
    },
    {
      id: "objection",
      type: "ai_state",
      position: { x: 760, y: 200 },
      data: {
        label: "AI State",
        state_name: "Manejo de Objeción",
        system_instructions:
          "El contacto no está interesado. Reconoce su posición, ofrece un beneficio específico y pregunta si podría reconsiderarlo.",
      },
    },
    {
      id: "end-ok",
      type: "end_call_node",
      position: { x: 1020, y: 60 },
      data: {
        label: "End Call",
        farewell: "Perfecto, quedamos en contacto. ¡Que tenga un buen día!",
      },
    },
    {
      id: "end-no",
      type: "end_call_node",
      position: { x: 1020, y: 280 },
      data: {
        label: "End Call",
        farewell:
          "Entendido, no le molesto más. Gracias por su tiempo, ¡que tenga un buen día!",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "intro",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e2",
      source: "intro",
      target: "route1",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e3",
      source: "route1",
      target: "qualified",
      sourceHandle: "i-interested",
      label: "Interesado",
      ...defaultEdgeOptions,
    },
    {
      id: "e4",
      source: "route1",
      target: "objection",
      sourceHandle: "i-not-interested",
      label: "No interesado",
      ...defaultEdgeOptions,
    },
    {
      id: "e5",
      source: "route1",
      target: "end-no",
      sourceHandle: "i-callback",
      label: "Callback",
      ...defaultEdgeOptions,
    },
    {
      id: "e6",
      source: "qualified",
      target: "end-ok",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
    {
      id: "e7",
      source: "objection",
      target: "end-no",
      sourceHandle: "out",
      ...defaultEdgeOptions,
    },
  ],
};
