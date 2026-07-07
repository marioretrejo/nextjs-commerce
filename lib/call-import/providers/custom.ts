import { buildNormalized } from "./base";
import type { NormalizedExternalCall } from "../types";

// Custom webhook + n8n both use the canonical field names documented in
// docs/CALL_IMPORT.md, so they rely entirely on the canonical map in base.ts.
export function normalizeCustom(
  payload: unknown,
  provider = "custom_webhook",
): NormalizedExternalCall {
  return buildNormalized(provider, payload);
}
