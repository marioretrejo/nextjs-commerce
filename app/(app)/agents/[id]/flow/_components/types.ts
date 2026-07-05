/** Flow-builder node data types. */
import type { Node, Edge } from "@xyflow/react";

export interface FlowConfig {
  version: 2;
  nodes: Node[];
  edges: Edge[];
}

export interface StartNodeData extends Record<string, unknown> {
  label: string;
}
export interface AiStateData extends Record<string, unknown> {
  label: string;
  state_name: string;
  system_instructions: string;
}
export interface Intent {
  id: string;
  label: string;
  description: string;
}
export interface SemanticRouterData extends Record<string, unknown> {
  label: string;
  description: string;
  intents: Intent[];
}
export interface WebhookData extends Record<string, unknown> {
  label: string;
  url: string;
  method: "GET" | "POST" | "PUT";
  extract_variables: string;
}
export interface TransferData extends Record<string, unknown> {
  label: string;
  transfer_number: string;
}
export interface EndCallData extends Record<string, unknown> {
  label: string;
  farewell: string;
}
