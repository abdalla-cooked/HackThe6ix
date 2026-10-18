// The mage guide: a speech queue with a typewriter effect.
import { ASSETS, spriteEl } from './assets.js';

const CPS = 35;
const MAX_QUEUE = 4;

export class Mage {
  constructor(el) {
    this.el = el;
    this.textEl = el.querySelector('.mage-text');
    this.btn = el.querySelector('.mage-btn');
    this.taskEl = el.querySelector('.mage-task span');
    this.bestiaryEl = el.querySelector('.bestiary');
    el.querySelector('.mage-sprite').append(spriteEl(ASSETS.mage, 'mage-img'));
    this.renderBestiary();
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

  // Nothing waiting and the current line has been on screen for a while.
  get idle() {
    return !this.queue.length && (!this.current || (this.current.chars >= this.current.text.length && this.current.hold > 4));
  }

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

  // Every monster in the game, dimmed until you have met it.
  renderBestiary() {
    this.bestiaryEl.replaceChildren(...[...ASSETS.monsters, ASSETS.boss].map(m => {
      const cell = document.createElement('div');
      cell.className = 'beast';
      cell.dataset.id = m.id;
      cell.title = m.label;
      cell.append(spriteEl(m, 'beast-img'));
      return cell;
    }));
  }

  seen(monster) {
    const cell = this.bestiaryEl.querySelector(`[data-id="${monster.id}"]`);
    if (!cell || cell.classList.contains('met')) return;
    cell.classList.add('met', 'new');
    setTimeout(() => cell.classList.remove('new'), 1500);
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
