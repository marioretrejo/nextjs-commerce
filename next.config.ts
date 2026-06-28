import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// ── Security headers (applied to every response) ──────────────────────────────
// A pragmatic, strong CSP: the anti-clickjacking / anti-injection directives
// (frame-ancestors, object-src, base-uri, form-action) are locked down hard.
// script/style still allow 'unsafe-inline'/'unsafe-eval' because Next.js, the
// charting (recharts), 3D (three / react-three-fiber → WASM) and swagger-ui
// dependencies require them; tightening these further needs nonce-based CSP and
// is tracked separately so it can be verified at runtime without breaking pages.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  // Supabase REST/Realtime, LiveKit (wss), Stripe, provider APIs.
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    // microphone is allowed on self (the voice widget needs it); camera and
    // geolocation are disabled everywhere.
    value: "camera=(), geolocation=(), microphone=(self)",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const config: NextConfig = {
  experimental: {
    ppr: false,
  },
  // Never ship source maps to the browser in production.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  webpack(webpackConfig) {
    // retell-client-js-sdk is an optional browser SDK loaded dynamically at runtime
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.fallback = {
      ...(webpackConfig.resolve.fallback ?? {}),
      "retell-client-js-sdk": false,
    };
    return webpackConfig;
  },
};

export default withNextIntl(config);
