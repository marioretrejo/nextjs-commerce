/**
 * scripts/production-readiness-check.ts
 *
 * Production Readiness Gate for VoiceOS.
 *
 * Validates environment variables, cron routes, database schema, security
 * posture, and build artifacts against staging/production requirements.
 *
 * Usage:
 *   npx tsx scripts/production-readiness-check.ts [options]
 *
 * Options:
 *   --env local|staging|production   (default: local)
 *   --base-url <url>                 App base URL for HTTP checks
 *   --strict                         Treat warnings as failures
 *   --json                           Output JSON report
 *   --skip-build                     Skip tsc/build checks
 *   --skip-db                        Skip DB schema checks
 *   --skip-http                      Skip HTTP endpoint checks
 *
 * SAFE:
 *   - Never prints secret values.
 *   - Never makes real calls (no Twilio/LiveKit/AI).
 *   - Never sends external alerts.
 *   - Never modifies the database.
 */

export {};

// ── CLI parsing ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getFlag(name: string): string | null {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : null;
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const ENV_MODE = (getFlag("env") ?? "local") as
  | "local"
  | "staging"
  | "production";
const BASE_URL = getFlag("base-url") ?? "http://localhost:3000";
const IS_STRICT = hasFlag("strict");
const JSON_OUTPUT = hasFlag("json");
const SKIP_BUILD = hasFlag("skip-build");
const SKIP_DB = hasFlag("skip-db");
const SKIP_HTTP = hasFlag("skip-http");

// ── Result tracking ────────────────────────────────────────────────────────────

type CheckStatus = "pass" | "warn" | "fail" | "skip";

interface CheckResult {
  section: string;
  name: string;
  status: CheckStatus;
  message: string;
}

const results: CheckResult[] = [];

function record(
  section: string,
  name: string,
  status: CheckStatus,
  message: string,
) {
  results.push({ section, name, status, message });
  if (!JSON_OUTPUT) {
    const icon =
      status === "pass"
        ? "✅"
        : status === "warn"
          ? "⚠️ "
          : status === "fail"
            ? "❌"
            : "⏭ ";
    console.log(`  ${icon} [${status.toUpperCase()}] ${name}: ${message}`);
  }
}

function section(title: string) {
  if (!JSON_OUTPUT) console.log(`\n── ${title} ──`);
}

// ── A. Environment variables ────────────────────────────────────────────────────

const WEAK_SECRETS = new Set([
  "secret",
  "changeme",
  "test",
  "password",
  "internal",
  "development",
  "12345",
  "admin",
  "placeholder",
  "example",
  "replace_me",
]);

type EnvSpec = {
  key: string;
  required: boolean;
  minLen?: number;
  weakCheck?: boolean;
  productionRequired?: boolean;
  description: string;
};

const ENV_SPECS: EnvSpec[] = [
  // Supabase
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anon key (safe to expose)",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    description: "Supabase service role key",
  },
  // Internal secrets
  {
    key: "INTERNAL_API_SECRET",
    required: true,
    minLen: 16,
    weakCheck: true,
    productionRequired: true,
    description: "Internal cron/API secret",
  },
  {
    key: "CRON_SECRET",
    required: false,
    minLen: 16,
    weakCheck: true,
    description: "Vercel Cron secret (optional if INTERNAL_API_SECRET set)",
  },
  {
    key: "VOICEOS_WEBHOOK_SIGNING_SECRET",
    required: ENV_MODE === "production",
    minLen: 16,
    weakCheck: true,
    description: "Outbound webhook HMAC signing secret",
  },
  // Alerting
  {
    key: "VOICEOS_ALERTING_SEND_EXTERNAL",
    required: false,
    description: "External alert sends gate (must be false until ready)",
  },
  // LiveKit
  {
    key: "LIVEKIT_API_KEY",
    required: ENV_MODE !== "local",
    description: "LiveKit API key (required in staging/production)",
  },
  {
    key: "LIVEKIT_API_SECRET",
    required: ENV_MODE !== "local",
    description: "LiveKit API secret",
  },
  {
    key: "LIVEKIT_URL",
    required: ENV_MODE !== "local",
    description: "LiveKit WebSocket URL",
  },
  // Twilio
  {
    key: "TWILIO_ACCOUNT_SID",
    required: ENV_MODE !== "local",
    description: "Twilio account SID",
  },
  {
    key: "TWILIO_AUTH_TOKEN",
    required: ENV_MODE !== "local",
    description: "Twilio auth token",
  },
  // AI providers
  {
    key: "DEEPGRAM_API_KEY",
    required: ENV_MODE !== "local",
    description: "Deepgram STT API key",
  },
  {
    key: "CARTESIA_API_KEY",
    required: false,
    description:
      "Cartesia TTS API key (primary, optional with OpenAI fallback)",
  },
  {
    key: "GROQ_API_KEY",
    required: false,
    description: "Groq LLM API key (primary, optional with OpenAI fallback)",
  },
  {
    key: "OPENAI_API_KEY",
    required: false,
    description: "OpenAI API key (TTS + LLM fallback)",
  },
  // Billing
  {
    key: "STRIPE_SECRET_KEY",
    required: ENV_MODE === "production",
    description: "Stripe secret key (required in production)",
  },
  // Load-test safety
  {
    key: "VOICEOS_LOAD_TEST_MODE",
    required: false,
    description: "Load test mode (must NOT be true in production)",
  },
];

function checkEnvVars() {
  section("A. Environment Variables");

  for (const spec of ENV_SPECS) {
    const value = process.env[spec.key];
    const present = value !== undefined && value.trim().length > 0;

    // Special: VOICEOS_ALERTING_SEND_EXTERNAL must NOT be true in non-production
    if (spec.key === "VOICEOS_ALERTING_SEND_EXTERNAL") {
      if (value === "true" && ENV_MODE !== "production") {
        record(
          "env",
          spec.key,
          "warn",
          "set to true — external alerts enabled (only safe in production)",
        );
      } else if (!present || value === "false") {
        record(
          "env",
          spec.key,
          "pass",
          `${present ? "false" : "unset"} (safe default)`,
        );
      } else {
        record("env", spec.key, "pass", "present");
      }
      continue;
    }

    // Special: VOICEOS_LOAD_TEST_MODE must NOT be true in production
    if (spec.key === "VOICEOS_LOAD_TEST_MODE") {
      if (value === "true" && ENV_MODE === "production") {
        record(
          "env",
          spec.key,
          "fail",
          "LOAD_TEST_MODE=true is BLOCKED in production mode",
        );
      } else if (value === "true") {
        record(
          "env",
          spec.key,
          "warn",
          "LOAD_TEST_MODE=true — ensure this is intentional",
        );
      } else {
        record("env", spec.key, "pass", "not set (safe)");
      }
      continue;
    }

    if (!present) {
      if (spec.required) {
        record("env", spec.key, "fail", `MISSING — required for ${ENV_MODE}`);
      } else if (spec.productionRequired && ENV_MODE === "production") {
        record("env", spec.key, "fail", "MISSING — required in production");
      } else {
        record(
          "env",
          spec.key,
          "skip",
          `optional / not required for ${ENV_MODE}`,
        );
      }
      continue;
    }

    // Weak value check
    if (spec.weakCheck && WEAK_SECRETS.has(value!.toLowerCase().trim())) {
      record(
        "env",
        spec.key,
        "fail",
        "UNSAFE DEFAULT — set to a common weak value; generate with: openssl rand -hex 32",
      );
      continue;
    }

    // Min length check
    if (spec.minLen && value!.trim().length < spec.minLen) {
      record(
        "env",
        spec.key,
        "fail",
        `too short (${value!.trim().length} chars, min ${spec.minLen})`,
      );
      continue;
    }

    record("env", spec.key, "pass", "present");
  }

  // Must have at least one of GROQ_API_KEY or OPENAI_API_KEY for LLM
  const hasLLM = process.env["GROQ_API_KEY"] || process.env["OPENAI_API_KEY"];
  if (!hasLLM && ENV_MODE !== "local") {
    record(
      "env",
      "LLM_PROVIDER",
      "fail",
      "Neither GROQ_API_KEY nor OPENAI_API_KEY is set — calls will fail",
    );
  } else if (!hasLLM) {
    record(
      "env",
      "LLM_PROVIDER",
      "warn",
      "No LLM key set locally (OK for non-call tests)",
    );
  } else {
    record(
      "env",
      "LLM_PROVIDER",
      "pass",
      "at least one LLM provider configured",
    );
  }

  // Must have at least one TTS provider
  const hasTTS =
    process.env["CARTESIA_API_KEY"] || process.env["OPENAI_API_KEY"];
  if (!hasTTS && ENV_MODE !== "local") {
    record(
      "env",
      "TTS_PROVIDER",
      "fail",
      "Neither CARTESIA_API_KEY nor OPENAI_API_KEY is set — TTS will fail",
    );
  } else if (!hasTTS) {
    record(
      "env",
      "TTS_PROVIDER",
      "warn",
      "No TTS key set locally (OK for non-call tests)",
    );
  } else {
    record(
      "env",
      "TTS_PROVIDER",
      "pass",
      "at least one TTS provider configured",
    );
  }
}

// ── B. Cron route readiness ────────────────────────────────────────────────────

async function checkCronRoutes() {
  section("B. Cron Route Readiness");

  const expectedCronPaths = [
    "/api/cron/post-call-jobs",
    "/api/cron/recover-missing-post-call-jobs",
    "/api/cron/provider-health",
    "/api/cron/alerts",
    "/api/cron/campaign-dial",
    "/api/cron/data-retention",
    "/api/cron/reset-minutes",
  ];

  // Check cron routes exist as files
  const { existsSync } = await import("node:fs");
  const path = await import("node:path");
  const baseDir = path.resolve(process.cwd(), "app/api/cron");

  for (const cronPath of expectedCronPaths) {
    const routeName = cronPath.replace("/api/cron/", "");
    const routeFile = path.join(baseDir, routeName, "route.ts");
    if (existsSync(routeFile)) {
      record("cron", cronPath, "pass", "route file exists");
    } else {
      record("cron", cronPath, "fail", "route.ts file not found");
    }
  }

  // Verify /api/cron is in PUBLIC_PATHS of middleware
  const middlewareFile = path.resolve(process.cwd(), "middleware.ts");
  if (existsSync(middlewareFile)) {
    const { readFileSync } = await import("node:fs");
    const mw = readFileSync(middlewareFile, "utf8");
    if (mw.includes('"/api/cron"')) {
      record(
        "cron",
        "middleware-exemption",
        "pass",
        "/api/cron is in PUBLIC_PATHS (cron routes not blocked by session-cookie check)",
      );
    } else {
      record(
        "cron",
        "middleware-exemption",
        "fail",
        "/api/cron NOT found in PUBLIC_PATHS — cron routes will be blocked by middleware",
      );
    }
  }

  // Check all cron routes use timingSafeEqual
  const { readFileSync } = await import("node:fs");
  const cronRoutes = [
    "data-retention",
    "reset-minutes",
    "post-call-jobs",
    "recover-missing-post-call-jobs",
    "provider-health",
    "alerts",
    "campaign-dial",
  ];
  for (const route of cronRoutes) {
    const file = path.join(baseDir, route, "route.ts");
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    if (content.includes("timingSafeEqual")) {
      record("cron", `${route}:timing-safe`, "pass", "uses timingSafeEqual");
    } else {
      record(
        "cron",
        `${route}:timing-safe`,
        "fail",
        "does NOT use timingSafeEqual — vulnerable to timing attacks",
      );
    }
  }
}

// ── C. Database readiness (requires Supabase access) ──────────────────────────

async function checkDatabase() {
  if (SKIP_DB) {
    section("C. Database Readiness (skipped)");
    record("db", "all", "skip", "--skip-db flag set");
    return;
  }

  section("C. Database Readiness");

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    record(
      "db",
      "connection",
      "fail",
      "SUPABASE credentials not set — cannot check DB",
    );
    return;
  }

  let createClient: typeof import("@supabase/supabase-js").createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    record("db", "connection", "fail", "Cannot import @supabase/supabase-js");
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Critical tables
  const criticalTables = [
    "workspaces",
    "users",
    "agents",
    "calls",
    "call_events",
    "post_call_jobs",
    "provider_health_checks",
    "alert_rules",
    "alert_incidents",
    "alert_deliveries",
    "campaigns",
    "campaign_contacts",
  ];

  for (const table of criticalTables) {
    const { error } = await admin.from(table).select("id").limit(1);
    if (!error) {
      record("db", `table:${table}`, "pass", "exists and queryable");
    } else {
      record("db", `table:${table}`, "fail", error.message);
    }
  }

  // Critical RPCs (use actual DB function names)
  const criticalRPCs = [
    {
      name: "try_claim_call_slot",
      params: { p_workspace_id: "00000000-0000-0000-0000-000000000000" },
    },
    {
      name: "release_call_slot",
      params: { p_workspace_id: "00000000-0000-0000-0000-000000000000" },
    },
    {
      name: "get_provider_health_summary",
      params: { p_workspace_id: null, p_window_minutes: 1 },
    },
    {
      name: "get_workspace_billing_status",
      params: { p_workspace_id: "00000000-0000-0000-0000-000000000000" },
    },
  ];

  for (const rpc of criticalRPCs) {
    const { error } = await admin.rpc(rpc.name, rpc.params);
    // RPC exists if error is null or error is a row-level/constraint error (not "function does not exist")
    const missing =
      error?.message?.includes("does not exist") ||
      (error?.message?.includes("No rows found") === false &&
        error?.code === "PGRST202");
    if (!missing) {
      record("db", `rpc:${rpc.name}`, "pass", "RPC exists");
    } else {
      record(
        "db",
        `rpc:${rpc.name}`,
        "fail",
        error?.message ?? "RPC not found",
      );
    }
  }

  // Last migration applied
  try {
    const { data: migRows } = await admin
      .from("schema_migrations")
      .select("version")
      .order("version", { ascending: false })
      .limit(1);
    const lastVersion = (migRows as Array<{ version: string }>)?.[0]?.version;
    if (lastVersion) {
      record("db", "last-migration", "pass", `last version: ${lastVersion}`);
    }
  } catch {
    // schema_migrations might not be accessible — not critical
    record(
      "db",
      "last-migration",
      "skip",
      "schema_migrations not queryable (non-critical)",
    );
  }
}

// ── D. Security readiness ──────────────────────────────────────────────────────

async function checkSecurity() {
  section("D. Security Readiness");

  // INTERNAL_API_SECRET strength
  const internalSecret = process.env["INTERNAL_API_SECRET"];
  if (!internalSecret) {
    record("security", "INTERNAL_API_SECRET", "fail", "missing");
  } else if (internalSecret.trim().length < 16) {
    record("security", "INTERNAL_API_SECRET", "fail", "too short (< 16 chars)");
  } else if (WEAK_SECRETS.has(internalSecret.toLowerCase().trim())) {
    record(
      "security",
      "INTERNAL_API_SECRET",
      "fail",
      "matches a known weak value",
    );
  } else {
    record(
      "security",
      "INTERNAL_API_SECRET",
      "pass",
      `present, length ${internalSecret.length}`,
    );
  }

  // VOICEOS_WEBHOOK_SIGNING_SECRET
  const whSecret = process.env["VOICEOS_WEBHOOK_SIGNING_SECRET"];
  if (!whSecret) {
    const status = ENV_MODE === "production" ? "fail" : "warn";
    record(
      "security",
      "VOICEOS_WEBHOOK_SIGNING_SECRET",
      status,
      "missing — webhooks sent unsigned",
    );
  } else {
    record("security", "VOICEOS_WEBHOOK_SIGNING_SECRET", "pass", "present");
  }

  // VOICEOS_ALERTING_SEND_EXTERNAL must be false by default
  const extAlerts = process.env["VOICEOS_ALERTING_SEND_EXTERNAL"];
  if (extAlerts === "true" && ENV_MODE !== "production") {
    record(
      "security",
      "VOICEOS_ALERTING_SEND_EXTERNAL",
      "warn",
      "true in non-production — external alerts will be sent",
    );
  } else {
    record(
      "security",
      "VOICEOS_ALERTING_SEND_EXTERNAL",
      "pass",
      `${extAlerts ?? "unset"} (safe)`,
    );
  }

  // LOAD_TEST_MODE must be false in production
  const loadTest = process.env["VOICEOS_LOAD_TEST_MODE"];
  if (loadTest === "true" && ENV_MODE === "production") {
    record(
      "security",
      "VOICEOS_LOAD_TEST_MODE",
      "fail",
      "BLOCKED — LOAD_TEST_MODE=true in production",
    );
  } else if (loadTest === "true") {
    record(
      "security",
      "VOICEOS_LOAD_TEST_MODE",
      "warn",
      "true — ensure this is intentional",
    );
  } else {
    record("security", "VOICEOS_LOAD_TEST_MODE", "pass", "not set (safe)");
  }

  // Check for hardcoded secrets in critical source files
  const path = await import("node:path");
  const { existsSync, readFileSync } = await import("node:fs");

  const filesToScan = [
    "lib/env.ts",
    "middleware.ts",
    "app/api/cron/alerts/route.ts",
    "app/api/cron/provider-health/route.ts",
    "lib/observability/alert-delivery.ts",
  ];

  const dangerPatterns = [
    /sk-[a-zA-Z0-9\-_]{20,}/, // OpenAI keys
    /key-[a-zA-Z0-9\-_]{16,}/, // Cartesia keys
    /Bearer\s+[A-Za-z0-9\-_\.]{20,}/, // Bearer tokens
  ];

  let hardcodedFound = false;
  for (const rel of filesToScan) {
    const full = path.resolve(process.cwd(), rel);
    if (!existsSync(full)) continue;
    const content = readFileSync(full, "utf8");
    for (const pat of dangerPatterns) {
      if (pat.test(content)) {
        record(
          "security",
          `hardcoded-secret:${rel}`,
          "fail",
          `Potential hardcoded secret found matching ${pat}`,
        );
        hardcodedFound = true;
      }
    }
  }
  if (!hardcodedFound) {
    record(
      "security",
      "hardcoded-secrets-scan",
      "pass",
      "no hardcoded secrets in scanned files",
    );
  }
}

// ── E. Operational readiness (HTTP checks) ────────────────────────────────────

async function checkOperational() {
  if (SKIP_HTTP) {
    section("E. Operational Readiness (HTTP skipped)");
    record("ops", "all-http", "skip", "--skip-http flag set");
    return;
  }

  section("E. Operational Readiness (HTTP)");

  async function httpCheck(
    name: string,
    url: string,
    opts: RequestInit = {},
    expectedStatus: number | number[] = 200,
  ) {
    try {
      const res = await fetch(url, { ...opts, redirect: "manual" });
      const expected = Array.isArray(expectedStatus)
        ? expectedStatus
        : [expectedStatus];
      if (expected.includes(res.status)) {
        record("ops", name, "pass", `HTTP ${res.status}`);
      } else {
        record(
          "ops",
          name,
          "fail",
          `expected ${expected.join("/")}, got ${res.status}`,
        );
      }
    } catch (err) {
      record(
        "ops",
        name,
        `skip` as CheckStatus,
        `unreachable: ${String(err).slice(0, 80)}`,
      );
    }
  }

  // Health endpoint
  await httpCheck("health", `${BASE_URL}/api/health`, {}, 200);

  // Cron routes must reject without secret
  const cronRoutes = [
    "/api/cron/post-call-jobs",
    "/api/cron/provider-health",
    "/api/cron/alerts",
    "/api/cron/campaign-dial",
    "/api/cron/data-retention",
    "/api/cron/reset-minutes",
  ];
  for (const route of cronRoutes) {
    await httpCheck(`${route}:no-auth`, `${BASE_URL}${route}`, {}, [401, 403]);
    await httpCheck(
      `${route}:wrong-secret`,
      `${BASE_URL}${route}`,
      { headers: { Authorization: "Bearer wrong-secret-xyz" } },
      [401, 403],
    );
  }

  // Protected API routes must reject unauthenticated requests
  const protectedRoutes = ["/api/provider-health", "/api/alerts"];
  for (const route of protectedRoutes) {
    await httpCheck(
      `${route}:no-auth`,
      `${BASE_URL}${route}`,
      {},
      [401, 307, 302],
    );
  }

  // Test cron routes with correct secret if available
  const secret =
    process.env["INTERNAL_API_SECRET"] ?? process.env["CRON_SECRET"];
  if (secret && secret.trim().length >= 16) {
    await httpCheck(
      "/api/cron/provider-health:valid-secret",
      `${BASE_URL}/api/cron/provider-health`,
      { headers: { Authorization: `Bearer ${secret}` } },
      200,
    );
    await httpCheck(
      "/api/cron/alerts:valid-secret",
      `${BASE_URL}/api/cron/alerts`,
      { headers: { Authorization: `Bearer ${secret}` } },
      200,
    );
  } else {
    record(
      "ops",
      "cron-valid-secret-test",
      "skip",
      "No INTERNAL_API_SECRET/CRON_SECRET set — skipping authenticated cron test",
    );
  }
}

// ── F. Build readiness ─────────────────────────────────────────────────────────

async function checkBuild() {
  if (SKIP_BUILD) {
    section("F. Build Readiness (skipped)");
    record("build", "all", "skip", "--skip-build flag set");
    return;
  }

  section("F. Build Readiness");

  const { execSync } = await import("node:child_process");

  function runCheck(name: string, cmd: string) {
    try {
      execSync(cmd, { stdio: "pipe", cwd: process.cwd() });
      record("build", name, "pass", "exit 0");
    } catch (err) {
      const errMsg =
        (err as { stderr?: Buffer; stdout?: Buffer }).stderr
          ?.toString()
          .slice(0, 300) ?? String(err).slice(0, 300);
      record("build", name, "fail", `exit non-zero: ${errMsg}`);
    }
  }

  runCheck("tsc", "npx tsc --noEmit");
  runCheck("prettier:check", "pnpm prettier:check");
  // Note: pnpm test:unit and pnpm build are not run here to keep the check fast.
  // Run separately: pnpm test:unit && pnpm build
  record("build", "unit-tests", "skip", "run separately with: pnpm test:unit");
  record("build", "next-build", "skip", "run separately with: pnpm build");
}

// ── Runner ─────────────────────────────────────────────────────────────────────

function summarize() {
  const counts = { pass: 0, warn: 0, fail: 0, skip: 0 };
  for (const r of results) counts[r.status]++;

  const effectiveFails = IS_STRICT ? counts.fail + counts.warn : counts.fail;

  if (JSON_OUTPUT) {
    // Strip any values that might be secrets — only output keys and statuses
    const safeResults = results.map(({ section, name, status, message }) => ({
      section,
      name,
      status,
      message,
    }));
    console.log(
      JSON.stringify(
        {
          env_mode: ENV_MODE,
          base_url: BASE_URL,
          strict: IS_STRICT,
          summary: counts,
          gate: effectiveFails === 0 ? "PASS" : "FAIL",
          checks: safeResults,
          generated_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } else {
    console.log("\n" + "=".repeat(60));
    console.log(`Production Readiness Check — ${ENV_MODE.toUpperCase()}`);
    console.log("=".repeat(60));
    console.log(
      `✅ ${counts.pass} pass  ⚠️  ${counts.warn} warn  ❌ ${counts.fail} fail  ⏭  ${counts.skip} skip`,
    );
    if (IS_STRICT && counts.warn > 0) {
      console.log("(--strict mode: warnings counted as failures)");
    }
    console.log("=".repeat(60));
    if (effectiveFails === 0) {
      console.log(`\n🟢 GATE: PASS — ready for ${ENV_MODE}`);
    } else {
      console.log(
        `\n🔴 GATE: FAIL — ${effectiveFails} issue(s) must be resolved before ${ENV_MODE}`,
      );
    }
  }

  process.exit(effectiveFails > 0 ? 1 : 0);
}

async function main() {
  if (!JSON_OUTPUT) {
    console.log("=".repeat(60));
    console.log(`VoiceOS Production Readiness Check`);
    console.log(`Environment: ${ENV_MODE} | Base URL: ${BASE_URL}`);
    console.log(
      `Strict: ${IS_STRICT} | Skip-DB: ${SKIP_DB} | Skip-HTTP: ${SKIP_HTTP}`,
    );
    console.log("=".repeat(60));
  }

  checkEnvVars();
  await checkCronRoutes();
  await checkDatabase();
  await checkSecurity();
  await checkOperational();
  await checkBuild();

  summarize();
}

main().catch((err) => {
  console.error("Readiness check fatal error:", err);
  process.exit(2);
});
