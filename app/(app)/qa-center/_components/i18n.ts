export type QacLang = "en" | "es";

export function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function qacLanguageOf(
  params: Record<string, string | string[] | undefined>,
): QacLang {
  return firstParam(params, "lang") === "es" ? "es" : "en";
}

export function qacT(lang: QacLang, en: string, es: string): string {
  return lang === "es" ? es : en;
}

export function qacHref(href: string, lang: QacLang): string {
  if (lang !== "es") return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}lang=es`;
}
