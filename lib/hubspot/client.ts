export interface HubSpotContact {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export async function createOrUpdateContact(
  accessToken: string,
  contact: HubSpotContact
): Promise<{ id: string } | null> {
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        firstname: contact.firstName ?? '',
        lastname: contact.lastName ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
      },
    }),
  });

  if (!res.ok) return null;
  return res.json() as Promise<{ id: string }>;
}

export async function logCallEngagement(
  accessToken: string,
  contactId: string,
  callData: { duration_ms: number; outcome: string; transcript?: string; body: string }
): Promise<void> {
  await fetch('https://api.hubapi.com/crm/v3/objects/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        hs_call_duration: callData.duration_ms,
        hs_call_disposition: callData.outcome,
        hs_call_body: callData.body,
        hs_call_status: 'COMPLETED',
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 194 }],
        },
      ],
    }),
  });
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env['HUBSPOT_CLIENT_ID'] ?? '',
      client_secret: process.env['HUBSPOT_CLIENT_SECRET'] ?? '',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}
