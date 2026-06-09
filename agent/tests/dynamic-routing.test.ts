/**
 * Unit tests: Dynamic prompt routing + template compiler (Fase 10)
 *
 * Tests the pure compileSystemPrompt(), buildSystemVariables(), and
 * extractMetadataVars() functions plus stubbed _resolveRoutingContext
 * integration scenarios.
 *
 * Run with: pnpm tsx agent/tests/dynamic-routing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compileSystemPrompt,
  buildSystemVariables,
  extractMetadataVars,
  type PromptVariables,
} from "../../lib/prompts/compiler.js";

// ── compileSystemPrompt ───────────────────────────────────────────────────────

test("compileSystemPrompt: replaces a single variable", () => {
  const result = compileSystemPrompt("Hello {{name}}!", { name: "María" });
  assert.equal(result, "Hello María!");
});

test("compileSystemPrompt: replaces multiple variables", () => {
  const result = compileSystemPrompt("Branch: {{branch}}, City: {{city}}", {
    branch: "Norte",
    city: "Monterrey",
  });
  assert.equal(result, "Branch: Norte, City: Monterrey");
});

test("compileSystemPrompt: leaves unresolved tags intact", () => {
  const result = compileSystemPrompt("Hello {{name}}, your id is {{id}}", {
    name: "Carlos",
  });
  assert.equal(result, "Hello Carlos, your id is {{id}}");
});

test("compileSystemPrompt: empty variables leaves all tags intact", () => {
  const template = "Hi {{agent_name}} from {{branch}}";
  assert.equal(compileSystemPrompt(template, {}), template);
});

test("compileSystemPrompt: empty template returns empty string", () => {
  assert.equal(compileSystemPrompt("", { name: "x" }), "");
});

test("compileSystemPrompt: handles special characters in values", () => {
  const result = compileSystemPrompt("{{msg}}", {
    msg: "¡Hola! Somos #1 en México.",
  });
  assert.equal(result, "¡Hola! Somos #1 en México.");
});

test("compileSystemPrompt: does not mutate original string (immutable)", () => {
  const template = "Hi {{name}}";
  const original = template;
  compileSystemPrompt(template, { name: "test" });
  assert.equal(template, original);
});

test("compileSystemPrompt: tags with hyphens or spaces are left unchanged", () => {
  // {{foo-bar}} has a hyphen — \w+ only matches [a-zA-Z0-9_]
  const template = "{{foo-bar}} {{foo bar}} {{valid}}";
  const result = compileSystemPrompt(template, { valid: "ok" });
  assert.equal(result, "{{foo-bar}} {{foo bar}} ok");
});

test("compileSystemPrompt: variable value can be empty string", () => {
  const result = compileSystemPrompt("Hello {{title}} {{name}}", {
    title: "",
    name: "Ana",
  });
  assert.equal(result, "Hello  Ana");
});

test("compileSystemPrompt: same key appears multiple times — all replaced", () => {
  const result = compileSystemPrompt("{{x}} and {{x}} again", { x: "YES" });
  assert.equal(result, "YES and YES again");
});

// ── buildSystemVariables ──────────────────────────────────────────────────────

test("buildSystemVariables: contains current_date key", () => {
  const vars = buildSystemVariables();
  assert.ok(
    "current_date" in vars,
    "current_date must be present in system vars",
  );
  assert.ok(
    typeof vars["current_date"] === "string" &&
      vars["current_date"]!.length > 0,
    "current_date must be a non-empty string",
  );
});

test("buildSystemVariables: contains current_time, current_datetime, current_year, current_month, current_day", () => {
  const vars = buildSystemVariables();
  for (const key of [
    "current_time",
    "current_datetime",
    "current_year",
    "current_month",
    "current_day",
  ]) {
    assert.ok(key in vars, `${key} must be present`);
    assert.ok(typeof vars[key] === "string" && vars[key]!.length > 0);
  }
});

test("buildSystemVariables: current_year matches real year", () => {
  const vars = buildSystemVariables();
  assert.equal(vars["current_year"], String(new Date().getFullYear()));
});

test("buildSystemVariables: extra vars are merged and override defaults", () => {
  const extra: PromptVariables = { branch: "Sur", current_year: "9999" };
  const vars = buildSystemVariables(extra);
  assert.equal(vars["branch"], "Sur");
  assert.equal(
    vars["current_year"],
    "9999",
    "extra vars must override defaults",
  );
});

test("buildSystemVariables: no extra vars — result still has all system keys", () => {
  const vars = buildSystemVariables(undefined);
  assert.ok("current_date" in vars);
  assert.ok("current_time" in vars);
});

test("buildSystemVariables: result integrates with compileSystemPrompt", () => {
  const vars = buildSystemVariables({ agent_name: "Sofía" });
  const prompt = "I am {{agent_name}}, today is {{current_date}}.";
  const result = compileSystemPrompt(prompt, vars);
  assert.ok(!result.includes("{{agent_name}}"), "agent_name must be replaced");
  assert.ok(
    !result.includes("{{current_date}}"),
    "current_date must be replaced",
  );
  assert.ok(result.includes("Sofía"), "value must appear in output");
});

// ── extractMetadataVars ───────────────────────────────────────────────────────

test("extractMetadataVars: extracts string values only", () => {
  const config = {
    branch: "Norte",
    city: "Monterrey",
    priority: 1, // number — skipped
    enabled: true, // boolean — skipped
    tag: null, // null — skipped
  };
  const vars = extractMetadataVars(config as Record<string, unknown>);
  assert.equal(vars["branch"], "Norte");
  assert.equal(vars["city"], "Monterrey");
  assert.ok(!("priority" in vars), "non-string values must be omitted");
  assert.ok(!("enabled" in vars));
  assert.ok(!("tag" in vars));
});

test("extractMetadataVars: null config returns empty object", () => {
  assert.deepEqual(extractMetadataVars(null), {});
});

test("extractMetadataVars: undefined config returns empty object", () => {
  assert.deepEqual(extractMetadataVars(undefined), {});
});

test("extractMetadataVars: empty object returns empty object", () => {
  assert.deepEqual(extractMetadataVars({}), {});
});

test("extractMetadataVars: result integrates with compileSystemPrompt", () => {
  const config = {
    plaza: "Centro",
    campaign: "Verano2025",
    score: 99,
  };
  const vars = extractMetadataVars(config as Record<string, unknown>);
  const compiled = compileSystemPrompt(
    "Plaza: {{plaza}}, Campaign: {{campaign}}, Score: {{score}}",
    vars,
  );
  assert.equal(
    compiled,
    "Plaza: Centro, Campaign: Verano2025, Score: {{score}}",
  );
});

// ── Routing context integration (mock supabase stubs) ─────────────────────────

test("routing: two-number scenario — different metadata_configs produce different prompts", () => {
  // Simulate what _resolveRoutingContext returns for two distinct phone numbers
  const basePrompt =
    "You are an agent for {{branch}} in {{city}}. Today is {{current_date}}.";

  // Number A: branch Norte, city Monterrey
  const phoneAVars = extractMetadataVars({
    branch: "Norte",
    city: "Monterrey",
  });
  const compiledA = compileSystemPrompt(
    basePrompt,
    buildSystemVariables(phoneAVars),
  );

  // Number B: branch Sur, city Guadalajara
  const phoneBVars = extractMetadataVars({
    branch: "Sur",
    city: "Guadalajara",
  });
  const compiledB = compileSystemPrompt(
    basePrompt,
    buildSystemVariables(phoneBVars),
  );

  assert.notEqual(
    compiledA,
    compiledB,
    "different phone vars → different prompts",
  );
  assert.ok(
    compiledA.includes("Norte") && compiledA.includes("Monterrey"),
    "phone A prompt must contain Norte/Monterrey",
  );
  assert.ok(
    compiledB.includes("Sur") && compiledB.includes("Guadalajara"),
    "phone B prompt must contain Sur/Guadalajara",
  );
  // Both prompts must have current_date resolved (no leftover tag)
  assert.ok(
    !compiledA.includes("{{current_date}}"),
    "current_date must be resolved in prompt A",
  );
  assert.ok(
    !compiledB.includes("{{current_date}}"),
    "current_date must be resolved in prompt B",
  );
});

test("routing: fallback when phone not found — only system vars injected", () => {
  // When _resolveRoutingContext returns empty phoneVars (phone not found),
  // only buildSystemVariables() is applied.
  const basePrompt = "Today is {{current_date}}, unknown branch: {{branch}}";
  const sysVars = buildSystemVariables(); // no extra — empty phoneVars case
  const result = compileSystemPrompt(basePrompt, sysVars);

  assert.ok(
    !result.includes("{{current_date}}"),
    "system var current_date must be replaced",
  );
  assert.ok(
    result.includes("{{branch}}"),
    "unresolved branch tag must remain when phone not found",
  );
});

console.log("✓ dynamic-routing tests complete");
