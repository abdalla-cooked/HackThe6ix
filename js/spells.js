// Chained hand signs, ninja style. Fist, Point, Palm, Horns casts a fireball
// that burns every demon on screen; the same signs backwards freeze them all.
import { fx } from './fx.js';

const HAND = {
  fist: '<svg viewBox="0 0 40 40" class="hand"><rect x="9" y="11" width="23" height="23" rx="7"/><path d="M15 11.5v6M21 11.5v6M27 11.5v6" class="crease"/><rect x="6" y="21" width="17" height="6.5" rx="3.2" class="thumbx"/></svg>',
  point: '<svg viewBox="0 0 40 40" class="hand"><rect x="16.5" y="2" width="6" height="20" rx="3"/><rect x="10" y="16" width="21" height="19" rx="7"/><path d="M23 20v5M27.5 20v5" class="crease"/></svg>',
  palm: '<svg viewBox="0 0 40 40" class="hand"><rect x="10" y="7" width="4.5" height="16" rx="2.2"/><rect x="15.5" y="3" width="4.5" height="19" rx="2.2"/><rect x="21" y="4" width="4.5" height="18" rx="2.2"/><rect x="26.5" y="8" width="4.5" height="15" rx="2.2"/><rect x="3" y="18" width="5" height="12" rx="2.5" transform="rotate(-35 6 24)"/><rect x="9" y="17" width="22" height="19" rx="7"/></svg>',
  horns: '<svg viewBox="0 0 40 40" class="hand"><rect x="10" y="3" width="5.5" height="19" rx="2.7" transform="rotate(-10 12.7 15)"/><rect x="25" y="5" width="5.5" height="17" rx="2.7" transform="rotate(10 27.7 15)"/><rect x="9" y="17" width="22" height="18" rx="7"/><path d="M17.5 19v5M22.5 19v5" class="crease"/></svg>',
};

export const SIGNS = [
  { gesture: 'Closed_Fist', label: 'Fist', key: 'F', svg: HAND.fist },
  { gesture: 'Pointing_Up', label: 'Point', key: 'D', svg: HAND.point },
  { gesture: 'Open_Palm', label: 'Palm', key: 'P', svg: HAND.palm },
  { gesture: 'Horns', label: 'Horns', key: 'H', svg: HAND.horns },
];
const LOCK_MS = 400;      // hold each sign this long
const STEP_WINDOW = 2.5;  // seconds to make the next sign
const UNLOCK_LEVEL = 3;
const MANA_PER_BANISH = 25;
const FREEZE_S = 8;
const COLORS = {
  fire: ['#fff7c0', '#ffb340', '#ff5a1a', 'rgba(255, 40, 0, 0)'],
  ice: ['#ffffff', '#d4f4ff', '#6ec8ff', 'rgba(80, 160, 255, 0)'],
};

export class Spells {
  constructor({ fs, desktop, infection, levels, mage, bus }) {
    Object.assign(this, { fs, desktop, infection, levels, mage, bus });
    this.chain = [];
    this.mana = 100;
    this.unlocked = false;
    this.announced = false;
    this.cast = null;
    this.orb = null;
    this.pos = { x: 0, y: 0 };
    this.build();
    fx.addLayer((ctx, now) => this.draw(ctx, now));
    bus.on('level-start', lv => this.onLevel(lv));
    bus.on('banished', ({ spell }) => {
      if (!spell && this.unlocked) this.setMana(this.mana + MANA_PER_BANISH);
    });
    bus.on('thaw', () => {
      this.frost.classList.remove('on');
      this.labelHtml = null;
      this.render(null, 0);
      if (!this.levels.playing) return;
      fx.text(this.desktop.width() / 2, innerHeight * 0.4, 'THAW!', '#9fe0ff', 56);
      this.mage.say('The ice is gone. They are moving again!', { priority: 'high', mood: 'alarm' });
    });
  }

  // ---- DOM: the sign bar, the darkening layer, frost and the mage card ----
  build() {
    const bar = document.createElement('div');
    bar.id = 'chant';
    bar.hidden = true;
    bar.innerHTML = `<div class="chant-row">${SIGNS.map((s, i) =>
      `${i ? '<span class="chant-arrow"></span>' : ''}<div class="sign" data-i="${i}"><span class="sign-ring"></span><span class="gicon">${s.svg}</span><small>${s.label}</small></div>`).join('')}</div>
      <div class="chant-label"><b class="fire-word">Fireball</b> forward, <b class="ice-word">Freeze</b> backward</div>
      <div class="mana"><div class="mana-fill"></div><span class="mana-text"></span></div>`;
    document.body.append(bar);
    this.bar = bar;
    this.signEls = [...bar.querySelectorAll('.sign')];
    this.labelEl = bar.querySelector('.chant-label');
    this.manaFill = bar.querySelector('.mana-fill');
    this.manaText = bar.querySelector('.mana-text');

    this.dim = document.createElement('div');
    this.dim.id = 'dim';
    this.frost = document.createElement('div');
    this.frost.id = 'frost';
    document.body.append(this.dim, this.frost);

    const card = document.createElement('div');
    card.className = 'gcard spellcard';
    card.hidden = true;
    card.innerHTML = `<span class="gicon">${HAND.horns}</span><div><b>Fireball</b><small>Fist, Point, Palm, Horns. Backwards = Freeze</small></div>`;
    document.querySelector('#mage .gestures').append(card);
    this.card = card;
  }

  onLevel(lv) {
    this.reset();
    this.cast = null;
    this.orb = null;
    this.dim.style.opacity = 0;
    this.frost.classList.remove('on');
    this.unlocked = lv.n >= UNLOCK_LEVEL;
    this.bar.hidden = this.card.hidden = !this.unlocked;
    this.setMana(100);
    if (this.unlocked && !this.announced) {
      this.announced = true;
      this.mage.say('New magic unlocked! Chain four hand signs, holding each for half a second: Fist, Point, Palm, Horns. That casts a FIREBALL.', { mood: 'proud' });
      this.mage.say('Do the same signs backwards (Horns, Palm, Point, Fist) to FREEZE every demon for 8 seconds. Each cast needs a full mana bar.', { mood: 'proud' });
    }
  }

  setMana(v) {
    this.mana = Math.max(0, Math.min(100, v));
    this.manaFill.style.width = `${this.mana}%`;
    const left = Math.ceil((100 - this.mana) / MANA_PER_BANISH);
    this.manaText.textContent = this.mana >= 100 ? 'Mana full: cast a spell!' : `Banish ${left} more to recharge`;
    this.bar.classList.toggle('ready', this.mana >= 100);
  }

  get ready() { return this.unlocked && this.levels.playing && this.mana >= 100; }
  get chanting() { return this.chain.length > 0 || !!this.cast; }
  get dir() { return this.chain[0] === 3 ? 'ice' : 'fire'; }

  // Sign indices that would extend the chain right now.
  nextSigns() {
    if (!this.chain.length) return [0, 3];
    return [this.dir === 'fire' ? this.chain.length : 3 - this.chain.length];
  }

  reset(fizzle = false) {
    if (fizzle && this.chain.length >= 2) {
      fx.burst(this.pos.x, this.pos.y, { color: '#8a8a9a', n: 30, speed: 160 });
      fx.text(this.pos.x, this.pos.y - 40, 'fizzle...', '#a99cc4', 30);
    }
    this.chain = [];
    this.render(null, 0);
  }

  // Called every frame with the input state. Returns hold progress for the cursor ring.
  update(s, dt) {
    this.pos = { x: s.x, y: s.y };
    if (this.infection.frozen) this.snow();
    if (this.cast) { this.updateCast(dt); return 0; }
    if (!this.ready) { if (this.chain.length) this.reset(); return 0; }
    const now = performance.now();
    if (this.chain.length && (now - this.lastLock) / 1000 > STEP_WINDOW) { this.reset(true); return 0; }

    const sign = SIGNS.findIndex(x => x.gesture === s.gesture);
    const next = this.nextSigns();
    if (sign < 0 || sign === this.chain.at(-1)) { this.render(null, 0); return 0; }
    const p = Math.min(1, s.gestureMs / LOCK_MS);
    if (!next.includes(sign)) {
      // A clear wrong sign mid-chain breaks it.
      if (this.chain.length && p >= 1) this.reset(true);
      return 0;
    }
    this.render(sign, p);
    if (p >= 1) this.lock(sign);
    return p;
  }

  lock(i) {
    this.chain.push(i);
    this.lastLock = performance.now();
    const color = this.dir === 'fire' ? '#ff8a2a' : '#9fe0ff';
    fx.ring(this.pos.x, this.pos.y, color, 90 + this.chain.length * 30);
    fx.burst(this.pos.x, this.pos.y, { color, n: 20 + this.chain.length * 10, speed: 260 });
    fx.text(this.pos.x, this.pos.y - 60, `${SIGNS[i].label.toUpperCase()}!`, color, 34 + this.chain.length * 6);
    this.render(null, 0);
    if (this.chain.length === SIGNS.length) this.startCast(this.dir);
  }

  render(holding, p) {
    const lit = new Set(this.chain);
    this.bar.classList.toggle('dir-fire', this.chain.length > 0 && this.dir === 'fire');
    this.bar.classList.toggle('dir-ice', this.chain.length > 0 && this.dir === 'ice');
    this.bar.classList.toggle('active', this.chain.length > 0);
    const next = this.ready ? this.nextSigns() : [];
    this.signEls.forEach((el, i) => {
      el.classList.toggle('done', lit.has(i));
      el.classList.toggle('next', this.chain.length > 0 && next.includes(i));
      el.style.setProperty('--p', i === holding ? p.toFixed(3) : 0);
    });
    if (!this.cast) this.dim.style.opacity = Math.min(0.5, this.chain.length * 0.12);
    if (!this.infection.frozen) this.setLabel('<b class="fire-word">Fireball</b> forward, <b class="ice-word">Freeze</b> backward');
  }

  setLabel(html) {
    if (html === this.labelHtml) return;
    this.labelHtml = html;
    this.labelEl.innerHTML = html;
  }

  // ---- casting ----
  startCast(kind) {
    this.cast = { kind, t: 0, fired: false };
    this.chain = [];
    this.setMana(0);
    this.dim.style.opacity = kind === 'fire' ? 0.65 : 0.4;
    this.bus.emit('spell-cast', kind);
    this.mage.say(kind === 'fire' ? 'FIREBALL! Burn, demons, burn!' : 'FREEZE! Now drag them into the cauldron while they are stuck!', { priority: 'high', mood: 'proud' });
  }

  // Sparks pulled in toward a charging orb.
  suck(o, color) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, r = 150 + Math.random() * 90, life = 0.35;
      fx.spark({ x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, vx: -Math.cos(a) * r / life, vy: -Math.sin(a) * r / life, life, size: 2 + Math.random() * 3, color });
    }
  }

  updateCast(dt) {
    const c = this.cast;
    c.t += dt;
    const hand = this.pos;
    if (c.kind === 'fire') {
      const target = { x: this.desktop.width() / 2, y: innerHeight * 0.45 };
      if (c.t < 0.7) {
        this.orb = { x: hand.x, y: hand.y, r: 50 + c.t * 120, kind: 'fire' };
        this.suck(this.orb, Math.random() < 0.5 ? '#ffb340' : '#ff5a1a');
        if (!c.shook) { c.shook = true; fx.shake(this.desktop.el, 700, 6); }
        c.from = { ...hand };
      } else if (c.t < 1.05) {
        const k = (c.t - 0.7) / 0.35, e = k * k;
        this.orb = { x: c.from.x + (target.x - c.from.x) * e, y: c.from.y + (target.y - c.from.y) * e, r: 134 - k * 30, kind: 'fire' };
        fx.burst(this.orb.x, this.orb.y, { color: '#ff8a2a', n: 8, speed: 120, life: 0.5 });
      } else if (!c.fired) {
        c.fired = true;
        this.orb = null;
        this.explode(target);
      } else if (c.t > 1.9) {
        this.cast = null;
        this.dim.style.opacity = 0;
      }
    } else {
      if (c.t < 0.45) {
        this.orb = { x: hand.x, y: hand.y, r: 40 + c.t * 160, kind: 'ice' };
        this.suck(this.orb, Math.random() < 0.5 ? '#ffffff' : '#9fe0ff');
      } else if (!c.fired) {
        c.fired = true;
        this.orb = null;
        this.freeze(hand);
      } else if (c.t > 1.1) {
        this.cast = null;
        this.dim.style.opacity = 0;
      }
    }
  }

  explode(at) {
    const W = this.desktop.width();
    fx.burst(at.x, at.y, { color: '#ff5a1a', n: 220, speed: 950, size: 8, gravity: 260, life: 1.4 });
    fx.burst(at.x, at.y, { color: '#ffb340', n: 160, speed: 700, size: 7, gravity: -200, life: 1.2 });
    fx.burst(at.x, at.y, { color: '#fff7c0', n: 90, speed: 420, size: 5 });
    fx.ring(at.x, at.y, '#ffb340', W * 0.45);
    setTimeout(() => fx.ring(at.x, at.y, '#ff5a1a', W * 0.7), 120);
    setTimeout(() => fx.ring(at.x, at.y, '#fff7c0', W * 0.3), 240);
    fx.flash('rgba(255, 170, 60, 0.8)', 800);
    fx.shake(this.desktop.el, 1000, 34);
    fx.shake(document.querySelector('#mage'), 600, 10);
    fx.text(at.x, at.y - 40, 'FIREBALL!', '#ffb340', 120);
    this.infection.burnFlights();
    // Every possessed file goes up in flames, one after another.
    const victims = this.fs.byState('infected');
    victims.forEach((node, i) => setTimeout(() => {
      this.infection.banish(node, { at: this.desktop.centerOf(node.id) || at, spell: true });
    }, 150 + i * 90));
  }

  freeze(at) {
    fx.burst(at.x, at.y, { color: '#ffffff', n: 120, speed: 700, size: 4, gravity: 40, life: 1.3 });
    fx.burst(at.x, at.y, { color: '#9fe0ff', n: 120, speed: 500, size: 6, life: 1.2 });
    fx.ring(at.x, at.y, '#9fe0ff', this.desktop.width() * 0.6);
    fx.flash('rgba(190, 235, 255, 0.85)', 700);
    fx.shake(this.desktop.el, 400, 10);
    fx.text(this.desktop.width() / 2, innerHeight * 0.4, 'FREEZE!', '#d4f4ff', 110);
    this.frost.classList.add('on');
    this.infection.freeze(FREEZE_S);
  }

  snow() {
    const W = this.desktop.width();
    if (Math.random() < 0.6) {
      fx.spark({ x: Math.random() * W, y: -6, vx: (Math.random() - 0.5) * 40, vy: 70 + Math.random() * 70, life: 3, size: 1.5 + Math.random() * 2.5, color: '#e8f6ff' });
    }
    this.setLabel(`<b class="ice-word">Frozen: ${Math.ceil(this.infection.frozenFor)} s left</b>`);
  }

  draw(ctx, now) {
    let o = this.orb;
    if (!o && this.chain.length && !this.cast) {
      o = { x: this.pos.x, y: this.pos.y, r: 14 + this.chain.length * 12, kind: this.dir };
    }
    if (!o) return;
    const r = o.r * (0.92 + 0.08 * Math.sin(now / 40));
    const [a, b, c, d] = COLORS[o.kind];
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
    g.addColorStop(0, a);
    g.addColorStop(0.35, b);
    g.addColorStop(0.7, c);
    g.addColorStop(1, d);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
