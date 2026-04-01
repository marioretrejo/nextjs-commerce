import crypto from 'crypto';

export interface ParsedFtd {
  providerSource: string;
  eventType: string;
  businessName: string;
  registrationDate: Date;
  customerName: string;
  amount: number;
  rawCampaignName: string;
  campaignBase: string;
  campaignVariant: string | null;
  country: string;
  finalReferenceName: string | null;
  isSameDay: boolean;
  isDelayedFtd: boolean;
  dedupeHash: string;
}

export interface ParseError {
  error: string;
}

export type ParseResult = ParsedFtd | ParseError;

export function isParseError(r: ParseResult): r is ParseError {
  return 'error' in r;
}

/**
 * Parse a raw FTD text block.
 *
 * Expected format:
 *   <ProviderSource>
 *   FTD
 *   <BusinessName>
 *
 *   Registration Date: MM/DD/YYYY
 *
 *   <CustomerName>
 *   $<Amount>
 *   <CampaignName>
 *   <Country>
 *   <FinalReference>          (optional)
 */
export function parseFtdMessage(
  rawMessage: string,
  today: Date = new Date()
): ParseResult {
  const lines = rawMessage
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 8) {
    return { error: 'Mensaje muy corto. Se esperan al menos 8 líneas.' };
  }

  // Locate "Registration Date:" line
  const regDateLineIdx = lines.findIndex((l) =>
    l.toLowerCase().startsWith('registration date:')
  );
  if (regDateLineIdx === -1) {
    return { error: 'No se encontró "Registration Date:" en el mensaje.' };
  }

  // Lines before registration date → provider, event_type, business_name
  const beforeReg = lines.slice(0, regDateLineIdx);
  if (beforeReg.length < 3) {
    return { error: 'Faltan líneas antes de Registration Date.' };
  }

  const providerSource = beforeReg[0] ?? '';
  const eventType = beforeReg[1] ?? '';
  const businessName = beforeReg[2] ?? '';

  if (eventType.toUpperCase() !== 'FTD') {
    return { error: `Tipo de evento inesperado: "${eventType}". Se esperaba "FTD".` };
  }

  // Parse registration date: MM/DD/YYYY
  const regLine = lines[regDateLineIdx] ?? '';
  const dateMatch = regLine.match(
    /Registration Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i
  );
  if (!dateMatch) {
    return { error: 'Formato de fecha inválido. Se esperaba MM/DD/YYYY.' };
  }

  const month = parseInt(dateMatch[1] ?? '0', 10) - 1; // 0-indexed
  const day = parseInt(dateMatch[2] ?? '0', 10);
  const year = parseInt(dateMatch[3] ?? '0', 10);

  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return { error: 'Fecha inválida en el mensaje.' };
  }

  const registrationDate = new Date(year, month, day, 12, 0, 0); // noon to avoid TZ issues

  // Lines after registration date
  const afterReg = lines.slice(regDateLineIdx + 1);
  if (afterReg.length < 4) {
    return { error: 'Faltan líneas después de Registration Date.' };
  }

  const customerName = afterReg[0] ?? '';

  // Find amount line ($XXX.XX)
  const amountLineIdx = afterReg.findIndex((l) => l.startsWith('$'));
  if (amountLineIdx === -1) {
    return { error: 'No se encontró el monto ($) en el mensaje.' };
  }

  const amountLine = afterReg[amountLineIdx] ?? '';
  const amountMatch = amountLine.match(/\$([0-9,]+(?:\.\d+)?)/);
  const amount = amountMatch ? parseFloat((amountMatch[1] ?? '0').replace(/,/g, '')) : 0;

  const rawCampaignName = afterReg[amountLineIdx + 1]?.trim() ?? '';
  const country = afterReg[amountLineIdx + 2]?.trim() ?? '';
  const finalReferenceName = afterReg[amountLineIdx + 3]?.trim() ?? null;

  if (!rawCampaignName) return { error: 'No se encontró el nombre de campaña.' };
  if (!country) return { error: 'No se encontró el país.' };

  // Derive campaign fields
  const { campaignBase, campaignVariant, isDelayedByPrefix } =
    parseCampaignName(rawCampaignName);

  // Determine same-day vs delayed using DOUBLE validation
  const todayNorm = normDate(today);
  const regDateNorm = normDate(registrationDate);
  const dateIsToday = regDateNorm === todayNorm;

  // is_same_day = registration date IS today (date-only comparison)
  const isSameDay = dateIsToday;

  // is_delayed = has D_ prefix  OR  registration date is NOT today
  const isDelayedFtd = isDelayedByPrefix || !dateIsToday;

  const dedupeHash = buildDedupeHash({
    registrationDate: regDateNorm,
    customerName,
    amount,
    rawCampaignName,
    country
  });

  return {
    providerSource: providerSource as string,
    eventType: eventType as string,
    businessName: businessName as string,
    registrationDate,
    customerName: customerName as string,
    amount,
    rawCampaignName: rawCampaignName as string,
    campaignBase: campaignBase as string,
    campaignVariant,
    country: normalizeCountry(country as string),
    finalReferenceName,
    isSameDay,
    isDelayedFtd,
    dedupeHash
  };
}

function parseCampaignName(raw: string): {
  campaignBase: string;
  campaignVariant: string | null;
  isDelayedByPrefix: boolean;
} {
  let working = raw.trim();
  let isDelayedByPrefix = false;

  // Check for D_ prefix (case-insensitive)
  if (/^d_/i.test(working)) {
    isDelayedByPrefix = true;
    working = working.slice(2).trim();
  }

  // Check for variant suffix: "CampaignName - 6"
  const variantMatch = working.match(/^(.+?)\s*-\s*(\w+)\s*$/);
  if (variantMatch) {
    return {
      campaignBase: (variantMatch[1] ?? working).trim(),
      campaignVariant: (variantMatch[2] ?? '').trim(),
      isDelayedByPrefix
    };
  }

  return {
    campaignBase: working,
    campaignVariant: null,
    isDelayedByPrefix
  };
}

/** Normalize date to YYYY-MM-DD string */
function normDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Normalize country name (trim + title case) */
function normalizeCountry(raw: string): string {
  return raw
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Build a deduplication hash from identifying fields */
function buildDedupeHash(fields: {
  registrationDate: string;
  customerName: string;
  amount: number;
  rawCampaignName: string;
  country: string;
}): string {
  const key = [
    fields.registrationDate,
    fields.customerName.toLowerCase().trim(),
    fields.amount.toFixed(2),
    fields.rawCampaignName.toLowerCase().trim(),
    fields.country.toLowerCase().trim()
  ].join('|');
  return crypto.createHash('sha256').update(key).digest('hex');
}
