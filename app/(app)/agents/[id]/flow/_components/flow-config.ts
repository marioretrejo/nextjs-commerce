/** Cycle-free shared flow config: default nodes, edge styling, template type. */
import { MarkerType, type Node, type Edge } from "@xyflow/react";

export type FlowTemplate = {
  label: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
};

export const DEFAULT_NODES: Node[] = [
  {
    id: "start",
    type: "start_node",
    position: { x: 80, y: 200 },
    data: { label: "Start" },
    deletable: false,
  },
];

export const defaultEdgeOptions = {
  animated: false,
  style: { strokeWidth: 2, stroke: "#94a3b8" },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
  labelStyle: { fontSize: 10, fontWeight: 600, fill: "#6366f1" },
  labelBgStyle: { fill: "#eef2ff", fillOpacity: 0.9 },
  labelBgPadding: [4, 3] as [number, number],
};
