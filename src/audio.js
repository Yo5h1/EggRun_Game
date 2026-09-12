const NOTE = (midi) => 440 * 2 ** ((midi - 69) / 12);

const BPM = 150;
const SPB = 60 / BPM / 2;

const bass = [
  48, null, 48, null, 48, null, 60, null,
  43, null, 43, null, 43, null, 55, null,
  45, null, 45, null, 45, null, 57, null,
  41, null, 41, null, 41, null, 53, null,
];

const lead = [
  72, null, 76, 79, 84, null, 79, null,
  71, null, 74, 79, 83, null, 79, null,
  69, null, 73, 76, 81, null, 76, null,
  69, null, 72, 76, 81, null, 76, null,
];

let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let musicTimer = 0;
let step = 0;
let nextNoteTime = 0;

function ensure() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function initAudio() {
  ensure();
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 1;
  return muted;
}

function blip(freqA, freqB, dur, type = 'square', vol = 0.18, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freqA), t);
  if (freqB) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.04);
}

export const sfx = {
  jump: () => { ensured(); blip(320, 560, 0.12, 'square', 0.15); },
  doubleJump: () => { ensured(); blip(420, 760, 0.14, 'square', 0.15); },
  duck: () => { ensured(); blip(240, 130, 0.08, 'square', 0.09); },
  coin: () => { ensured(); blip(880, 1250, 0.09, 'square', 0.13); },
  combo: () => { ensured(); blip(660, 990, 0.12, 'triangle', 0.14); },
  power: () => { ensured(); blip(520, 240, 0.2, 'triangle', 0.18); },
  hurt: () => { ensured(); blip(190, 65, 0.35, 'sawtooth', 0.2); },
  record: () => {
    ensured();
    [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.14, 'square', 0.15, i * 0.12));
  },
  start: () => {
    ensured();
    [392, 523, 659].forEach((f, i) => blip(f, f, 0.12, 'square', 0.14, i * 0.09));
  },
};

function ensured() {
  ensure();
}

function note(when, midi, dur, type, vol) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = NOTE(midi);
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g).connect(musicGain);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function scheduleMusic() {
  while (nextNoteTime < ctx.currentTime + 0.12) {
    const b = bass[step];
    const l = lead[step];
    const t = nextNoteTime;
    if (b) note(t, b, 0.16, 'triangle', 0.5);
    if (l) note(t, l, 0.13, 'square', 0.16);
    if (step % 8 === 2) {
      const hat = ctx.createOscillator();
      const hg = ctx.createGain();
      hat.type = 'square';
      hat.frequency.value = 9200;
      hg.gain.setValueAtTime(0.025, t);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      hat.connect(hg).connect(musicGain);
      hat.start(t);
      hat.stop(t + 0.06);
    }
    nextNoteTime += SPB;
    step = (step + 1) % bass.length;
  }
}

export function startMusic() {
  ensure();
  if (musicTimer || !ctx) return;
  step = 0;
  nextNoteTime = ctx.currentTime + 0.05;
  musicTimer = setInterval(scheduleMusic, 30);
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = 0;
  }
}