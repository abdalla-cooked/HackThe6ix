// The mage guide: a speech queue with a typewriter effect.
import { ASSETS, spriteEl } from './assets.js';
import { shapeSVG, SHAPE_LABELS, SPELLS } from './shapes.js';

const CPS = 35;
const MAX_QUEUE = 4;

export class Mage {
  constructor(el) {
    this.el = el;
    this.textEl = el.querySelector('.mage-text');
    this.btn = el.querySelector('.mage-btn');
    this.taskEl = el.querySelector('.mage-task span');
    this.legendEl = el.querySelector('.mage-legend');
    el.querySelector('.mage-sprite').append(spriteEl(ASSETS.mage, 'mage-img'));
    el.querySelector('.mage-name').textContent = ASSETS.mage.name;
    this.queue = [];
    this.current = null;
  }

  say(text, { priority = 'normal', mood = 'calm' } = {}) {
    const line = { text, mood };
    if (priority === 'high') {
      // Urgent lines replace whatever was waiting, so stale hints never resurface.
      this.queue = [line];
      this.current = null;
    } else {
      this.queue.push(line);
      if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    }
  }

  clear() { this.queue = []; this.current = null; }

  skip() {
    if (!this.current) return;
    if (this.current.chars < this.current.text.length) this.current.chars = this.current.text.length;
    else this.current = null;
  }

  // The current objective. Unlike speech lines, it stays until replaced.
  setTask(text) {
    if (this.taskEl.textContent === text) return;
    this.taskEl.textContent = text;
    const box = this.taskEl.parentElement;
    box.classList.remove('flash');
    void box.offsetWidth;
    box.classList.add('flash');
  }

  // Spellbook: every shape, the monster it banishes, and whether it is unlocked yet.
  renderLegend(unlocked) {
    const rows = ASSETS.monsters.map(m => {
      const on = unlocked.includes(m.spell);
      return `<div class="spell ${on ? '' : 'locked'}" data-spell="${m.spell}">
        ${shapeSVG(m.spell, 'glyph-svg legend-glyph')}
        <div><b>${SHAPE_LABELS[m.spell]}</b> <span class="spell-name">${SPELLS[m.spell]}</span>
        <small>${on ? `banishes ${m.emoji} ${m.label}` : 'unlocks in a later level'}</small></div>
      </div>`;
    }).join('');
    this.legendEl.innerHTML = `<h4>Spellbook</h4>${rows}`;
  }

  highlightSpell(shape) {
    for (const row of this.legendEl.querySelectorAll('.spell')) row.classList.toggle('active', row.dataset.spell === shape);
  }

  showButton(label) { this.btn.textContent = label; this.btn.hidden = false; }
  hideButton() { this.btn.hidden = true; }

  update(dt) {
    if (!this.current && this.queue.length) {
      this.current = { ...this.queue.shift(), chars: 0, hold: 0 };
      this.el.dataset.mood = this.current.mood;
    }
    const c = this.current;
    if (!c) return;
    if (c.chars < c.text.length) {
      c.chars = Math.min(c.text.length, c.chars + CPS * dt);
      this.textEl.textContent = c.text.slice(0, Math.floor(c.chars));
    } else {
      this.textEl.textContent = c.text;
      c.hold += dt;
      if (c.hold >= Math.max(2.5, c.text.length / 15) && this.queue.length) this.current = null;
    }
  }
}
