import axios from 'axios';
import { getLogger } from './logger.js';
import { updateRow } from './sheets-client.js';

const log = getLogger('TRANSFER-ROUTER');

export async function transferToCallCenter(rowIndex, leadData) {
  const sipNumber = process.env.SIP_CALLCENTER_NUMBER;
  const convId    = leadData.conv_id || leadData.convId;

  log.info(`Transfer row=${rowIndex} conv_id=${convId} → ${sipNumber} at ${new Date().toISOString()}`);

  try {
    // ElevenLabs SIP transfer endpoint
    await axios.post(
      `https://api.elevenlabs.io/v1/convai/conversations/${convId}/transfer`,
      { phone_number: sipNumber },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    log.info(`Transfer successful row=${rowIndex}`);
    await updateRow(rowIndex, {
      Estado: 'transferido',
      Resultado: `Transferido a ${sipNumber} — ${new Date().toISOString()}`,
    });
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    log.error(`Transfer failed row=${rowIndex}: ${detail}`);

    await updateRow(rowIndex, {
      Estado: 'error',
      Resultado: `Transfer error: ${err.message}`,
    }).catch(sheetErr => log.error(`Sheet write failed: ${sheetErr.message}`));

    throw err;
  }
}
