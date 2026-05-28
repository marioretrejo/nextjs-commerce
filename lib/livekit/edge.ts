/**
 * LiveKit Edge Routing
 *
 * Maps a user's geographic region to the nearest LiveKit node to achieve
 * < 50ms audio latency. LiveKit Cloud handles this automatically through
 * their global edge network — but for self-hosted or hybrid deployments,
 * use these helpers to route workers and clients to the correct region.
 *
 * Environment variables:
 *   LIVEKIT_URL          — Default/primary LiveKit WebSocket URL
 *   LIVEKIT_URL_US_EAST  — Optional regional overrides
 *   LIVEKIT_URL_US_WEST
 *   LIVEKIT_URL_EU_WEST
 *   LIVEKIT_URL_AP_SE
 *
 * LiveKit Cloud deployment: set LIVEKIT_URL to your project's URL
 * (e.g. wss://project.livekit.cloud) — routing is automatic.
 *
 * Self-hosted: set regional URLs and use getRegionalWsUrl() in the token
 * endpoint to embed the correct wsUrl in the client token response.
 */

export type LiveKitRegion = 'us-east' | 'us-west' | 'eu-west' | 'ap-se' | 'default';

const REGION_ENV_MAP: Record<LiveKitRegion, string> = {
  'us-east':  'LIVEKIT_URL_US_EAST',
  'us-west':  'LIVEKIT_URL_US_WEST',
  'eu-west':  'LIVEKIT_URL_EU_WEST',
  'ap-se':    'LIVEKIT_URL_AP_SE',
  'default':  'LIVEKIT_URL',
};

/**
 * Returns the WebSocket URL for the nearest LiveKit node.
 * Falls back to the default URL if no regional override is configured.
 *
 * @param region — detected from Vercel's `x-vercel-ip-country` header or
 *                 your own geo-IP service
 */
export function getRegionalWsUrl(region: LiveKitRegion = 'default'): string {
  const envKey = REGION_ENV_MAP[region];
  const url = process.env[envKey] ?? process.env['LIVEKIT_URL'] ?? '';
  return url;
}

/**
 * Detect a rough region from an IP-country header (Vercel-provided).
 * Vercel sets `x-vercel-ip-country` to a 2-letter ISO country code on edge requests.
 */
export function detectRegion(req: Request): LiveKitRegion {
  const country = req.headers.get('x-vercel-ip-country') ?? '';

  // Europe
  if (['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'PL', 'PT', 'BE'].includes(country)) {
    return process.env['LIVEKIT_URL_EU_WEST'] ? 'eu-west' : 'default';
  }
  // Asia-Pacific
  if (['SG', 'JP', 'KR', 'AU', 'IN', 'HK', 'TW', 'TH', 'PH', 'MY'].includes(country)) {
    return process.env['LIVEKIT_URL_AP_SE'] ? 'ap-se' : 'default';
  }
  // US West
  if (['US'].includes(country)) {
    // Rough split: Vercel doesn't expose state, but US-West can be inferred
    // from x-vercel-ip-timezone if available
    const tz = req.headers.get('x-vercel-ip-timezone') ?? '';
    if (/America\/(Los_Angeles|Denver|Phoenix|Anchorage|Honolulu)/.test(tz)) {
      return process.env['LIVEKIT_URL_US_WEST'] ? 'us-west' : 'default';
    }
    return process.env['LIVEKIT_URL_US_EAST'] ? 'us-east' : 'default';
  }

  return 'default';
}

/**
 * Returns the HTTP REST URL for the LiveKit server (used by RoomServiceClient).
 */
export function getRegionalHttpUrl(region: LiveKitRegion = 'default'): string {
  return getRegionalWsUrl(region)
    .replace('wss://', 'https://')
    .replace('ws://', 'http://');
}

/**
 * All configured regional endpoints — useful for worker health checks.
 */
export function getAllRegionalUrls(): Partial<Record<LiveKitRegion, string>> {
  const result: Partial<Record<LiveKitRegion, string>> = {};
  for (const [region, envKey] of Object.entries(REGION_ENV_MAP) as [LiveKitRegion, string][]) {
    const url = process.env[envKey];
    if (url) result[region] = url;
  }
  return result;
}
