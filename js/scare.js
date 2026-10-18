// Atmosphere on top of the cute art: darkness with a light on your hand, red-eyed
// silhouettes, glitching file names, blackouts, a heartbeat and the jump scare.
// Nothing here redraws the Kenney sprites; it only dims, tints and covers them.
import { ASSETS, spriteEl, eyesEl } from './assets.js';
import { sound } from './sound.js';
import { fx } from './fx.js';

function readStore(key) { try { return localStorage.getItem(key); } catch { return null; } }
function writeStore(key, val) { try { localStorage.setItem(key, val); } catch { /* storage blocked */ } }
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export const SCARE_LEVELS = ['Cute', 'Creepy', 'Nightmare'];
const DARK_SCALE = 1 / 3;
const JUMP_MS = 600;
const JUMP_COOLDOWN_MS = 20000;

// Darkness by scare level: how dark the room is and how far your hand's light reaches.
const DARK = {
  1: { game: 0.5, files: 0.3, preview: 0.12, hand: 280 },
  2: { game: 0.88, files: 0.55, preview: 0.2, hand: 175 },
};

const CREEPY_NAMES = ['HELP_ME.txt', 'you_cant_leave.exe', 'BEHIND_YOU.png', 'let_me_out.zip', 'its_inside.doc',
  'dont_turn_around.mp3', 'IM_STILL_HERE.log', 'no_escape.bat', 'we_see_you.jpg', 'you_are_next.txt',
  'ROT_ROT_ROT.bin', 'open_me.exe', 'it_hurts.wav', 'WAKE_UP.txt'];

const AMBIENT_LINES = [
  'Did you hear that? Something is scratching inside your files.',
  'Do not look at the corner of the screen. Just keep working.',
  'The candles in the crypt below us just went out.',
  'Something is breathing behind the cauldron.',
  'I counted your files. There is one more than before.',
  'They are whispering your name. Do not answer them.',
  'Keep your hand in the light. They hate the light.',
  'That shadow was not there a minute ago.',
];

// Combining marks that make text look like it is crawling.
function zalgo(text, amount) {
  let out = '';
  for (const ch of text) {
    out += ch;
    if (ch !== '.' && Math.random() < amount) out += String.fromCharCode(0x0300 + Math.floor(Math.random() * 0x6f));
  }
  return out;
}

export class Scare {
  constructor({ desktop, fs, bus, mage }) {
    Object.assign(this, { desktop, fs, bus, mage });
    const stored = parseInt(readStore('hf_scare') ?? '2', 10);
    this.level = stored >= 0 && stored <= 2 ? stored : 2;
    this.jumps = readStore('hf_jumps') !== '0';

    this.dark = document.createElement('canvas');
    this.dark.id = 'dark';
    this.dctx = this.dark.getContext('2d');
    this.grain = document.createElement('div');
    this.grain.id = 'grain';
    this.grain.style.backgroundImage = `repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.13) 0 1px, transparent 1px 3px), url(${this.noiseTile()})`;
    this.jump = document.createElement('div');
    this.jump.id = 'jumpscare';
    this.jump.hidden = true;
    document.getElementById('lightning').before(this.dark);
    document.body.append(this.jump, this.grain);
    addEventListener('resize', () => this.resize());
    this.resize();

    this.reveal = 0;
    this.pulse = 0;
    this.dangerNow = 0;
    this.blackout = null;
    this.blackoutIn = rand(18, 30);
    this.ambientIn = rand(25, 40);
    this.whisperIn = rand(15, 30);
    this.glitchIn = rand(8, 15);
    this.beatIn = 1;
    this.lastJump = -Infinity;
    this.flicker = [1, 1, 1, 1];
    this.names = new WeakMap();
    this.setLevel(this.level);
  }

  setLevel(n) {
    this.level = n;
    writeStore('hf_scare', String(n));
    document.body.dataset.scare = n;
    sound.setAmbient(n);
    if (!n) this.dctx.clearRect(0, 0, this.dark.width, this.dark.height);
    if (n < 2) for (const el of this.desktop.els.values()) el.classList.remove('lit');
  }

  setJumps(on) {
    this.jumps = on;
    writeStore('hf_jumps', on ? '1' : '0');
  }

  resize() {
    this.dark.width = Math.ceil(this.desktop.width() * DARK_SCALE);
    this.dark.height = Math.ceil(innerHeight * DARK_SCALE);
  }

  // A 160 px tile of faint static, made once.
  noiseTile() {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 28;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  // Lightning lights up the whole room for a moment.
  lightning() {
    this.reveal = 1;
    if (this.level) sound.thunder();
  }

  // The danger level drives the heartbeat: 0 calm, 1 a file is about to turn to stone.
  danger() {
    let d = 0;
    for (const n of this.fs.byState('infected')) d = Math.max(d, n.inf.corruption / 100 + (n.boss ? 0.2 : 0));
    return Math.min(1, d);
  }

  update(dt, s, { files, playing, preview }) {
    if (!this.level) return;
    const danger = files ? 0 : this.danger();

    // Heartbeat, faster and louder as corruption climbs.
    this.beatIn -= dt;
    if (this.beatIn <= 0) {
      const bpm = files ? 46 : 52 + danger * 88;
      this.beatIn = 60 / bpm;
      const vol = files ? 0.1 : (this.level === 2 ? 0.18 : 0.1) + danger * 0.55;
      sound.heartbeat(vol);
      this.pulse = 1;
    }
    this.pulse = Math.max(0, this.pulse - dt * 3);
    this.dangerNow = danger;

    if (playing && !files) this.ambient(dt);
    if (this.reveal > 0) this.reveal = Math.max(0, this.reveal - dt * 2.2);
    if (this.blackout) {
      this.blackout.t += dt;
      if (this.blackout.t > 0.75) this.blackout = null;
    }
    this.glitchNames(dt, files);
    this.drawDark(dt, s, files, preview);
  }

  // Random events while a level is running.
  ambient(dt) {
    this.whisperIn -= dt;
    if (this.whisperIn <= 0) { sound.whisper(0.16); this.whisperIn = rand(18, 35); }
    this.ambientIn -= dt;
    if (this.ambientIn <= 0 && this.mage.idle) {
      this.mage.say(pick(AMBIENT_LINES), { mood: 'alarm' });
      this.ambientIn = rand(35, 60);
    }
    this.glitchIn -= dt;
    if (this.glitchIn <= 0) { this.glitch(); this.glitchIn = rand(9, 18); }
    if (this.level === 2) {
      this.blackoutIn -= dt;
      if (this.blackoutIn <= 0) {
        this.blackout = { t: 0 };
        sound.buzz(0.75);
        this.glitch();
        this.blackoutIn = rand(22, 40);
      }
    }
  }

  // Lights out for a few flickers. The possessed files keep glowing.
  get lightsOut() {
    if (!this.blackout) return false;
    const t = this.blackout.t;
    return t < 0.08 || (t > 0.14 && t < 0.26) || t > 0.32;
  }

  glitch() {
    document.body.classList.remove('glitch');
    void document.body.offsetWidth;
    document.body.classList.add('glitch');
    setTimeout(() => document.body.classList.remove('glitch'), 260);
  }

  // Possessed file names flicker into creepy ones, and crawl when nearly lost.
  glitchNames(dt, files) {
    if (files) return;
    for (const node of this.fs.byState('infected')) {
      const el = this.desktop.els.get(node.id);
      if (!el?.isConnected) continue;
      const label = el.querySelector('.label');
      let st = this.names.get(node);
      if (!st) { st = { next: rand(1.5, 3), until: 0, fake: pick(CREEPY_NAMES) }; this.names.set(node, st); }
      const inf = node.inf.corruption / 100;
      if (st.until > 0) {
        st.until -= dt;
        if (st.until <= 0) label.textContent = node.name;
        continue;
      }
      if (inf > 0.25) {
        st.next -= dt;
        if (st.next <= 0) {
          label.textContent = st.fake;
          st.until = rand(0.2, 0.45);
          st.next = rand(0.8, 3.5 - inf * 2.5);
          st.fake = pick(CREEPY_NAMES);
          continue;
        }
      }
      if (inf > 0.7) {
        if (!st.z || Math.random() < dt * 4) st.z = zalgo(node.name, (inf - 0.6) * 1.2);
        if (label.textContent !== st.z) label.textContent = st.z;
      } else if (label.textContent !== node.name) {
        label.textContent = node.name;
      }
    }
  }

  // Darkness canvas: dark everywhere except around your hand, the torches,
  // the cauldron and the files the demons are glowing in.
  drawDark(dt, s, files, preview) {
    const cfg = DARK[this.level];
    const ctx = this.dctx, k = DARK_SCALE, W = this.dark.width, H = this.dark.height;
    const out = this.lightsOut;
    let alpha = files ? (preview ? cfg.preview : cfg.files) : cfg.game;
    if (out) alpha = Math.max(alpha, 0.97);
    alpha *= 1 - this.reveal * 0.85;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `rgba(4, 0, 8, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);

    const lights = [];
    const hand = (files ? cfg.hand * 1.6 : cfg.hand) * (1 + Math.sin(performance.now() / 70) * 0.02);
    lights.push({ x: s.x, y: s.y, r: out ? hand * 0.15 : hand, a: 1, core: 0.35 });
    if (!out) {
      const w = this.desktop.width();
      [0.12, 0.37, 0.63, 0.88].forEach((fx, i) => {
        this.flicker[i] += (rand(0.75, 1.15) - this.flicker[i]) * Math.min(1, dt * 12);
        lights.push({ x: w * fx, y: innerHeight * 0.02 + 130, r: 125 * this.flicker[i], a: 0.85 });
      });
      const c = this.desktop.cauldronCenter();
      lights.push({ x: c.x, y: c.y + 40, r: 170, a: 0.9 });
    }
    if (!files) {
      for (const node of this.fs.byState('infected')) {
        const el = this.desktop.els.get(node.id);
        const c = el?.isConnected && this.desktop.centerOf(node.id);
        if (!c) continue;
        const inf = node.inf.corruption / 100;
        const saying = el.classList.contains('saying');
        lights.push({ x: c.x, y: c.y + (saying ? 90 : 0), r: saying ? 210 : 70 + inf * 50, a: saying ? 0.8 : 0.55 + inf * 0.2 });
      }
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const x = l.x * k, y = l.y * k, r = l.r * k;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${l.a})`);
      g.addColorStop(l.core || 0.2, `rgba(0,0,0,${l.a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.drawVignette(ctx, W, H);
    this.markLit(s, alpha < 0.05 || this.reveal > 0.4 ? Infinity : out ? 0 : hand * 0.6);
  }

  // Red-black edges that throb with the heartbeat and redden with danger.
  drawVignette(ctx, W, H) {
    const d = this.dangerNow, p = this.pulse;
    const strength = (this.level === 2 ? 0.85 : 0.6) * (0.82 + p * 0.18);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, `rgba(${80 + d * 120}, 0, 8, ${(0.2 + d * 0.3 + p * 0.1) * strength})`);
    g.addColorStop(1, `rgba(12, 0, 2, ${0.95 * strength})`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // In Nightmare, demons are black shapes with red eyes until your light reaches them.
  markLit(s, radius) {
    if (this.level < 2) return;
    for (const node of this.fs.byState('infected')) {
      const el = this.desktop.els.get(node.id);
      if (!el?.isConnected) continue;
      const c = this.desktop.centerOf(node.id);
      el.classList.toggle('lit', !!c && Math.hypot(c.x - s.x, c.y - s.y) < radius);
    }
  }

  // Full-screen demon with a screech when a file dies. On by default, at most
  // once every 20 s so a chain of deaths does not spam it. Settings turns it off.
  jumpscare(monster) {
    const now = performance.now();
    if (!this.jumps || now - this.lastJump < JUMP_COOLDOWN_MS) return;
    this.lastJump = now;
    const m = monster || pick(ASSETS.monsters);
    const face = document.createElement('div');
    face.className = 'js-face';
    face.append(spriteEl(m, 'js-sprite'), eyesEl(m));
    this.jump.replaceChildren(face);
    this.jump.hidden = false;
    sound.screech();
    this.glitch();
    fx.shake(this.desktop.el, 600, 22);
    clearTimeout(this.jumpTimer);
    this.jumpTimer = setTimeout(() => {
      this.jump.hidden = true;
      fx.flash('rgba(255, 0, 20, 0.6)', 700);
    }, JUMP_MS);
  }
}
