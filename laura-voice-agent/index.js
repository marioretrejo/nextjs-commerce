import 'dotenv/config';
import { getLogger } from './src/logger.js';
import { initSheets, startPoller, stopPoller } from './src/sheet-poller.js';
import { createWebhookServer } from './src/webhook-receiver.js';
import { startRetryScheduler, stopRetryScheduler } from './src/retry-scheduler.js';
import { callsInProgress } from './src/state.js';

const log = getLogger('MAIN');

process.on('unhandledRejection', (reason) => {
  log.error(`Unhandled rejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
  log.error(`Uncaught exception: ${err.message}\n${err.stack}`);
});

async function shutdown(signal) {
  log.info(`${signal} received — graceful shutdown starting`);
  stopPoller();
  stopRetryScheduler();

  const deadline = Date.now() + 30_000;
  while (callsInProgress.size > 0 && Date.now() < deadline) {
    log.info(`Waiting for ${callsInProgress.size} active call(s)...`);
    await new Promise(r => setTimeout(r, 2000));
  }

  if (callsInProgress.size > 0) {
    log.warn(`Shutdown timeout — ${callsInProgress.size} call(s) still active`);
  }

  log.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

async function main() {
  log.info('════════════════════════════════════════');
  log.info('        Laura Voice Agent v1.0          ');
  log.info('════════════════════════════════════════');
  log.info(`MAX_CONCURRENT:       ${process.env.MAX_CONCURRENT}`);
  log.info(`POLL_INTERVAL_SECONDS:${process.env.POLL_INTERVAL_SECONDS}`);
  log.info(`RETRY_DELAY_MINUTES:  ${process.env.RETRY_DELAY_MINUTES}`);
  log.info(`MAX_RETRIES:          ${process.env.MAX_RETRIES}`);
  log.info(`AGENT_ID:             ${process.env.ELEVENLABS_AGENT_ID}`);

  await initSheets();

  const app  = createWebhookServer();
  const port = parseInt(process.env.WEBHOOK_PORT || '3000');

  await new Promise((resolve, reject) => {
    app.listen(port, resolve).on('error', reject);
  });
  log.info(`Webhook server listening on port ${port}`);

  startRetryScheduler();
  startPoller();

  log.info('Laura Voice Agent ready ✓');
}

main().catch(err => {
  log.error(`Fatal startup error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
