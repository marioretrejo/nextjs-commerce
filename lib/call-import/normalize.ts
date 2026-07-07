import type { NormalizedExternalCall } from "./types";
import { normalizeCustom } from "./providers/custom";
import { normalizeSquaretalk } from "./providers/squaretalk";
import { normalizeVoiso } from "./providers/voiso";
import { normalizeCommpeak } from "./providers/commpeak";

export type { NormalizedExternalCall } from "./types";

// Dispatch a raw provider payload to the correct normalizer. Unknown providers
// fall back to the canonical/custom mapping so an unrecognized value never
// throws — it just yields a best-effort normalization.
export function normalizeExternalCall(
  provider: string,
  payload: unknown,
): NormalizedExternalCall {
  switch (provider) {
    case "squaretalk":
      return normalizeSquaretalk(payload);
    case "voiso":
      return normalizeVoiso(payload);
    case "commpeak":
      return normalizeCommpeak(payload);
    case "n8n":
      return normalizeCustom(payload, "n8n");
    case "custom_webhook":
      return normalizeCustom(payload, "custom_webhook");
    default:
      return normalizeCustom(payload, provider);
  }
}
