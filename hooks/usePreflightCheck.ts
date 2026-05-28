/**
 * usePreflightCheck — WebRTC Pre-Flight Validation Hook
 *
 * Run this BEFORE connecting a user to a LiveKit room.
 * Checks microphone permissions, measures RTT to the LiveKit server,
 * and estimates available bandwidth. Shows a warning if conditions are poor.
 *
 * Usage:
 *   const { status, result, run } = usePreflightCheck({ wsUrl });
 *   useEffect(() => { run(); }, []);
 *   if (status === 'poor') showBandwidthWarning();
 */
'use client';

import { useState, useCallback, useRef } from 'react';

export type PreflightStatus =
  | 'idle'
  | 'checking'
  | 'good'     // RTT < 100ms, mic OK
  | 'fair'     // RTT 100–250ms — usable but user should know
  | 'poor'     // RTT > 250ms or mic denied — show warning
  | 'error';   // Could not complete check

export interface PreflightResult {
  micPermission: 'granted' | 'denied' | 'prompt' | 'error';
  rttMs: number | null;          // Round-trip time to LiveKit server in ms
  estimatedBandwidthKbps: number | null;
  warnings: string[];
  status: PreflightStatus;
}

interface PreflightCheckOptions {
  wsUrl: string;
  /** Bandwidth threshold below which a warning is shown. Default 64kbps (Opus minimum). */
  minBandwidthKbps?: number;
  /** RTT threshold above which quality is flagged as 'poor'. Default 250ms. */
  maxRttMs?: number;
}

export function usePreflightCheck(options: PreflightCheckOptions) {
  const { wsUrl, minBandwidthKbps = 64, maxRttMs = 250 } = options;
  const [status, setStatus] = useState<PreflightStatus>('idle');
  const [result, setResult] = useState<PreflightResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setStatus('checking');
    const warnings: string[] = [];

    // ── 1. Microphone permission ──────────────────────────────────────────────
    let micPermission: PreflightResult['micPermission'] = 'prompt';
    try {
      const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      micPermission = perm.state as PreflightResult['micPermission'];

      if (perm.state === 'denied') {
        warnings.push('Microphone access is blocked. Please allow it in your browser settings.');
      } else if (perm.state === 'prompt') {
        // Actually request access to get the real answer
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          micPermission = 'granted';
        } catch {
          micPermission = 'denied';
          warnings.push('Microphone access was denied. The call cannot proceed without it.');
        }
      }
    } catch {
      micPermission = 'error';
      warnings.push('Could not check microphone permissions.');
    }

    // ── 2. RTT to LiveKit server ──────────────────────────────────────────────
    let rttMs: number | null = null;
    try {
      // Convert wss:// URL to https:// for an HTTP ping
      const pingUrl = wsUrl.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '') + '/';
      const samples: number[] = [];

      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        await fetch(pingUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: abortRef.current?.signal,
          cache: 'no-store',
        }).catch(() => null);
        samples.push(performance.now() - t0);
      }

      // Take the median sample to reduce outlier impact
      samples.sort((a, b) => a - b);
      rttMs = Math.round(samples[Math.floor(samples.length / 2)]! * 100) / 100;

      if (rttMs > maxRttMs) {
        warnings.push(
          `Your connection to the voice server is slow (${rttMs}ms). Call quality may be degraded.`
        );
      } else if (rttMs > 100) {
        warnings.push(`Moderate network latency detected (${rttMs}ms). Call should still work fine.`);
      }
    } catch {
      warnings.push('Could not measure connection latency.');
    }

    // ── 3. Rough bandwidth estimate via navigator.connection ─────────────────
    let estimatedBandwidthKbps: number | null = null;
    try {
      const conn = (navigator as unknown as { connection?: { downlink?: number } }).connection;
      if (conn?.downlink) {
        estimatedBandwidthKbps = conn.downlink * 1000; // Mbps → kbps
        if (estimatedBandwidthKbps < minBandwidthKbps) {
          warnings.push(
            `Low bandwidth detected (~${Math.round(estimatedBandwidthKbps)}kbps). ` +
            'A minimum of 64kbps is recommended for voice calls.'
          );
        }
      }
    } catch { /* non-critical */ }

    // ── Compute final status ──────────────────────────────────────────────────
    let finalStatus: PreflightStatus = 'good';
    if (micPermission === 'denied' || micPermission === 'error') {
      finalStatus = 'poor';
    } else if (rttMs !== null && rttMs > maxRttMs) {
      finalStatus = 'poor';
    } else if (rttMs !== null && rttMs > 100) {
      finalStatus = 'fair';
    } else if (estimatedBandwidthKbps !== null && estimatedBandwidthKbps < minBandwidthKbps) {
      finalStatus = 'poor';
    }

    const checkResult: PreflightResult = {
      micPermission,
      rttMs,
      estimatedBandwidthKbps,
      warnings,
      status: finalStatus,
    };

    setResult(checkResult);
    setStatus(finalStatus);
    return checkResult;
  }, [wsUrl, minBandwidthKbps, maxRttMs]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  return { status, result, run, abort };
}
