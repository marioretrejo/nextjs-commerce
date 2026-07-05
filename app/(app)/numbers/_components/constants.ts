/** Helpers, types, and country data for the numbers page. */
import { parsePhoneNumber } from "libphonenumber-js";
import type { PhoneNumber } from "@/lib/supabase/types";

export interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  iso_country: string;
  locality?: string;
  region?: string;
  capabilities?: { voice?: boolean; sms?: boolean };
}

export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e0 - 65 + c.charCodeAt(0)))
    .join("");
}

// Detect country ISO code from a phone number string using libphonenumber-js.
// Handles ambiguous +1 numbers correctly: +1829 → DO, +1787 → PR, etc.
export function phoneToCountryCode(phone: string): string | null {
  if (!phone) return null;
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed?.country ?? null;
  } catch {
    return null;
  }
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  DO: "Dominican Republic",
  PR: "Puerto Rico",
  CU: "Cuba",
  HT: "Haiti",
  JM: "Jamaica",
  TT: "Trinidad & Tobago",
  BB: "Barbados",
  BS: "Bahamas",
  AG: "Antigua",
  DM: "Dominica",
  GD: "Grenada",
  KN: "St. Kitts",
  LC: "St. Lucia",
  VC: "St. Vincent",
  VI: "US Virgin Islands",
  VG: "British Virgin Islands",
  TC: "Turks & Caicos",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  CH: "Switzerland",
  AT: "Austria",
  IE: "Ireland",
  PL: "Poland",
  RU: "Russia",
  UA: "Ukraine",
  TR: "Turkey",
  BR: "Brazil",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  PE: "Peru",
  EC: "Ecuador",
  VE: "Venezuela",
  CR: "Costa Rica",
  PA: "Panama",
  GT: "Guatemala",
  HN: "Honduras",
  SV: "El Salvador",
  NI: "Nicaragua",
  UY: "Uruguay",
  PY: "Paraguay",
  BO: "Bolivia",
  AU: "Australia",
  NZ: "New Zealand",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  IN: "India",
  SG: "Singapore",
  HK: "Hong Kong",
  PH: "Philippines",
  TH: "Thailand",
  MY: "Malaysia",
  ID: "Indonesia",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  EG: "Egypt",
  MA: "Morocco",
  IL: "Israel",
  AE: "UAE",
  SA: "Saudi Arabia",
};

export interface TrunkGroup {
  key: string;
  label: string;
  provider: string;
  numbers: PhoneNumber[];
}

export function groupByTrunk(numbers: PhoneNumber[]): TrunkGroup[] {
  const map = new Map<string, TrunkGroup>();
  for (const num of numbers) {
    let key: string;
    let label: string;
    if (num.provider === "twilio") {
      key = "__twilio__";
      label = "TWILIO";
    } else if (num.provider === "sip_trunk") {
      const trunk = num.display_name ?? num.sip_trunk_uri ?? "SIP TRUNK";
      key = trunk;
      label = `SIP - ${trunk.toUpperCase()}`;
    } else {
      key = num.provider;
      label = num.provider.toUpperCase();
    }
    if (!map.has(key))
      map.set(key, { key, label, provider: num.provider, numbers: [] });
    map.get(key)!.numbers.push(num);
  }
  return Array.from(map.values());
}

export type DialogMode =
  | "choose"
  | "twilio"
  | "sip"
  | "connect-twilio"
  | "connect-sip";

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "MX", name: "Mexico" },
  { code: "CO", name: "Colombia" },
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brazil" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Peru" },
  { code: "EC", name: "Ecuador" },
  { code: "VE", name: "Venezuela" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "SV", name: "El Salvador" },
  { code: "NI", name: "Nicaragua" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panama" },
  { code: "UY", name: "Uruguay" },
  { code: "PY", name: "Paraguay" },
  { code: "BO", name: "Bolivia" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "ES", name: "Spain" },
  { code: "DE", name: "Germany" },
  { code: "DO", name: "Dominican Republic" },
  { code: "PR", name: "Puerto Rico" },
  { code: "CU", name: "Cuba" },
  { code: "HT", name: "Haiti" },
  { code: "JM", name: "Jamaica" },
];
