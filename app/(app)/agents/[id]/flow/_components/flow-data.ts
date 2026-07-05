/** Flow-template registry (assembled from per-template modules). */
import { salesTemplate } from "./templates/sales";
import { qualificationTemplate } from "./templates/qualification";
import { supportTemplate } from "./templates/support";
import type { FlowTemplate } from "./flow-config";

export { DEFAULT_NODES, defaultEdgeOptions } from "./flow-config";
export type { FlowTemplate } from "./flow-config";

export const TEMPLATES: Record<string, FlowTemplate> = {
  sales: salesTemplate,
  qualification: qualificationTemplate,
  support: supportTemplate,
};
