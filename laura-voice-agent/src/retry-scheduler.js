import { getLogger } from './logger.js';
import { updateRow } from './sheets-client.js';
import { dispatchCall } from './call-dispatcher.js';

const log = getLogger('RETRY-SCHED');

// In-memory retry queue — lost on restart (acceptable for v1)
const retryQueue = []; // { rowIndex, lead, attempts, nextRetryAt }

let schedulerInterval = null;

export async function scheduleRetry(rowIndex, lead, currentAttempts) {
  const maxRetries  = parseInt(process.env.MAX_RETRIES || '3');
  const delayMs     = parseInt(process.env.RETRY_DELAY_MINUTES || '120') * 60 * 1000;

  if (currentAttempts >= maxRetries) {
    log.warn(`Row ${rowIndex} exhausted ${maxRetries} retries → agotado`);
    await updateRow(rowIndex, {
      Estado:     'agotado',
      Resultado:  `Máximo de reintentos alcanzado (${maxRetries})`,
    }).catch(err => log.error(`Sheet update failed row=${rowIndex}: ${err.message}`));
    return;
  }

  const nextAttempts = currentAttempts + 1;
  const nextRetryAt  = Date.now() + delayMs;

  retryQueue.push({ rowIndex, lead: { ...lead, intentos: nextAttempts }, attempts: nextAttempts, nextRetryAt });

  await updateRow(rowIndex, {
    Estado:   'pendiente',
    Intentos: nextAttempts,
  }).catch(err => log.error(`Sheet update failed row=${rowIndex}: ${err.message}`));

  log.info(`Row ${rowIndex} retry #${nextAttempts} scheduled at ${new Date(nextRetryAt).toISOString()}`);
}

async function processQueue() {
  const now = Date.now();
  const due = retryQueue.filter(item => item.nextRetryAt <= now);

  for (const item of due) {
    retryQueue.splice(retryQueue.indexOf(item), 1);
    log.info(`Firing retry row=${item.rowIndex} attempt #${item.attempts}`);
    dispatchCall(item.lead).catch(err =>
      log.error(`Retry dispatch failed row=${item.rowIndex}: ${err.message}`)
    );
  }
}

export function startRetryScheduler() {
  log.info('Retry scheduler starting (60s check interval)');
  schedulerInterval = setInterval(processQueue, 60_000);
}

export function stopRetryScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log.info('Retry scheduler stopped');
  }
}
