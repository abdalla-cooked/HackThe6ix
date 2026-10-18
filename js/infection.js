// Possession, corruption, spread, lost files and the cauldron cleanse ritual.
import { ASSETS, spriteEl } from './assets.js';
import { shapeSVG, SHAPE_LABELS, SPELLS, MATCH_THRESHOLD } from './shapes.js';
import { fx } from './fx.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
export const CLEANSE_SECONDS = 8;
const SPREAD_AT = 60;
const MAX_FAILS = 3;

export class Infection {
  constructor({ fs, desktop, gemma, bus, ritualEl }) {
    Object.assign(this, { fs, desktop, gemma, bus, ritualEl });
    this.cfg = { rate: 0, spreadDelay: 0, shapes: ['line'] };
    this.flights = [];
    this.tendrils = [];
    this.ritual = null;
    desktop.onCauldronDrop = node => this.startCleanse(node);
    bus.on('stroke', r => this.onStroke(r));
    fx.addLayer((ctx, now) => this.drawTendrils(ctx, now));
  }

  reset(cfg) {
    this.cfg = cfg;
    for (const f of this.flights) { f.anim.cancel(); f.el.remove(); }
    this.flights = [];
    this.tendrils = [];
    this.endRitual();
  }

  activeCount() {
    return this.fs.byState('infected').length + this.fs.byState('cleansing').length + this.flights.length;
  }

  candidates(exclude, rootOnly) {
    return this.fs.files().filter(n => n.state === 'clean' && !n.reserved && n.id !== exclude
      && (!rootOnly || this.fs.parentOf(n.id)?.id === 0));
  }

  // Send a demon flying into a clean file. Gemma names it in the background.
  possess({ monster, name, taunt, exclude, rootOnly, from, node } = {}) {
    if (!node) {
      const c = this.candidates(exclude, rootOnly);
      if (!c.length) return false;
      node = pick(c);
    }
    node.reserved = true;
    if (!monster) {
      const allowed = ASSETS.monsters.filter(m => this.cfg.shapes.includes(m.spell));
      monster = pick(allowed.length ? allowed : ASSETS.monsters);
    }
    const info = { monster, shape: monster.spell || pick(this.cfg.shapes), name: name || '???', taunt: taunt || '', corruption: 0, spreadStarted: false };
    if (!name) {
      this.gemma.possession(monster, node).then(r => {
        info.name = r.name;
        info.taunt = r.taunt;
        if (node.inf === info) this.announce(node);
      });
    }

    const to = this.desktop.centerOf(node.id) || { x: innerWidth / 2, y: innerHeight / 2 };
    if (!from) {
      const w = this.desktop.width();
      from = pick([{ x: -60, y: 100 + Math.random() * 300 }, { x: Math.random() * w, y: -60 }, { x: w + 60, y: 100 + Math.random() * 300 }]);
    }
    const mid = { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 300, y: Math.min(from.y, to.y) - 120 };
    const el = document.createElement('div');
    el.className = 'flyer';
    el.append(spriteEl(monster, 'flyer-sprite'));
    document.body.append(el);
    const tf = (p, s) => `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${s})`;
    const anim = el.animate([
      { transform: tf(from, 0.7), opacity: 1 },
      { transform: tf(mid, 1.4), opacity: 1, offset: 0.6 },
      { transform: tf(to, 0.2), opacity: 0.3 },
    ], { duration: 1200, easing: 'ease-in', fill: 'forwards' });
    const flight = { el, anim, node, info };
    this.flights.push(flight);
    anim.finished.then(() => this.land(flight)).catch(() => {});
    return true;
  }

  land(flight) {
    if (!this.flights.includes(flight)) return;
    this.flights = this.flights.filter(f => f !== flight);
    flight.el.remove();
    const { node, info } = flight;
    node.reserved = false;
    if (node.state !== 'clean') return;
    node.state = 'infected';
    node.inf = info;
    const c = this.desktop.centerOf(node.id);
    if (c) fx.burst(c.x, c.y, { color: '#6dff6d', n: 30 });
    this.fs.emit();
    this.bus.emit('possess', node);
    if (info.taunt) this.announce(node);
  }

  announce(node) {
    this.desktop.say(node.id, `${node.inf.name}: "${node.inf.taunt}"`, 5000);
    if (this.ritual?.node === node) this.ritualEl.querySelector('.ritual-name').textContent = node.inf.name;
  }

  nearestClean(node) {
    const c = this.desktop.centerOf(node.id);
    if (!c) return null;
    let best = null, bestD = Infinity;
    for (const n of this.candidates(node.id)) {
      const p = this.desktop.centerOf(n.id);
      if (!p) continue;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  update(dt) {
    for (const node of this.fs.byState('infected')) {
      const inf = node.inf;
      inf.corruption = Math.min(100, inf.corruption + this.cfg.rate * dt);
      this.desktop.setInfection(node);
      if (inf.corruption >= SPREAD_AT && !inf.spreadStarted && this.cfg.spreadDelay > 0) {
        inf.spreadStarted = true;
        const target = this.nearestClean(node);
        if (target) {
          target.reserved = true;
          this.tendrils.push({ from: node.id, to: target.id, t: 0, dur: this.cfg.spreadDelay, monster: inf.monster });
          this.bus.emit('spread-warn', node);
        }
      }
      if (inf.corruption >= 100) this.lose(node);
    }

    for (const t of this.tendrils) {
      const src = this.fs.find(t.from), dst = this.fs.find(t.to);
      if (!src || src.state === 'clean' || src.state === 'cleansing') { t.dead = true; dst.reserved = false; continue; }
      t.t += dt / t.dur;
      if (t.t >= 1) {
        t.dead = true;
        dst.reserved = false;
        if (dst.state === 'clean') {
          this.possess({ node: dst, monster: t.monster, from: this.desktop.centerOf(src.id) });
          this.bus.emit('spread', dst);
        }
      }
    }
    this.tendrils = this.tendrils.filter(t => !t.dead);

    if (this.ritual) {
      this.ritual.time -= dt;
      const left = Math.max(0, this.ritual.time / CLEANSE_SECONDS);
      this.ritualEl.querySelector('.ritual-timer circle').style.strokeDashoffset = `${100 - left * 100}`;
      this.ritualEl.classList.toggle('hurry', left < 0.35);
      if (this.ritual.time <= 0) this.failCleanse('timeout');
    }
  }

  lose(node) {
    const c = this.desktop.centerOf(node.id);
    node.state = 'lost';
    node.inf = null;
    if (c) fx.burst(c.x, c.y, { color: '#8a8a8a', n: 40, gravity: 120 });
    this.fs.emit();
    this.bus.emit('lost', node);
  }

  scream() {
    for (const n of this.fs.byState('infected')) n.inf.corruption = Math.max(0, n.inf.corruption - 10);
  }

  // ---- cauldron ritual ----
  startCleanse(node) {
    if (node.state !== 'infected') { this.bus.emit('clean-in-cauldron', node); return false; }
    if (this.ritual) { this.bus.emit('cauldron-busy', node); return false; }
    node.state = 'cleansing';
    this.desktop.showInCauldron(node);
    this.ritual = { node, time: CLEANSE_SECONDS, fails: 0, started: performance.now() };
    const el = this.ritualEl;
    el.querySelector('.ritual-demon').replaceChildren(spriteEl(node.inf.monster, 'ritual-sprite'));
    el.querySelector('.ritual-glyph').innerHTML = shapeSVG(node.inf.shape, 'glyph-svg big', { trace: true });
    el.querySelector('.ritual-name').textContent = node.inf.name;
    el.querySelector('.ritual-spell').textContent = `${node.inf.monster.label} demon`;
    el.querySelector('.ritual-hint').innerHTML =
      `Point one finger and draw a <b>${SHAPE_LABELS[node.inf.shape].toUpperCase()}</b> (${SPELLS[node.inf.shape]})`;
    el.hidden = false;
    el.classList.remove('hurry');
    this.fs.emit();
    this.bus.emit('cleanse-start', node);
    return true;
  }

  onStroke(r) {
    if (!this.ritual) return;
    const { node } = this.ritual;
    const want = node.inf.shape;
    const pct = Math.round(r.score * 100);
    this.bus.emit('attempt', { node, result: r });
    if (r.name === want && r.score >= MATCH_THRESHOLD) {
      fx.text(r.center.x, r.center.y, `${SHAPE_LABELS[r.name]} ${pct}%`, '#6dff6d');
      this.succeed(r);
      return;
    }
    this.ritual.fails++;
    fx.text(r.center.x, r.center.y, `${SHAPE_LABELS[r.name]} ${pct}%`, '#ff6b6b');
    this.bus.emit('wrong-shape', { node, result: r, want, fails: this.ritual.fails });
    if (this.ritual.fails >= MAX_FAILS) this.failCleanse('fails');
  }

  succeed(r) {
    const { node, started } = this.ritual;
    const info = node.inf;
    const c = this.desktop.cauldronCenter();
    fx.burst(c.x, c.y - 120, { color: '#b48cff', n: 60, speed: 380 });
    fx.burst(c.x, c.y - 120, { color: '#6dff6d', n: 40, speed: 260 });
    fx.text(c.x, c.y - 200, 'Banished!', '#f3eaff', 44);
    node.state = 'clean';
    node.inf = null;
    this.endRitual();
    this.fs.emit();
    this.desktop.materialize([node.id]);
    this.bus.emit('banished', { node, name: info.name, score: r.score, ms: performance.now() - started });
  }

  failCleanse(reason) {
    const { node } = this.ritual;
    const info = node.inf;
    node.state = 'clean';
    node.inf = null;
    node.health = Math.max(0, node.health - 20);
    this.endRitual();
    this.fs.emit();
    const from = this.desktop.cauldronCenter();
    const ok = this.possess({ monster: info.monster, name: info.name, taunt: info.taunt, exclude: node.id, from });
    if (!ok) this.possess({ node, monster: info.monster, name: info.name, taunt: info.taunt, from });
    this.bus.emit('escape', { node, name: info.name, reason });
  }

  endRitual() {
    this.ritual = null;
    this.ritualEl.hidden = true;
    this.desktop.showInCauldron(null);
  }

  drawTendrils(ctx, now) {
    if (!this.tendrils.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = '#6dff6d';
    ctx.shadowBlur = 14;
    for (const t of this.tendrils) {
      const a = this.desktop.centerOf(t.from), b = this.desktop.centerOf(t.to);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const steps = 40, end = Math.floor(steps * t.t);
      ctx.strokeStyle = 'rgba(109, 255, 109, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      let hx = a.x, hy = a.y;
      for (let i = 0; i <= end; i++) {
        const f = i / steps;
        const wob = Math.sin(i * 0.7 + now / 140) * 10 * Math.sin(f * Math.PI);
        hx = a.x + dx * f + nx * wob;
        hy = a.y + dy * f + ny * wob;
        i ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy);
      }
      ctx.stroke();
      ctx.fillStyle = '#b6ffb0';
      ctx.beginPath();
      ctx.arc(hx, hy, 6 + Math.sin(now / 90) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
