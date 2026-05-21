import { google } from 'googleapis';
import { getLogger } from './logger.js';

const log = getLogger('SHEETS-CLIENT');

// A=Nombre B=Teléfono C=Email D=Estado E=Conv_ID F=Intentos G=Último_Intento H=Resultado I=Transcript
const COL = {
  Nombre: 'A', Teléfono: 'B', Email: 'C', Estado: 'D',
  Conv_ID: 'E', Intentos: 'F', Último_Intento: 'G', Resultado: 'H', Transcript: 'I',
};

const SHEET_NAME = 'Leads';

let client = null;

export async function initSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  client = google.sheets({ version: 'v4', auth });
  log.info('Google Sheets client initialized');
  return client;
}

export function getSheetsClient() {
  return client;
}

async function writeCell(rowIndex, col, value, retries = 1) {
  const range = `${SHEET_NAME}!${col}${rowIndex}`;
  try {
    await client.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [[value]] },
    });
  } catch (err) {
    if (retries > 0) {
      log.warn(`Sheet write retry for ${range} in 5s: ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
      return writeCell(rowIndex, col, value, 0);
    }
    log.error(`Sheet write failed permanently for ${range}: ${err.message}`);
    throw err;
  }
}

export async function updateRow(rowIndex, fields) {
  for (const [field, value] of Object.entries(fields)) {
    const col = COL[field];
    if (!col) { log.warn(`Unknown field: ${field}`); continue; }
    await writeCell(rowIndex, col, String(value ?? ''));
  }
  log.info(`Row ${rowIndex} updated: ${JSON.stringify(fields)}`);
}

export async function getRows() {
  const res = await client.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:I`,
  });
  return res.data.values || [];
}
