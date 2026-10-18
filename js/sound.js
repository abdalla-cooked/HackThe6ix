// Every sound is synthesized with Web Audio at runtime, so there are no audio files to license.
// The context starts on the first click (browsers block audio before that).

function readStore(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
function writeStore(key, val) { try { localStorage.setItem(key, val); } catch { /* storage blocked */ } }
const rand = (a, b) => a + Math.random() * (b - a);

// Soft-clipping curve for the screams.
function distortion(k) {
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export const sound = {
  ctx: null,
  master: null,
  muted: readStore('hf_muted') === '1',
  ambient: 0,
  lastScream: 0,
  lastWhisper: 0,

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 4;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.curve = distortion(80);
    this.buildDrone();
  },

  setMuted(m) {
    this.muted = m;
    writeStore('hf_muted', m ? '1' : '0');
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  },

  // 0 = no drone or whispers, 1 = quiet, 2 = full.
  setAmbient(level) {
    this.ambient = level;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime([0, 0.035, 0.07][level], t, 0.8);
    this.windGain.gain.setTargetAtTime([0, 0.02, 0.04][level], t, 0.8);
  },

  // A low detuned drone with a slowly breathing filter, plus wind.
  buildDrone() {
    const ctx = this.ctx;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    lp.Q.value = 7;
    lp.connect(this.droneGain).connect(this.master);
    for (const [type, f] of [['sawtooth', 55], ['sawtooth', 55.6], ['sine', 27.5], ['triangle', 82.4]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 0.07;
    depth.gain.value = 90;
    lfo.connect(depth).connect(lp.frequency);
    lfo.start();

    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.8;
    const wl = ctx.createOscillator(), wd = ctx.createGain();
    wl.frequency.value = 0.11;
    wd.gain.value = 260;
    wl.connect(wd).connect(bp.frequency);
    wl.start();
    src.connect(bp).connect(this.windGain).connect(this.master);
    src.start();
    this.setAmbient(this.ambient);
  },

  env(g, t, peak, attack, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  },

  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 1.2, dur);
    return s;
  },

  // Lub-dub.
  heartbeat(vol = 0.4) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    for (const [dt, k] of [[0, 1], [0.17, 0.7]]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.setValueAtTime(75, t + dt);
      o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.14);
      this.env(g, t + dt, vol * k, 0.008, 0.22);
      o.connect(g).connect(this.master);
      o.start(t + dt);
      o.stop(t + dt + 0.3);
    }
  },

  // Breathy syllables panned somewhere around you.
  whisper(vol = 0.22) {
    if (!this.ctx || !this.ambient) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWhisper < 1.2) return;
    this.lastWhisper = now;
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = rand(-0.9, 0.9);
    pan.connect(this.master);
    let t = now + 0.02;
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const dur = rand(0.08, 0.26);
      const src = this.noiseSrc(t, dur + 0.1);
      const g = this.ctx.createGain();
      this.env(g, t, vol * rand(0.5, 1), 0.03, dur);
      for (const [f, q] of [[rand(500, 900), 6], [rand(1300, 2600), 9], [rand(3000, 4500), 3]]) {
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(f, t);
        bp.frequency.linearRampToValueAtTime(f * rand(0.8, 1.2), t + dur);
        bp.Q.value = q;
        src.connect(bp).connect(g);
      }
      g.connect(pan);
      t += dur + rand(0.02, 0.12);
    }
  },

  // A distorted shriek sliding down, over a low boom. Used when a demon is banished.
  scream(size = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastScream < 0.12) return;
    this.lastScream = now;
    const t = now + 0.01, dur = 0.9 * size;
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.curve;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    this.env(g, t, 0.28, 0.04, dur);
    shaper.connect(bp).connect(g).connect(this.master);
    const vib = this.ctx.createOscillator(), vd = this.ctx.createGain();
    vib.frequency.value = 26;
    vd.gain.value = 70;
    vib.connect(vd);
    vib.start(t);
    vib.stop(t + dur + 0.1);
    const base = rand(560, 760) / size;
    for (const k of [1, 1.41]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * k, t);
      o.frequency.exponentialRampToValueAtTime(base * k * 2, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(base * k * 0.28, t + dur);
      vd.connect(o.frequency);
      o.connect(shaper);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    this.boom(0.5 * size);
  },

  boom(vol = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
    this.env(g, t, vol, 0.01, 0.7);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.8);
  },

  // A cracked bell for a file turned to stone.
  knell(vol = 0.3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    for (const [f, k] of [[98, 1], [196.7, 0.6], [262, 0.35], [353, 0.25], [523, 0.12]]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.value = f;
      this.env(g, t, vol * k, 0.01, 2.6);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 2.8);
    }
    this.boom(vol);
  },

  thunder(delay = 0.35) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.noiseSrc(t, 2.6);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 2.4);
    const g = this.ctx.createGain();
    this.env(g, t, 0.5, 0.04, 2.4);
    src.connect(lp).connect(g).connect(this.master);
  },

  // Flickering mains hum while the lights cut out.
  buzz(dur = 0.7) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let x = 0; x < dur; x += 0.06) g.gain.setValueAtTime(Math.random() < 0.6 ? 0.07 : 0.0001, t + x);
    g.gain.setValueAtTime(0.0001, t + dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 240;
    bp.connect(g).connect(this.master);
    for (const [type, f] of [['sawtooth', 60], ['square', 120]]) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(bp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  },

  // The jump scare: three clashing shrieks with random pitch jumps over a bass slam.
  screech() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime + 0.005, dur = 0.7;
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.curve;
    const g = this.ctx.createGain();
    this.env(g, t, 0.7, 0.008, dur);
    shaper.connect(g).connect(this.master);
    for (const f of [880, 1245, 1760, 2350]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      for (let x = 0; x < dur; x += 0.03) o.frequency.setValueAtTime(f * rand(0.85, 1.25), t + x);
      o.connect(shaper);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const src = this.noiseSrc(t, dur);
    const ng = this.ctx.createGain();
    this.env(ng, t, 0.35, 0.005, dur * 0.6);
    src.connect(ng).connect(this.master);
    // Bass hit: a distorted sub drop and a low thump of noise.
    const sub = this.ctx.createOscillator(), sg = this.ctx.createGain(), sd = this.ctx.createWaveShaper();
    sub.frequency.setValueAtTime(70, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.55);
    sd.curve = this.curve;
    this.env(sg, t, 1, 0.005, 0.6);
    sub.connect(sd).connect(sg).connect(this.master);
    sub.start(t);
    sub.stop(t + 0.7);
    const thump = this.noiseSrc(t, 0.3), lp = this.ctx.createBiquadFilter(), tg = this.ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    this.env(tg, t, 1, 0.003, 0.25);
    thump.connect(lp).connect(tg).connect(this.master);
    this.boom(1);
  },
};
