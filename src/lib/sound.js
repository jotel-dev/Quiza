// Web Audio API Audio & Haptic Feedback Engine for Quiza

let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("quiza_muted") === "true";
}

export function toggleMute() {
  const current = isMuted();
  const next = !current;
  localStorage.setItem("quiza_muted", next ? "true" : "false");
  return next;
}

/** Triggers device vibration (haptic feedback) on supported MiniApp / browser environments */
export function triggerHaptic(type = "tap") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;

  try {
    if (type === "error" || type === "incorrect") {
      // Distinct double pulse for incorrect answer or timeout
      navigator.vibrate([20, 40, 20]);
    } else if (type === "success" || type === "chaching") {
      // Light double pulse for payout success
      navigator.vibrate([15, 30, 15]);
    } else {
      // Short single tap
      navigator.vibrate(10);
    }
  } catch {
    // ignore restricted vibration policy errors
  }
}

/** Synthesizes a crisp, satisfying "pop" sound when selecting an answer option */
export function playPop() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Rapid pitch sweep upwards for a popping bubble effect
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.05);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // ignore Web Audio errors
  }
}

/** Synthesizes a short ticking sound when quiz timer is running low (<= 5s) */
export function playTick() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  } catch {
    // ignore
  }
}

/** Synthesizes a celebratory "cha-ching" register / coin chime sound on payout confirmation */
export function playChaChing() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Two rapid metallic chimes (E6: ~1318Hz, B6: ~1975Hz)
    const notes = [
      { freq: 1318.51, delay: 0, duration: 0.18 },
      { freq: 1975.53, delay: 0.09, duration: 0.35 }
    ];

    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      gain.gain.setValueAtTime(0.35, now + n.delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.duration);
    });

    triggerHaptic("chaching");
  } catch {
    // ignore
  }
}
