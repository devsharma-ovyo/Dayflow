/**
 * Web Audio API synthesizer for macOS-styled feedback chimes
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a clean, warm macOS-like glass bell chime
 */
export function playChimeSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // First tone (E6 ~ 1318Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.35);

    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Second harmonic sparkle (B6 ~ 1975Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975.53, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1567.98, now + 0.45);

    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.warn('Audio playback not permitted or unavailable:', err);
  }
}

/**
 * Plays a subtle pop / click for task completion
 */
export function playCompletionSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.15); // A5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}
