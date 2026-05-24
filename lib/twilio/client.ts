const BASE = 'https://api.twilio.com/2010-04-01';

function authHeader() {
  const sid = process.env['TWILIO_ACCOUNT_SID']!;
  const token = process.env['TWILIO_AUTH_TOKEN']!;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

async function request<T>(method: string, path: string, body?: URLSearchParams): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body?.toString()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

const SID = process.env['TWILIO_ACCOUNT_SID'] ?? '';

export interface TwilioNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  country_code: string;
  status: string;
}

export const SUPPORTED_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'CO', name: 'Colombia' },
  { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Peru' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'HN', name: 'Honduras' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'ES', name: 'Spain' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }
];

export const twilio = {
  async listNumbers(): Promise<{ incoming_phone_numbers: TwilioNumber[] }> {
    return request('GET', `/Accounts/${SID}/IncomingPhoneNumbers.json`);
  },

  async searchAvailable(countryCode: string): Promise<{ available_phone_numbers: TwilioNumber[] }> {
    return request('GET', `/Accounts/${SID}/AvailablePhoneNumbers/${countryCode}/Local.json?SmsEnabled=true&VoiceEnabled=true`);
  },

  async provisionNumber(phoneNumber: string): Promise<TwilioNumber> {
    const body = new URLSearchParams({
      PhoneNumber: phoneNumber,
      FriendlyName: 'VoiceOS Number'
    });
    return request('POST', `/Accounts/${SID}/IncomingPhoneNumbers.json`, body);
  },

  async releaseNumber(sid: string): Promise<void> {
    await fetch(`${BASE}/Accounts/${SID}/IncomingPhoneNumbers/${sid}.json`, {
      method: 'DELETE',
      headers: { Authorization: authHeader() }
    });
  },

  async sendSMS(to: string, body: string): Promise<{ sid: string }> {
    const params = new URLSearchParams({
      To: to,
      From: process.env['TWILIO_PHONE_NUMBER'] ?? '',
      Body: body
    });
    return request('POST', `/Accounts/${SID}/Messages.json`, params);
  }
};
