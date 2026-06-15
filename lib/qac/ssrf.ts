/**
 * SSRF protection for external URLs fetched by the QA Center pipeline
 * (recording downloads, webhook targets, etc.).
 *
 * Rules:
 *   - Only https:// is permitted
 *   - Loopback / localhost addresses are rejected
 *   - Private IPv4 ranges (RFC 1918) and link-local (169.254.x.x) are rejected
 */

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function isSafeUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return false;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.map(Number);
    const a = parts[1]!;
    const b = parts[2]!;
    if (
      a === 10 ||                           // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||  // 172.16.0.0/12
      (a === 192 && b === 168) ||            // 192.168.0.0/16
      (a === 169 && b === 254)               // 169.254.0.0/16 link-local
    ) {
      return false;
    }
  }

  return true;
}
