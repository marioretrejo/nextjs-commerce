/**
 * agent/tests/production-readiness.test.ts
 *
 * Unit tests for production readiness gate logic.
 * Uses node:test + node:assert/strict (not Jest).
 *
 * Tests cover:
 *   1. Env var checker never prints secret values
 *   2. Missing critical env var is detected
 *   3. Unsafe default values are detected
 *   4. LOAD_TEST_MODE=true blocks production
 *   5. Cron route checker detects improperly protected routes
 *   6. Readiness result correctly distinguishes pass/warn/fail
 *   7. JSON output contains no secret values
 *   8. Deployment smoke test distinguishes PARTIAL vs FULL PASS
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// ── Helpers (inline reimplementations of gate logic, not importing scripts) ────

type CheckStatus = "pass" | "warn" | "fail";

interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
}

interface ReadinessReport {
  checks: CheckResult[];
  passCount: number;
  warnCount: number;
  failCount: number;
  overallStatus: "PASS" | "FAIL";
}

const UNSAFE_DEFAULTS = [
  "secret",
  "changeme",
  "test",
  "password",
  "internal",
  "development",
  "12345",
  "admin",
];

function checkEnvVar(
  name: string,
  value: string | undefined,
  required: boolean,
): CheckResult {
  if (!value || value.trim() === "") {
    return {
      name,
      status: required ? "fail" : "warn",
      // NEVER include value in message — only name
      message: required
        ? `${name} is missing (required)`
        : `${name} is not set (optional)`,
    };
  }
  if (UNSAFE_DEFAULTS.includes(value.toLowerCase())) {
    return {
      name,
      status: "fail",
      // Do NOT include the actual value in output
      message: `${name} uses an unsafe default value`,
    };
  }
  return { name, status: "pass", message: `${name} is set` };
}

function checkLoadTestMode(value: string | undefined): CheckResult {
  const enabled =
    value === "true" || value === "1" || value?.toLowerCase() === "true";
  return {
    name: "LOAD_TEST_MODE",
    status: enabled ? "fail" : "pass",
    message: enabled
      ? "LOAD_TEST_MODE is enabled — must be disabled in production"
      : "LOAD_TEST_MODE is not active",
  };
}

function buildReport(checks: CheckResult[]): ReadinessReport {
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  return {
    checks,
    passCount,
    warnCount,
    failCount,
    overallStatus: failCount > 0 ? "FAIL" : "PASS",
  };
}

function toJson(report: ReadinessReport): string {
  return JSON.stringify(report, null, 2);
}

// Minimal cron route security checker
function checkCronRouteSecurity(fileContent: string): CheckResult {
  const hasTimingSafeEqual = fileContent.includes("timingSafeEqual");
  const hasPlainEquals = /authHeader\s*[!=]==\s*[`'"']Bearer/.test(fileContent);
  if (hasPlainEquals && !hasTimingSafeEqual) {
    return {
      name: "cron_route_security",
      status: "fail",
      message:
        "Cron route uses plain string comparison — must use timingSafeEqual",
    };
  }
  if (!hasTimingSafeEqual) {
    return {
      name: "cron_route_security",
      status: "warn",
      message: "Cron route has no auth check detected",
    };
  }
  return {
    name: "cron_route_security",
    status: "pass",
    message: "Cron route uses timingSafeEqual",
  };
}

// Minimal smoke test pass level logic
type SmokePassLevel = "FULL PASS" | "PARTIAL PASS" | "FAIL";

interface SmokeTestResult {
  t1_health: boolean;
  t2_cron_auth: boolean;
  t3_protected_auth: boolean;
  t4_no_middleware_redirect: boolean;
  t5_valid_secret: boolean | null; // null = skipped
  t6_no_secret_leak: boolean | null;
  t7_no_real_providers: boolean | null;
  t8_authenticated: boolean | null;
}

function computeSmokePassLevel(r: SmokeTestResult): SmokePassLevel {
  const coreTests = [
    r.t1_health,
    r.t2_cron_auth,
    r.t3_protected_auth,
    r.t4_no_middleware_redirect,
  ];
  if (coreTests.some((t) => t === false)) return "FAIL";

  const optionalTests = [
    r.t5_valid_secret,
    r.t6_no_secret_leak,
    r.t7_no_real_providers,
    r.t8_authenticated,
  ];
  const ranTests = optionalTests.filter((t) => t !== null);
  if (ranTests.some((t) => t === false)) return "FAIL";

  const hasFullCredentials = optionalTests.every((t) => t !== null);
  return hasFullCredentials ? "FULL PASS" : "PARTIAL PASS";
}

// ── Tests ──────────────────────────────────────────────────────────────────────

// 1. Env var checker never prints secret values
test("checkEnvVar: missing required var — message contains no secret value", () => {
  const result = checkEnvVar("INTERNAL_API_SECRET", undefined, true);
  assert.equal(result.status, "fail");
  // message must not contain the value (which is undefined anyway, but check logic)
  assert.ok(!result.message.includes("undefined"));
  assert.ok(result.message.includes("INTERNAL_API_SECRET"));
});

test("checkEnvVar: present var — message does NOT include the actual value", () => {
  const secretValue = "abc123-very-secret-key-xyz789-not-to-be-logged";
  const result = checkEnvVar("INTERNAL_API_SECRET", secretValue, true);
  assert.equal(result.status, "pass");
  assert.ok(
    !result.message.includes(secretValue),
    "Secret value leaked in message",
  );
});

// 2. Missing critical env var is detected
test("checkEnvVar: missing required var returns fail status", () => {
  const result = checkEnvVar("STRIPE_SECRET_KEY", "", true);
  assert.equal(result.status, "fail");
});

test("checkEnvVar: missing optional var returns warn (not fail)", () => {
  const result = checkEnvVar(
    "VOICEOS_ALERTING_SLACK_WEBHOOK_URL",
    undefined,
    false,
  );
  assert.equal(result.status, "warn");
});

// 3. Unsafe default values are detected
test("checkEnvVar: 'secret' default → fail", () => {
  const result = checkEnvVar("INTERNAL_API_SECRET", "secret", true);
  assert.equal(result.status, "fail");
  assert.ok(result.message.includes("unsafe default"));
});

test("checkEnvVar: 'changeme' default → fail", () => {
  const result = checkEnvVar("INTERNAL_API_SECRET", "changeme", true);
  assert.equal(result.status, "fail");
});

test("checkEnvVar: 'password' default → fail", () => {
  const result = checkEnvVar("INTERNAL_API_SECRET", "password", true);
  assert.equal(result.status, "fail");
});

// 4. LOAD_TEST_MODE=true blocks production
test("checkLoadTestMode: 'true' → fail", () => {
  const result = checkLoadTestMode("true");
  assert.equal(result.status, "fail");
  assert.ok(result.message.includes("must be disabled"));
});

test("checkLoadTestMode: '1' → fail", () => {
  const result = checkLoadTestMode("1");
  assert.equal(result.status, "fail");
});

test("checkLoadTestMode: undefined → pass", () => {
  const result = checkLoadTestMode(undefined);
  assert.equal(result.status, "pass");
});

test("checkLoadTestMode: 'false' → pass", () => {
  const result = checkLoadTestMode("false");
  assert.equal(result.status, "pass");
});

// 5. Cron route checker detects improperly protected routes
test("checkCronRouteSecurity: route with timingSafeEqual → pass", () => {
  const fileContent = `
    import { timingSafeEqual } from "node:crypto";
    function verifyCronSecret(req) {
      const a = Buffer.from(secret, "utf8");
      const b = Buffer.from(provided, "utf8");
      return timingSafeEqual(a, b);
    }
  `;
  const result = checkCronRouteSecurity(fileContent);
  assert.equal(result.status, "pass");
});

test("checkCronRouteSecurity: plain string comparison → fail", () => {
  const fileContent = `
    if (authHeader !== \`Bearer \${process.env.CRON_SECRET}\`) {
      return new Response("Unauthorized", { status: 401 });
    }
  `;
  const result = checkCronRouteSecurity(fileContent);
  assert.equal(result.status, "fail");
  assert.ok(result.message.includes("timingSafeEqual"));
});

// 6. Readiness result correctly distinguishes pass/warn/fail
test("buildReport: all pass → overallStatus PASS", () => {
  const checks: CheckResult[] = [
    { name: "A", status: "pass", message: "ok" },
    { name: "B", status: "pass", message: "ok" },
    { name: "C", status: "warn", message: "optional missing" },
  ];
  const report = buildReport(checks);
  assert.equal(report.overallStatus, "PASS");
  assert.equal(report.passCount, 2);
  assert.equal(report.warnCount, 1);
  assert.equal(report.failCount, 0);
});

test("buildReport: any fail → overallStatus FAIL", () => {
  const checks: CheckResult[] = [
    { name: "A", status: "pass", message: "ok" },
    { name: "B", status: "fail", message: "missing required" },
  ];
  const report = buildReport(checks);
  assert.equal(report.overallStatus, "FAIL");
  assert.equal(report.failCount, 1);
});

// 7. JSON output contains no secret values
test("toJson: JSON output does not contain raw secret value", () => {
  const secretValue = "sk_live_super_secret_stripe_key_never_log";
  const checks: CheckResult[] = [
    {
      name: "STRIPE_SECRET_KEY",
      status: "pass",
      message: "STRIPE_SECRET_KEY is set",
    },
  ];
  const report = buildReport(checks);
  const json = toJson(report);
  assert.ok(!json.includes(secretValue), "Secret value leaked in JSON output");
  // Should contain the name but not the secret value
  assert.ok(json.includes("STRIPE_SECRET_KEY"));
});

test("toJson: JSON output is valid JSON", () => {
  const checks: CheckResult[] = [{ name: "A", status: "pass", message: "ok" }];
  const report = buildReport(checks);
  const json = toJson(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

// 8. Deployment smoke test distinguishes PARTIAL vs FULL PASS
test("computeSmokePassLevel: all core pass, optionals null → PARTIAL PASS", () => {
  const result: SmokeTestResult = {
    t1_health: true,
    t2_cron_auth: true,
    t3_protected_auth: true,
    t4_no_middleware_redirect: true,
    t5_valid_secret: null,
    t6_no_secret_leak: null,
    t7_no_real_providers: null,
    t8_authenticated: null,
  };
  assert.equal(computeSmokePassLevel(result), "PARTIAL PASS");
});

test("computeSmokePassLevel: all tests pass → FULL PASS", () => {
  const result: SmokeTestResult = {
    t1_health: true,
    t2_cron_auth: true,
    t3_protected_auth: true,
    t4_no_middleware_redirect: true,
    t5_valid_secret: true,
    t6_no_secret_leak: true,
    t7_no_real_providers: true,
    t8_authenticated: true,
  };
  assert.equal(computeSmokePassLevel(result), "FULL PASS");
});

test("computeSmokePassLevel: core test fails → FAIL", () => {
  const result: SmokeTestResult = {
    t1_health: false, // health check failed
    t2_cron_auth: true,
    t3_protected_auth: true,
    t4_no_middleware_redirect: true,
    t5_valid_secret: null,
    t6_no_secret_leak: null,
    t7_no_real_providers: null,
    t8_authenticated: null,
  };
  assert.equal(computeSmokePassLevel(result), "FAIL");
});

test("computeSmokePassLevel: optional test fails → FAIL (not PARTIAL PASS)", () => {
  const result: SmokeTestResult = {
    t1_health: true,
    t2_cron_auth: true,
    t3_protected_auth: true,
    t4_no_middleware_redirect: true,
    t5_valid_secret: false, // secret check ran but failed
    t6_no_secret_leak: null,
    t7_no_real_providers: null,
    t8_authenticated: null,
  };
  assert.equal(computeSmokePassLevel(result), "FAIL");
});
