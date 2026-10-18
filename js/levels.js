// Level table, level state machine, tutorial script, the mage's event lines,
// the level-up screen and the on-screen guide arrow.
import { FILE_POOL, FOLDER_NAMES } from './fs.js';
import { ASSETS } from './assets.js';
import { fx } from './fx.js';

export const LEVELS = [
  { name: 'Tutorial', files: 4, monsters: 1, rate: 0, every: 0, spreadDelay: 0, hop: 0, maxLost: 99, tutorial: true },
  { name: 'Level 1', files: 6, monsters: 3, rate: 4, every: 8, spreadDelay: 6, hop: 0, maxLost: 3 },
  { name: 'Level 2', files: 8, monsters: 5, rate: 5, every: 6, spreadDelay: 5, hop: 6, maxLost: 3 },
  { name: 'Level 3: Boss', files: 8, monsters: 3, rate: 5, every: 7, spreadDelay: 5, hop: 6, maxLost: 3, boss: true },
  { name: 'Level 4', files: 10, monsters: 7, rate: 6, every: 5, spreadDelay: 4, hop: 4, maxLost: 3 },
];

export function levelCfg(n) {
  if (n < LEVELS.length) return LEVELS[n];
  const last = LEVELS[LEVELS.length - 1], k = n - (LEVELS.length - 1);
  const boss = n % 3 === 0;
  return {
    ...last, name: boss ? `Level ${n}: Boss` : `Level ${n}`, boss,
    files: Math.min(14, last.files + k), monsters: boss ? 4 + k : last.monsters + 2 * k, rate: last.rate + k,
    every: Math.max(3, last.every - 0.5 * k), spreadDelay: Math.max(2, last.spreadDelay - 0.5 * k), hop: Math.max(2.5, last.hop - 0.3 * k),
  };
}

const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const PLAY_TASK = 'Drag the shaking green files into the cauldron before they turn into tombstones.';
const THUMB_TASK = 'Hold a thumbs up for 1 second to start';

export class Levels {
  constructor({ fs, desktop, infection, mage, gemma, bus, hud, overlay }) {
    Object.assign(this, { fs, desktop, infection, mage, gemma, bus, hud, overlay });
    this.state = 'idle';
    this.n = 0;
    this.bindEvents();
    fx.addLayer((ctx, now) => this.drawGuide(ctx, now));
  }

  get playing() { return this.state === 'playing'; }
  get tutorial() { return !!this.cfg?.tutorial; }
  get waiting() { return this.state === 'cleared' || this.state === 'failed'; }

  start(n) {
    this.n = n;
    this.cfg = levelCfg(n);
    this.state = 'intro';
    this.timer = 0;
    this.spawned = 0;
    this.nextAt = 3;
    this.bossNode = null;
    this.stats = { level: n, banished: 0, lost: 0, hops: 0, fastestCleanseMs: 0, spreadsAllowed: 0, boss: !!this.cfg.boss };
    this.infection.reset(this.cfg);
    this.desktop.closeAll();
    this.fs.reset();
    this.populate();
    this.hideOverlay();
    this.mage.clear();
    this.mage.hideButton();
    if (this.tutorial) {
      this.mage.say('Welcome, apprentice. I am Morwen. A demon is about to jump into one of your files. Watch closely!');
      this.mage.setTask('Watch your files. A demon is coming...');
    } else {
      this.mage.say(`${this.cfg.name}: protect ${this.cfg.files} files. Lose ${this.cfg.maxLost} and we fail.`, { priority: 'high' });
      if (this.cfg.boss) this.mage.say(`The ${ASSETS.boss.label} is coming! He takes 3 trips to the cauldron, and if he turns to stone we lose.`, { mood: 'alarm' });
      if (this.cfg.hop && !levelCfg(n - 1).hop) this.mage.say('Careful: these demons hop to a new spot if you leave them alone too long.', { mood: 'alarm' });
      this.mage.setTask(PLAY_TASK);
    }
    this.banner(this.cfg.name, this.cfg.boss ? '#ff7a1a' : '#b48cff');
    this.renderHud();
  }

  banner(text, color) {
    const W = this.desktop.width();
    fx.text(W / 2, innerHeight * 0.38, text, color, 72);
  }

  populate() {
    const pool = shuffle(FILE_POOL);
    const count = this.cfg.files;
    const folder = this.fs.add({ name: FOLDER_NAMES[this.n % FOLDER_NAMES.length], kind: 'folder' });
    const inFolder = Math.min(2, Math.floor(count / 4));
    const ids = [folder.id];
    pool.slice(0, count).forEach((f, i) => {
      ids.push(this.fs.add({ ...f }, i < inFolder ? folder.id : 0).id);
    });
    this.desktop.render();
    this.desktop.materialize(ids);
  }

  spawnBoss() {
    const node = this.fs.add({ name: 'MIMIC.exe', kind: 'boss', boss: true, bossHp: 3, content: 'It bites.' });
    this.bossNode = node;
    this.desktop.render();
    this.desktop.materialize([node.id]);
    this.infection.possess({ node, monster: ASSETS.boss });
  }

  advance() {
    if (this.state === 'cleared') this.start(this.n + 1);
    else if (this.state === 'failed') this.start(this.n);
  }

  update(dt) {
    if (this.state === 'intro') {
      this.timer += dt;
      if (this.timer > 2.5) { this.state = 'playing'; this.timer = 0; }
      return;
    }
    if (this.state !== 'playing') return;
    this.timer += dt;
    if (this.tutorial) {
      // The tutorial demon arrives on its own, on a file in plain sight.
      if (this.spawned < 1 && this.timer >= 1 && this.infection.possess({ rootOnly: true })) this.spawned = 1;
    } else {
      if (this.cfg.boss && !this.bossNode && this.timer >= 2) this.spawnBoss();
      if (this.spawned < this.cfg.monsters && this.timer >= this.nextAt) {
        if (this.infection.possess()) this.spawned++;
        this.nextAt = this.timer + this.cfg.every;
      }
    }
    if (this.stats.lost >= this.cfg.maxLost) return this.fail();
    const bossDone = !this.cfg.boss || (this.bossNode && this.bossNode.state === 'clean');
    if (this.spawned >= this.cfg.monsters && bossDone && this.infection.activeCount() === 0) this.clear();
  }

  async clear() {
    this.state = 'cleared';
    this.waitSince = performance.now() + 1400;
    const s = this.stats;
    const W = this.desktop.width();
    for (let i = 0; i < 6; i++) {
      setTimeout(() => fx.burst(W * (0.15 + Math.random() * 0.7), innerHeight * (0.2 + Math.random() * 0.4),
        { color: ['#ff8a2a', '#b48cff', '#6dff6d'][i % 3], n: 60, speed: 420, gravity: 260, life: 1.4 }), i * 140);
    }
    const next = levelCfg(this.n + 1);
    this.mage.setTask(`${THUMB_TASK} ${next.name}.`);
    if (this.tutorial) {
      this.mage.say('You banished your first demon! Demons can also hide inside folders: hold an open palm on a folder to open it, then drag the file out.', { priority: 'high', mood: 'proud' });
      this.mage.say(`Now give me a thumbs up and hold it for a second to start ${next.name}.`, { mood: 'proud' });
      this.showOverlay({ title: 'Tutorial complete!', sub: 'You know the trick: pinch, drag, drop in the cauldron.', next: next.name }, 1400);
      return;
    }
    this.mage.say(`${this.cfg.name} cleared! Let me look at you...`, { priority: 'high', mood: 'proud' });
    this.showOverlay({
      title: `${this.cfg.name} cleared!`,
      sub: `${s.banished} banished, ${s.lost} lost${s.fastestCleanseMs ? `, fastest save ${(s.fastestCleanseMs / 1000).toFixed(1)} s` : ''}`,
      verdict: 'Morwen is studying you through the camera...',
      next: next.name,
    }, 1400);
    const level = this.n;
    const r = await this.gemma.judge({ ...s, fastestCleanseMs: Math.round(s.fastestCleanseMs) });
    if (this.state !== 'cleared' || this.n !== level) return;
    this.mage.say(`I name you ${r.rank}. ${r.verdict}`, { mood: 'proud' });
    this.mage.say(`Thumbs up when you are ready for ${next.name}.`, { mood: 'proud' });
    this.setVerdict(`<b>${esc(r.rank)}</b>${esc(r.verdict)}`);
  }

  fail() {
    this.state = 'failed';
    this.waitSince = performance.now() + 900;
    this.infection.reset(this.cfg);
    const bossLost = this.bossNode?.state === 'lost';
    this.mage.say(bossLost
      ? `The ${ASSETS.boss.label} turned to stone and took the desktop with him. Try ${this.cfg.name} again.`
      : `Too many files lost. Even I failed my first exorcism. Try ${this.cfg.name} again.`, { priority: 'high', mood: 'alarm' });
    this.mage.setTask(`${THUMB_TASK} again.`);
    fx.flash('rgba(255, 60, 80, 0.35)', 600);
    this.showOverlay({ title: 'The demons won', sub: bossLost ? `The ${ASSETS.boss.label} got away.` : `${this.stats.lost} files turned to stone.`, next: 'Retry', fail: true }, 900);
  }

  // ---- level-up screen ----
  // Shown after a short delay so the last banish or tombstone plays out first.
  showOverlay({ title, sub, verdict = '', next, fail = false }, delay = 0) {
    const o = this.overlay, n = this.n;
    clearTimeout(this.overlayTimer);
    this.overlayTimer = setTimeout(() => { if (this.waiting && this.n === n) o.el.hidden = false; }, delay);
    o.el.classList.toggle('fail', fail);
    o.title.textContent = title;
    o.sub.textContent = sub;
    o.btn.textContent = fail ? 'Retry' : `Start ${next}`;
    o.hint.textContent = fail ? 'Hold a thumbs up for 1 second to try again' : `Hold a thumbs up for 1 second to start ${next}`;
    this.setVerdict(esc(verdict));
  }

  setVerdict(html) {
    this.overlay.verdict.innerHTML = html;
    this.overlay.verdict.hidden = !html;
  }

  hideOverlay() { clearTimeout(this.overlayTimer); this.overlay.el.hidden = true; }

  renderHud() {
    const { cfg, stats } = this;
    this.hud.level.textContent = cfg.name;
    this.hud.lost.textContent = cfg.tutorial ? '' : `Lost ${stats.lost}/${cfg.maxLost}`;
    this.hud.banished.textContent = `Banished ${stats.banished}`;
    this.hud.skip.hidden = !cfg.tutorial;
  }

  // Task line while playing: point at the file that needs saving.
  refreshTask() {
    if (this.state !== 'playing' && this.state !== 'intro') return;
    const target = this.fs.byState('infected').sort((a, b) => b.inf.corruption - a.inf.corruption)[0];
    if (!target) { this.mage.setTask(this.tutorial ? 'Watch your files. A demon is coming...' : PLAY_TASK); return; }
    const parent = this.fs.parentOf(target.id);
    const hidden = parent && parent.id !== 0 && !this.desktop.windows.has(`w${parent.id}`);
    this.mage.setTask(hidden
      ? `A demon is hiding in the ${parent.name} folder. Hold an open palm on it to open it.`
      : `Pinch ${target.name} (the one with the ${target.inf.monster.label}) and drop it in the cauldron.`);
  }

  bindEvents() {
    const { bus, mage } = this;
    const live = () => this.state === 'playing' || this.state === 'intro';
    bus.on('possess', node => {
      if (!live()) return;
      this.mage.seen(node.inf.monster);
      const parent = this.fs.parentOf(node.id);
      if (node.boss) {
        mage.say(`The ${ASSETS.boss.label} has arrived! Drag him into the cauldron three times.`, { priority: 'high', mood: 'alarm' });
      } else if (this.tutorial) {
        mage.say(`There! A ${node.inf.monster.label} jumped into ${node.name}. See it shaking and glowing? Pinch it with your thumb and index finger and drag it into the cauldron.`, { priority: 'high', mood: 'alarm' });
      } else if (parent && parent.id !== 0) {
        mage.say(`A ${node.inf.monster.label} is hiding inside the ${parent.name} folder! Hold an open palm on the folder to open it.`, { mood: 'alarm' });
      } else {
        mage.say(`A ${node.inf.monster.label} just crawled into ${node.name}!`, { mood: 'alarm' });
      }
      this.refreshTask();
    });
    bus.on('drag-start', node => {
      if (this.tutorial && node.state === 'clean' && this.fs.byState('infected').length) {
        mage.say('Not that one. Grab the shaking green file with the monster sitting on it.', { priority: 'high' });
      }
    });
    bus.on('open-folder', () => this.refreshTask());
    bus.on('moved', () => this.refreshTask());
    bus.on('hop', () => { if (this.stats) this.stats.hops++; this.refreshTask(); });
    bus.on('spread-warn', node => live() && mage.say(`${node.name} is spreading to its neighbor, hurry!`, { mood: 'alarm' }));
    bus.on('spread', () => { if (this.stats) this.stats.spreadsAllowed++; this.refreshTask(); });
    bus.on('lost', node => {
      if (!live()) return;
      this.stats.lost = node.boss ? this.cfg.maxLost : this.stats.lost + 1;
      this.renderHud();
      const c = this.desktop.centerOf(node.id);
      if (c) fx.text(c.x, c.y - 40, 'LOST!', '#ff5c6c', 44);
      fx.flash('rgba(255, 60, 80, 0.25)');
      fx.shake(this.desktop.el, 300, 8);
      mage.say(`We lost ${node.name}. It is a tombstone now.`, { priority: 'high', mood: 'alarm' });
      this.refreshTask();
    });
    bus.on('boss-hit', node => {
      mage.say(`Direct hit! The ${ASSETS.boss.label} jumped back out. ${node.bossHp} more!`, { priority: 'high', mood: 'proud' });
      this.refreshTask();
    });
    bus.on('banished', ({ node, name, ms }) => {
      const s = this.stats;
      s.banished++;
      s.fastestCleanseMs = s.fastestCleanseMs ? Math.min(s.fastestCleanseMs, ms) : ms;
      this.renderHud();
      mage.say(node.boss ? `The ${ASSETS.boss.label} is finished! Magnificent!` : `Splendid! ${name} is gone.`, { priority: 'high', mood: 'proud' });
      this.refreshTask();
    });
    bus.on('clean-in-cauldron', () => mage.say('That one is clean, do not waste the brew! Grab the shaking green one.', { priority: 'high' }));
    bus.on('open-infected', node => mage.say(`Do not open ${node.name}! Pinch it and drag it into the cauldron.`, { priority: 'high', mood: 'alarm' }));
    bus.on('open-lost', node => mage.say(`${node.name} is gone. Rest in peace.`, { priority: 'high' }));
  }

  // Pulsing ring on the file to save and a dashed arrow to the cauldron.
  // Shown in the tutorial and level 1, while the player is learning.
  drawGuide(ctx, now) {
    if (!this.cfg || this.n > 1 || this.state !== 'playing') return;
    const cau = this.desktop.cauldronCenter();
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    ctx.save();
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffd36b';
    ctx.shadowBlur = 16;
    const drag = this.desktop.drag && this.fs.find(this.desktop.drag.id);
    if (drag?.state === 'infected') {
      ctx.strokeStyle = `rgba(255, 211, 107, ${0.5 + 0.5 * pulse})`;
      ctx.beginPath();
      ctx.arc(cau.x, cau.y + 20, 95 + pulse * 12, 0, Math.PI * 2);
      ctx.stroke();
      this.label(ctx, 'Drop it here!', cau.x, cau.y - 100);
      ctx.restore();
      return;
    }
    const target = this.fs.byState('infected').sort((a, b) => b.inf.corruption - a.inf.corruption)[0];
    const c = target && this.desktop.centerOf(target.id);
    if (!c) { ctx.restore(); return; }
    ctx.strokeStyle = `rgba(255, 211, 107, ${0.6 + 0.4 * pulse})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 62 + pulse * 10, 0, Math.PI * 2);
    ctx.stroke();
    // Dashed curve from the file to the cauldron, with an arrowhead.
    const mx = (c.x + cau.x) / 2 + (c.x < cau.x ? -80 : 80), my = Math.min(c.y, cau.y) + Math.abs(cau.y - c.y) * 0.6;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -now / 30;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + 70);
    ctx.quadraticCurveTo(mx, my, cau.x, cau.y - 60);
    ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(cau.y - 60 - my, cau.x - mx);
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    ctx.moveTo(cau.x, cau.y - 55);
    ctx.lineTo(cau.x - 18 * Math.cos(ang - 0.45), cau.y - 55 - 18 * Math.sin(ang - 0.45));
    ctx.lineTo(cau.x - 18 * Math.cos(ang + 0.45), cau.y - 55 - 18 * Math.sin(ang + 0.45));
    ctx.fill();
    this.label(ctx, 'Pinch me and drag to the cauldron', c.x, c.y > 260 ? c.y - 112 : c.y + 175);
    ctx.restore();
  }

  label(ctx, text, x, y) {
    ctx.shadowBlur = 0;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 20;
    x = Math.max(w / 2 + 8, Math.min(this.desktop.width() - w / 2 - 8, x));
    ctx.fillStyle = 'rgba(20, 10, 36, 0.9)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 18, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.fillText(text, x, y + 1);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
