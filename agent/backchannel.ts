/**
 * Backchannel & Filler Word utilities for VoiceOS agent
 *
 * Backchanneling: injects short listening acknowledgments ("Mhm.", "I see.")
 * while the user speaks continuously for longer than armDelayMs, mimicking
 * natural human active-listening behaviour.
 *
 * Filler detection: identifies transcripts that consist entirely of filler /
 * hedge words so the caller layer can choose to suppress turn-end processing.
 */

import type { voice } from '@livekit/agents';

// Matches strings whose ENTIRE content is filler / hedge words (multi-word ok)
const FILLER_RE =
  /^[\s,.]*(um+|uh+|er+|ah+|hmm*|hm+|mhm+|mm+|like|you know|i mean|basically|literally|so|well|right|okay|ok|yeah|yes|yep|nope|no|uh-huh|mm-hmm|mmhm|gotcha|sure|alright)(\s*[,.]?\s*(um+|uh+|er+|ah+|hmm*|hm+|mhm+|mm+|like|you know|i mean|basically|literally|so|well|right|okay|ok|yeah|yes|yep|nope|no|uh-huh|mm-hmm|mmhm|gotcha|sure|alright))*[\s,.]*$/i;

export function isFillerOnly(text: string): boolean {
  return text.trim().length > 0 && FILLER_RE.test(text.trim());
}

/** Listening acknowledgments rotated in order to feel natural */
const BACKCHANNEL_PHRASES = [
  'Mhm.',
  'I see.',
  'Okay.',
  'Got it.',
  'Right.',
  'Sure, go on.',
  'I understand.',
  'Uh-huh.',
];

type BCState = 'idle' | 'armed' | 'cooldown';

/**
 * Detects when the user has been speaking continuously for longer than
 * armDelayMs and injects a short listening phrase via session.say().
 *
 * Wire-up:
 *   manager.onPartial()  — on every non-final STT event
 *   manager.onFinal()    — on every final STT event (user finished a thought)
 *   manager.destroy()    — on session Close
 */
export class BackchannelManager {
  private state: BCState = 'idle';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private phraseIndex = 0;

  constructor(
    private readonly session: voice.AgentSession,
    /** Silence after this many ms of continuous speech → fire a backchannel */
    private readonly armDelayMs = 3200,
    /** Minimum gap between two backchannel phrases */
    private readonly cooldownMs = 8000,
  ) {}

  onPartial(): void {
    if (this.state === 'idle') {
      this.state = 'armed';
      this.timer = setTimeout(() => this.fire(), this.armDelayMs);
    }
  }

  onFinal(): void {
    this.clearTimer();
    // Keep cooldown state if we already fired — don't reset immediately so
    // we don't fire again on the very next utterance.
    if (this.state !== 'cooldown') this.state = 'idle';
  }

  private fire(): void {
    this.timer = null;
    this.state = 'cooldown';
    const phrase = BACKCHANNEL_PHRASES[this.phraseIndex++ % BACKCHANNEL_PHRASES.length]!;
    // allowInterruptions: false — queued as a low-priority aside; won't cancel
    // the user's pending input or the current conversational turn.
    try {
      this.session.say(phrase, { allowInterruptions: false });
    } catch { /* ignore — session may be closing */ }
    this.timer = setTimeout(() => { this.state = 'idle'; }, this.cooldownMs);
  }

  private clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  destroy(): void {
    this.clearTimer();
  }
}
