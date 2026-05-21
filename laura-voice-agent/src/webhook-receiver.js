import express from 'express';
import crypto from 'crypto';
import { getLogger } from './logger.js';
import { callsInProgress } from './state.js';
import { updateRow } from './sheets-client.js';
import { transferToCallCenter } from './transfer-router.js';
import { scheduleRetry } from './retry-scheduler.js';

const log = getLogger('WEBHOOK-RCV');

function validateSignature(rawBody, signature) {
  if (!process.env.WEBHOOK_SECRET) return true; // skip if not configured
  if (!signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function createWebhookServer() {
  const app = express();

  // Keep raw body for HMAC validation
  app.use(express.raw({ type: 'application/json' }));

  // ── ElevenLabs conversation lifecycle events ──────────────────────────────
  app.post('/webhook/elevenlabs', async (req, res) => {
    log.info('ElevenLabs webhook received');

    const sig = req.headers['elevenlabs-signature'];
    if (!validateSignature(req.body, sig)) {
      log.warn('Invalid webhook signature — rejected');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let body;
    try {
      body = JSON.parse(req.body.toString());
    } catch {
      log.error('Malformed JSON in webhook body');
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const { conversation_id, status, transcript, analysis } = body;
    log.info(`conv_id=${conversation_id} status=${status} call_successful=${analysis?.call_successful}`);

    res.status(200).json({ ok: true }); // ack immediately

    const entry = callsInProgress.get(conversation_id);
    if (!entry) {
      log.warn(`No active call for conv_id=${conversation_id}`);
      return;
    }

    const { rowIndex, lead } = entry;

    // Determine outcome
    let outcome;
    if (analysis?.call_successful === true) {
      outcome = 'calificado';
    } else if (status === 'no_answer') {
      outcome = 'no_contesta';
    } else if (status === 'rejected') {
      outcome = 'rechazado';
    } else {
      outcome = 'error';
    }

    log.info(`Outcome row=${rowIndex}: ${outcome}`);

    try {
      await updateRow(rowIndex, {
        Estado:          outcome,
        Resultado:       outcome,
        Transcript:      transcript || '',
        Último_Intento:  new Date().toISOString(),
      });
    } catch (err) {
      log.error(`Sheet update failed row=${rowIndex}: ${err.message}`);
    }

    callsInProgress.delete(conversation_id);

    if (outcome === 'calificado') {
      transferToCallCenter(rowIndex, { ...lead, conv_id: conversation_id }).catch(err =>
        log.error(`Transfer failed row=${rowIndex}: ${err.message}`)
      );
    } else if (outcome === 'no_contesta') {
      scheduleRetry(rowIndex, lead, lead.intentos || 0).catch(err =>
        log.error(`scheduleRetry failed row=${rowIndex}: ${err.message}`)
      );
    }
  });

  // ── Laura's transfer_to_agent tool call ───────────────────────────────────
  app.post('/webhook/transfer', async (req, res) => {
    let body;
    try {
      body = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const { conversation_id, qualified } = body;
    log.info(`Transfer webhook: conv_id=${conversation_id} qualified=${qualified}`);

    res.status(200).json({ ok: true }); // ack immediately

    if (!qualified) return;

    const entry = callsInProgress.get(conversation_id);
    if (!entry) {
      log.warn(`No active call for transfer conv_id=${conversation_id}`);
      return;
    }

    const { rowIndex, lead } = entry;
    transferToCallCenter(rowIndex, { ...lead, conv_id: conversation_id }).catch(err =>
      log.error(`Transfer failed row=${rowIndex}: ${err.message}`)
    );
  });

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', activeCalls: callsInProgress.size });
  });

  return app;
}
