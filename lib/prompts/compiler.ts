/**
 * Prompt template compiler — pure functions, importable by both the agent
 * worker and unit tests.
 *
 * Replaces {{placeholder}} tokens in system prompts with resolved values.
 * Unknown tokens are left unchanged (not removed) so the LLM can see what
 * data was expected and ask the caller if necessary.
 */

export type PromptVariables = Record<string, string>;

/**
 * Replaces every {{key}} occurrence in `basePrompt` with the matching value
 * from `variables`. Unrecognised keys are preserved as `{{key}}`.
 *
 * Only word characters (\w+) inside double-braces are matched; tags like
 * {{foo-bar}} or {{foo bar}} are left unchanged.
 */
export function compileSystemPrompt(
  basePrompt: string,
  variables: PromptVariables,
): string {
  if (!basePrompt) return basePrompt;
  return basePrompt.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => variables[key] ?? `{{${key}}}`,
  );
}

/**
 * Returns the set of built-in system variables injected on every call.
 * `extraVars` are merged last and override any built-in key.
 *
 * @param extraVars   Additional variables (e.g. from phone_numbers.metadata_config)
 * @param locale      BCP 47 locale tag for date/time formatting (default es-MX)
 * @param timezone    IANA timezone name (default America/Mexico_City)
 */
export function buildSystemVariables(
  extraVars?: Record<string, string>,
  locale = "es-MX",
  timezone = "America/Mexico_City",
): PromptVariables {
  const now = new Date();
  const fmt = (opts: Intl.DateTimeFormatOptions): string =>
    now.toLocaleString(locale, { timeZone: timezone, ...opts });

  const base: PromptVariables = {
    current_date: fmt({ year: "numeric", month: "long", day: "numeric" }),
    current_time: fmt({ hour: "2-digit", minute: "2-digit" }),
    current_datetime: fmt({
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    current_year: String(now.getFullYear()),
    current_month: fmt({ month: "long" }),
    current_day: fmt({ weekday: "long" }),
  };

  if (extraVars && Object.keys(extraVars).length > 0) {
    return { ...base, ...extraVars };
  }
  return base;
}

/**
 * Extracts string values from a JSONB metadata_config record.
 * Non-string values are silently skipped (the DB schema only stores strings
 * but JSONB can hold anything).
 */
export function extractMetadataVars(
  config: Record<string, unknown> | null | undefined,
): PromptVariables {
  if (!config || typeof config !== "object") return {};
  const result: PromptVariables = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}
