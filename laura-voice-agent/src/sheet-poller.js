import { getLogger } from './logger.js';
import { initSheetsClient, updateRow, getRows } from './sheets-client.js';
import { callsInProgress } from './state.js';
import { dispatchCall } from './call-dispatcher.js';

export { updateRow } from './sheets-client.js';

const log = getLogger('SHEET-POLLER');

let pollerInterval = null;

export async function initSheets() {
  return initSheetsClient();
}

async function poll() {
  const maxConcurrent = parseInt(process.env.MAX_CONCURRENT || '3');

  try {
    const rows = await getRows();
    const activeCount = callsInProgress.size;
    let available = maxConcurrent - activeCount;

    if (available <= 0) {
      log.info(`MAX_CONCURRENT (${maxConcurrent}) reached — skipping poll`);
      return;
    }

    for (let i = 0; i < rows.length && available > 0; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // row 1 is the header
      const estado = (row[3] || '').trim();

      if (estado !== 'pendiente') continue;

      const nombre   = row[0] || '';
      const telefono = row[1] || '';
      const email    = row[2] || '';
      const intentos = parseInt(row[5] || '0');

      if (!telefono) {
        log.warn(`Row ${rowIndex} is pendiente but has no phone — skipping`);
        continue;
      }

      log.info(`Locking row ${rowIndex}: ${nombre} (${telefono})`);

      // Lock row before dispatching to prevent duplicate calls
      await updateRow(rowIndex, {
        Estado: 'llamando',
        Último_Intento: new Date().toISOString(),
      });

      dispatchCall({ rowIndex, nombre, telefono, email, intentos }).catch(err => {
        log.error(`dispatchCall failed row=${rowIndex}: ${err.message}`);
      });

      available--;
    }
  } catch (err) {
    log.error(`Poll cycle error: ${err.message}`);
  }
}

export function startPoller() {
  const intervalMs = parseInt(process.env.POLL_INTERVAL_SECONDS || '30') * 1000;
  log.info(`Sheet poller starting — interval=${process.env.POLL_INTERVAL_SECONDS}s`);
  poll(); // immediate first run
  pollerInterval = setInterval(poll, intervalMs);
}

export function stopPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    log.info('Sheet poller stopped');
  }
}
