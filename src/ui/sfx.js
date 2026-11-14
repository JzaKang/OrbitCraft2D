// Retro sound effects synthesised with WebAudio (no audio files needed).
// The AudioContext is created on first use, after a user gesture, to satisfy autoplay rules.

import { loadPref, savePref } from './progress.js';

let ctx = null;
let muted = loadPref('muted', false);

function ac() {
  if (muted || typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, to = null, dur = 0.08, type = 'square', vol = 0.05, delay = 0 }) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.5, vol = 0.1, freq = 800, delay = 0 }) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  hover: () => tone({ freq: 1200, dur: 0.025, vol: 0.015 }),
  click: () => tone({ freq: 520, to: 860, dur: 0.07, vol: 0.04 }),
  place: () => { tone({ freq: 330, dur: 0.05, vol: 0.05 }); tone({ freq: 660, dur: 0.07, vol: 0.04, delay: 0.05 }); },
  remove: () => tone({ freq: 500, to: 140, dur: 0.12, type: 'sawtooth', vol: 0.03 }),
  error: () => { tone({ freq: 180, dur: 0.1, vol: 0.05 }); tone({ freq: 140, dur: 0.14, vol: 0.05, delay: 0.1 }); },
  countdown: () => tone({ freq: 880, dur: 0.1, type: 'sine', vol: 0.06 }),
  launch: () => noise({ dur: 3.5, vol: 0.16, freq: 400 }),
  separation: () => { noise({ dur: 0.25, vol: 0.12, freq: 2000 }); tone({ freq: 200, to: 80, dur: 0.2, vol: 0.04 }); },
  explode: () => noise({ dur: 1.2, vol: 0.25, freq: 600 }),
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, vol: 0.05, delay: i * 0.12 })),
  fail: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.2, vol: 0.05, type: 'triangle', delay: i * 0.15 })),
  blip: () => tone({ freq: 1400, dur: 0.04, type: 'sine', vol: 0.03 }),
  isMuted: () => muted,
  toggleMute() {
    muted = !muted;
    savePref('muted', muted);
    if (!muted) sfx.click();
    return muted;
  },
};
