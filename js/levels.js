// Level table, level state machine, tutorial script, the mage's event lines
// and the on-screen guide arrow.
import { FILE_POOL, FOLDER_NAMES } from './fs.js';
import { SHAPE_LABELS, SPELLS } from './shapes.js';
import { fx } from './fx.js';

export const LEVELS = [
  { name: 'Tutorial', files: 4, monsters: 1, rate: 0, every: 0, spreadDelay: 0, maxLost: 99, shapes: ['line'], tutorial: true },
  { name: 'Level 1', files: 6, monsters: 3, rate: 4, every: 9, spreadDelay: 6, maxLost: 3, shapes: ['line', 'circle'] },
  { name: 'Level 2', files: 8, monsters: 5, rate: 5, every: 7, spreadDelay: 5, maxLost: 3, shapes: ['line', 'circle', 'zigzag'] },
  { name: 'Level 3', files: 10, monsters: 7, rate: 6, every: 6, spreadDelay: 4, maxLost: 3, shapes: ['line', 'circle', 'zigzag', 'triangle'] },
  { name: 'Level 4', files: 12, monsters: 9, rate: 7, every: 5, spreadDelay: 3, maxLost: 3, shapes: ['line', 'circle', 'zigzag', 'triangle', 'vee'] },
];

export function levelCfg(n) {
  if (n < LEVELS.length) return LEVELS[n];
  const last = LEVELS[LEVELS.length - 1], k = n - (LEVELS.length - 1);
  return {
    ...last, name: `Level ${n}`,
    files: Math.min(16, last.files + 2 * k), monsters: last.monsters + 2 * k, rate: last.rate + k,
    every: Math.max(3, last.every - 0.5 * k), spreadDelay: Math.max(2, last.spreadDelay - 0.5 * k),
  };
}

const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const shapeWord = s => SHAPE_LABELS[s].toUpperCase();
const PLAY_TASK = 'Drag the shaking green files into the cauldron before they turn into tombstones.';

export class Levels {
  constructor({ fs, desktop, infection, mage, gemma, bus, hud }) {
    Object.assign(this, { fs, desktop, infection, mage, gemma, bus, hud });
    this.state = 'idle';
    this.n = 0;
    this.bindEvents();
    fx.addLayer((ctx, now) => this.drawGuide(ctx, now));
  }

  get playing() { return this.state === 'playing'; }
  get tutorial() { return !!this.cfg?.tutorial; }

  start(n) {
    this.n = n;
    this.cfg = levelCfg(n);
    this.state = 'intro';
    this.timer = 0;
    this.spawned = 0;
    this.nextAt = 3;
    this.stats = { level: n, banished: 0, lost: 0, cleanseAttempts: 0, scores: [], fastestCleanseMs: 0, spreadsAllowed: 0 };
    this.infection.reset(this.cfg);
    this.desktop.closeAll();
    this.fs.reset();
    this.populate();
    this.mage.clear();
    this.mage.hideButton();
    this.mage.renderLegend(this.cfg.shapes);
    this.mage.highlightSpell(null);
    if (this.tutorial) {
      this.mage.say('Welcome, apprentice. I am Morwen. A demon is about to jump into one of your files. Watch closely!');
      this.mage.setTask('Watch your files. A demon is coming...');
    } else {
      const fresh = this.cfg.shapes.filter(s => !levelCfg(n - 1).shapes.includes(s));
      this.mage.say(`${this.cfg.name}: protect ${this.cfg.files} files from ${this.cfg.monsters} demons. Lose ${this.cfg.maxLost} and we fail.`, { priority: 'high' });
      for (const s of fresh) this.mage.say(`New spell unlocked: draw a ${shapeWord(s)} (${SPELLS[s]}). Check the spellbook below me.`, { mood: 'proud' });
      this.mage.setTask(PLAY_TASK);
    }
    this.renderHud();
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
    } else if (this.spawned < this.cfg.monsters && this.timer >= this.nextAt) {
      if (this.infection.possess()) this.spawned++;
      this.nextAt = this.timer + this.cfg.every;
    }
    if (this.stats.lost >= this.cfg.maxLost) return this.fail();
    if (this.spawned >= this.cfg.monsters && this.infection.activeCount() === 0) this.clear();
  }

  async clear() {
    this.state = 'cleared';
    this.mage.highlightSpell(null);
    const s = this.stats;
    if (this.tutorial) {
      this.mage.say('You banished your first demon! One more trick: demons can hide inside folders. Hold an open palm on a folder to open it, then drag the file out.', { mood: 'proud' });
      this.mage.say(`Next: ${levelCfg(1).files} files and ${levelCfg(1).monsters} demons. Hold an open palm on the green button when ready.`, { mood: 'proud' });
      this.mage.setTask('Hold an open palm on "Start level 1" (or pinch it).');
      this.mage.showButton('Start level 1');
      return;
    }
    this.mage.say(`${this.cfg.name} cleared! Let me look at you...`, { priority: 'high', mood: 'proud' });
    this.mage.setTask('Level cleared! Wait for my verdict, then press the green button.');
    const avg = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length * 100) : 0;
    const level = this.n;
    const r = await this.gemma.judge({ ...s, avgShapeScore: avg, fastestCleanseMs: Math.round(s.fastestCleanseMs) });
    if (this.state !== 'cleared' || this.n !== level) return;
    this.mage.say(`I name you ${r.rank}. ${r.verdict}`, { mood: 'proud' });
    const next = levelCfg(this.n + 1);
    this.mage.say(`Next: ${next.files} files and ${next.monsters} demons. Open your palm on the button when ready.`, { mood: 'proud' });
    this.mage.setTask(`Hold an open palm on "Start ${next.name}" (or pinch it).`);
    this.mage.showButton(`Start ${next.name}`);
  }

  fail() {
    this.state = 'failed';
    this.infection.reset(this.cfg);
    this.mage.highlightSpell(null);
    this.mage.say(`Too many files lost. Even I failed my first exorcism. Try ${this.cfg.name} again.`, { priority: 'high', mood: 'alarm' });
    this.mage.setTask('Hold an open palm on "Retry" (or pinch it).');
    this.mage.showButton('Retry');
  }

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
    if (this.infection.ritual) return;
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
      const parent = this.fs.parentOf(node.id);
      if (this.tutorial) {
        mage.say(`There! A ${node.inf.monster.label} demon jumped into ${node.name}. See it shaking and glowing? Pinch it with your thumb and index finger and drag it into the cauldron.`, { priority: 'high', mood: 'alarm' });
      } else if (parent && parent.id !== 0) {
        mage.say(`A ${node.inf.monster.label} is hiding inside the ${parent.name} folder! Hold an open palm on the folder to open it.`, { mood: 'alarm' });
      } else {
        mage.say(`A ${node.inf.monster.label} just crawled into ${node.name}!`, { mood: 'alarm' });
      }
      this.refreshTask();
    });
    bus.on('drag-start', node => {
      if (this.tutorial && node.state === 'clean' && this.fs.byState('infected').length) {
        mage.say('Not that one. Grab the shaking green file with the demon sitting on it.', { priority: 'high' });
      }
    });
    bus.on('open-folder', () => this.refreshTask());
    bus.on('moved', () => this.refreshTask());
    bus.on('cleanse-start', node => {
      const shape = node.inf.shape;
      mage.highlightSpell(shape);
      mage.setTask(`Point one finger and draw a ${shapeWord(shape)} in the air. Follow the glowing guide above the cauldron.`);
      mage.say(this.tutorial
        ? `Into the brew! Now point ONE finger (fold the others) and draw a ${shapeWord(shape)} in the air, starting from the orange dot.`
        : `Into the brew! Draw a ${shapeWord(shape)}, the ${SPELLS[shape]}!`, { priority: 'high', mood: 'alarm' });
    });
    bus.on('spread-warn', node => live() && mage.say(`${node.name} is spreading to its neighbor, hurry!`, { mood: 'alarm' }));
    bus.on('spread', () => { if (this.stats) this.stats.spreadsAllowed++; this.refreshTask(); });
    bus.on('lost', node => {
      if (!live()) return;
      this.stats.lost++;
      this.renderHud();
      mage.say(`We lost ${node.name}. It is a tombstone now.`, { priority: 'high', mood: 'alarm' });
      this.refreshTask();
    });
    bus.on('attempt', () => { if (this.stats) this.stats.cleanseAttempts++; });
    bus.on('banished', ({ name, score, ms }) => {
      const s = this.stats;
      s.banished++;
      s.scores.push(score);
      s.fastestCleanseMs = s.fastestCleanseMs ? Math.min(s.fastestCleanseMs, ms) : ms;
      this.renderHud();
      mage.highlightSpell(null);
      mage.say(`Splendid! ${name} is gone.`, { priority: 'high', mood: 'proud' });
      this.refreshTask();
    });
    bus.on('wrong-shape', ({ result, want, fails }) => {
      const msg = result.score < 0.6
        ? `That did not look like a shape. Draw a ${shapeWord(want)}, slowly, from the orange dot.`
        : `Close, but that looked like a ${shapeWord(result.name)}. Draw a ${shapeWord(want)}.`;
      mage.say(fails >= 3 ? 'Too many misses!' : `${msg} (${3 - fails} tries left)`, { priority: 'high', mood: 'alarm' });
    });
    bus.on('escape', ({ name, reason }) => {
      const why = reason === 'timeout' ? 'You ran out of time.' : 'Too many wrong shapes.';
      mage.highlightSpell(null);
      mage.say(`${why} ${name} escaped into another file! Grab it again.`, { priority: 'high', mood: 'alarm' });
      setTimeout(() => this.refreshTask(), 1300);
    });
    bus.on('clean-in-cauldron', () => mage.say('That one is clean, do not waste the brew! Grab the shaking green one.', { priority: 'high' }));
    bus.on('cauldron-busy', () => mage.say('One demon at a time in the cauldron!', { priority: 'high' }));
    bus.on('open-infected', node => mage.say(`Do not open ${node.name}! Pinch it and drag it into the cauldron.`, { priority: 'high', mood: 'alarm' }));
    bus.on('open-lost', node => mage.say(`${node.name} is gone. Rest in peace.`, { priority: 'high' }));
  }

  // Pulsing ring on the file to save and a dashed arrow to the cauldron.
  // Shown in the tutorial and level 1, while the player is learning.
  drawGuide(ctx, now) {
    if (!this.cfg || this.n > 1 || this.state !== 'playing' || this.infection.ritual) return;
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
    ctx.fillStyle = 'rgba(20, 10, 36, 0.9)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 18, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.fillText(text, x, y + 1);
  }
}
