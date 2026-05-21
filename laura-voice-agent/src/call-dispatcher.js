import axios from 'axios';
import { getLogger } from './logger.js';
import { updateRow } from './sheets-client.js';
import { callsInProgress } from './state.js';

const log = getLogger('CALL-DISPATCHER');

const OUTBOUND_URL = 'https://api.elevenlabs.io/v1/convai/conversations/outbound';

export async function dispatchCall(lead) {
  const { rowIndex, nombre, telefono, email } = lead;
  log.info(`Dispatching call → ${nombre} (${telefono}) row=${rowIndex}`);

  try {
    const { data } = await axios.post(
      OUTBOUND_URL,
      {
        agent_id: process.env.ELEVENLABS_AGENT_ID,
        customer: { phone_number: telefono, name: nombre },
        conversation_initiation_client_data: {
          dynamic_variables: { nombre, telefono },
        },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const convId = data?.conversation_id;
    if (!convId) throw new Error('Missing conversation_id in ElevenLabs response');

    log.info(`Call dispatched: conv_id=${convId} row=${rowIndex}`);
    callsInProgress.set(convId, { rowIndex, lead });
    await updateRow(rowIndex, { Conv_ID: convId });

    return convId;
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    log.error(`ElevenLabs API error row=${rowIndex}: ${detail}`);

    try {
      await updateRow(rowIndex, {
        Estado: 'error',
        Resultado: `API error: ${err.message}`,
        Último_Intento: new Date().toISOString(),
      });
    } catch (sheetErr) {
      log.error(`Failed to write error state row=${rowIndex}: ${sheetErr.message}`);
    }
  }
}
