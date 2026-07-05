import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "zh",
  "ja",
  "hi",
  "ko",
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(v: string): v is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

/** Pick the first supported locale from an Accept-Language header. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return "en";
  for (const part of header.split(",")) {
    const code = part.trim().split(";")[0]?.split("-")[0]?.toLowerCase() ?? "";
    if (isSupportedLocale(code)) return code;
  }
  return "en";
}

type Messages = Record<string, unknown>;

/** Deep-merge `override` onto `base` so missing keys fall back to `base` (en). */
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = out[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      b &&
      typeof b === "object" &&
      !Array.isArray(b)
    ) {
      out[k] = deepMerge(b as Messages, v as Messages);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export default getRequestConfig(async () => {
  // Explicit cookie override wins; otherwise fall back to the browser's
  // Accept-Language, then English.
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  let locale: Locale;
  if (cookieLocale && isSupportedLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const hdrs = await headers();
    locale = localeFromAcceptLanguage(hdrs.get("accept-language"));
  }

  // Always merge over the English base so any key missing in a partially
  // translated locale falls back to English instead of rendering the raw key.
  const en = (await import("../messages/en.json")).default as Messages;
  const localeMessages =
    locale === "en"
      ? en
      : ((await import(`../messages/${locale}.json`)).default as Messages);

  return {
    locale,
    messages: deepMerge(en, localeMessages),
  };
});
