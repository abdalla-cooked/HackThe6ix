// Possession, corruption, spread, hopping, lost files, bosses and the cauldron banish.
import { ASSETS, spriteEl } from './assets.js';
import { fx } from './fx.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const SPREAD_AT = 60;

export class Infection {
  constructor({ fs, desktop, gemma, bus }) {
    Object.assign(this, { fs, desktop, gemma, bus });
    this.cfg = { rate: 0, spreadDelay: 0 };
    this.flights = [];
    this.tendrils = [];
    this.frozenFor = 0;
    desktop.onCauldronDrop = node => this.banish(node);
    fx.addLayer((ctx, now) => this.drawTendrils(ctx, now));
  }

  reset(cfg) {
    this.cfg = cfg;
    for (const f of this.flights) { f.anim.cancel(); f.el.remove(); }
    this.flights = [];
    this.tendrils = [];
    this.thaw();
  }

  get frozen() { return this.frozenFor > 0; }

  // Freeze spell: corruption, hops, spreading and demons in flight all stop.
  freeze(seconds) {
    this.frozenFor = seconds;
    for (const f of this.flights) f.anim.pause();
    this.desktop.el.classList.add('frozen');
  }

  thaw() {
    this.frozenFor = 0;
    for (const f of this.flights) f.anim.play();
    this.desktop.el.classList.remove('frozen');
  }

  // Fireball: demons still in the air burn up before they land.
  burnFlights() {
    for (const f of this.flights) {
      const r = f.el.getBoundingClientRect();
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, { color: '#ff8a2a', n: 40, speed: 300 });
      f.anim.cancel();
      f.el.remove();
      f.node.reserved = false;
    }
    this.flights = [];
    for (const t of this.tendrils) { const dst = this.fs.find(t.to); if (dst) dst.reserved = false; }
    this.tendrils = [];
  }

  activeCount() {
    return this.fs.byState('infected').length + this.flights.length;
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
    if (!monster) monster = this.cfg.tutorial ? ASSETS.monsters[0] : pick(ASSETS.monsters);
    const info = { monster, name: name || '???', taunt: taunt || '', corruption: 0, spreadStarted: false, hopIn: this.cfg.hop || 0 };
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
    info.since = performance.now();
    const c = this.desktop.centerOf(node.id);
    if (c) fx.burst(c.x, c.y, { color: '#6dff6d', n: 30 });
    this.fs.emit();
    this.bus.emit('possess', node);
    if (info.taunt) this.announce(node);
  }

  announce(node) {
    this.desktop.say(node.id, `${node.inf.name}: "${node.inf.taunt}"`, 5000);
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
    if (this.frozenFor > 0) {
      this.frozenFor -= dt;
      if (this.frozenFor <= 0) { this.thaw(); this.bus.emit('thaw'); }
      return;
    }
    // Glowing trail behind demons in flight.
    for (const f of this.flights) {
      const r = f.el.getBoundingClientRect();
      if (r.width) fx.trail(r.left + r.width / 2, r.top + r.height / 2, Math.random() < 0.5 ? '#6dff6d' : '#b48cff');
    }
    for (const node of this.fs.byState('infected')) {
      const inf = node.inf;
      const rate = node.boss ? this.cfg.rate * 0.6 : this.cfg.rate;
      inf.corruption = Math.min(100, inf.corruption + rate * dt);
      this.desktop.setInfection(node);
      // Possessed files hop away when you are too slow to grab them.
      // Hovering over a file holds it still, so a hop never snatches it from your hand.
      const held = this.desktop.drag?.id === node.id || this.desktop.hovered?.dataset.id === String(node.id);
      if (inf.hopIn > 0 && !held && this.fs.parentOf(node.id)?.id === 0) {
        inf.hopIn -= dt;
        if (inf.hopIn <= 0) { this.hop(node); inf.hopIn = this.cfg.hop; }
      }
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
      if (!src || src.state === 'clean') { t.dead = true; dst.reserved = false; continue; }
      t.t += dt / t.dur;
      if (t.t >= 1) {
        t.dead = true;
        dst.reserved = false;
        if (dst.state === 'clean') {
          this.possess({ node: dst, monster: t.monster === ASSETS.boss ? pick(ASSETS.monsters) : t.monster, from: this.desktop.centerOf(src.id) });
          this.bus.emit('spread', dst);
        }
      }
    }
    this.tendrils = this.tendrils.filter(t => !t.dead);
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

  hop(node) {
    const from = this.desktop.centerOf(node.id);
    node.pos = this.desktop.freeSpot();
    this.fs.emit();
    const to = this.desktop.centerOf(node.id);
    if (from) fx.burst(from.x, from.y, { color: '#b48cff', n: 18, speed: 160 });
    if (to) fx.burst(to.x, to.y, { color: '#6dff6d', n: 18, speed: 160 });
    this.desktop.hopAnim(node.id);
    this.bus.emit('hop', node);
  }

  // Dropping a possessed file into the cauldron banishes its demon. A spell
  // banishes it where it stands instead: pass `at` and `spell`.
  banish(node, { at, spell } = {}) {
    if (node.state !== 'infected') {
      if (!spell) this.bus.emit('clean-in-cauldron', node);
      return false;
    }
    const info = node.inf;
    const c = at || this.desktop.cauldronCenter();
    const lift = spell ? 70 : 230;
    if (spell) {
      fx.burst(c.x, c.y, { color: '#ff8a2a', n: 50, speed: 380, size: 6, gravity: -120 });
      fx.burst(c.x, c.y, { color: '#ffe46b', n: 25, speed: 240 });
      fx.ring(c.x, c.y, '#ff8a2a', 120);
    } else {
      this.boom(c, info.monster, node.boss ? 1.6 : 1);
    }
    if (node.boss && --node.bossHp > 0) {
      // The boss survives the first hits and leaps back out of the brew.
      info.corruption = Math.max(0, info.corruption - 35);
      info.hopIn = this.cfg.hop || 5;
      node.pos = this.desktop.freeSpot();
      this.fs.emit();
      this.desktop.hopAnim(node.id);
      fx.text(c.x, c.y - lift, `${node.bossHp} more hit${node.bossHp > 1 ? 's' : ''}!`, '#ffd36b', 46);
      this.bus.emit('boss-hit', node);
      return true;
    }
    node.state = 'clean';
    node.inf = null;
    fx.text(c.x, c.y - lift, node.boss ? 'BOSS BANISHED!' : 'BANISHED!', '#f3eaff', node.boss ? 76 : spell ? 36 : 64);
    this.fs.emit();
    this.desktop.materialize([node.id]);
    this.bus.emit('banished', { node, name: info.name, ms: performance.now() - (info.since || performance.now()), spell: !!spell });
    return true;
  }

  // Green fire, shockwave, screen shake and the demon screaming out of the pot.
  boom(c, monster, scale) {
    fx.burst(c.x, c.y - 30, { color: '#6dff6d', n: 90 * scale, speed: 520 * scale, size: 7, gravity: 200 });
    fx.burst(c.x, c.y - 30, { color: '#ff8a2a', n: 50 * scale, speed: 380 * scale, size: 6, gravity: -260, life: 1.2 });
    fx.burst(c.x, c.y - 30, { color: '#b48cff', n: 40 * scale, speed: 300 * scale, size: 4 });
    fx.ring(c.x, c.y - 30, '#6dff6d', 260 * scale);
    fx.flash('rgba(109, 255, 109, 0.35)');
    fx.shake(this.desktop.el, scale > 1 ? 700 : 450);
    const el = document.createElement('div');
    el.className = 'flyer banished';
    el.append(spriteEl(monster, 'flyer-sprite'));
    document.body.append(el);
    const tf = (y, s, r) => `translate(${c.x}px, ${y}px) translate(-50%, -50%) scale(${s}) rotate(${r}deg)`;
    el.animate([
      { transform: tf(c.y, 0.4, 0), opacity: 1 },
      { transform: tf(c.y - 160, 2.2, -20), opacity: 1, offset: 0.35 },
      { transform: tf(c.y - 320, 3, 40), opacity: 0 },
    ], { duration: 1100, easing: 'ease-out' }).finished.then(() => el.remove(), () => el.remove());
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
